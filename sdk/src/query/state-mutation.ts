/**
 * STATE.md mutation handlers — write operations with lockfile atomicity.
 *
 * Ported from get-shit-done/bin/lib/state.cjs.
 * Provides STATE.md mutation commands: update, patch, begin-phase,
 * advance-plan, record-metric, update-progress, add-decision, add-blocker,
 * resolve-blocker, record-session, validate, sync, prune, signal-waiting, signal-resume.
 *
 * All writes go through readModifyWriteStateMd which acquires a lockfile,
 * applies the modifier, syncs frontmatter, normalizes markdown, and writes.
 *
 * @example
 * ```typescript
 * import { stateUpdate, stateBeginPhase } from './state-mutation.js';
 *
 * await stateUpdate(['Status', 'executing'], '/project');
 * await stateBeginPhase(['11', 'State Mutations', '3'], '/project');
 * ```
 */

import { open, unlink, stat, readFile, writeFile, readdir } from 'node:fs/promises';
import {
  constants, unlinkSync, existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter, stripFrontmatter } from './frontmatter.js';
import { reconstructFrontmatter, spliceFrontmatter } from './frontmatter-mutation.js';
import {
  comparePhaseNum,
  escapeRegex,
  normalizePhaseName,
  phaseTokenMatches,
  planningPaths,
  normalizeMd,
  stateExtractField,
} from './helpers.js';
import { buildStateFrontmatter, getMilestonePhaseFilter } from './state.js';
import type { QueryHandler } from './utils.js';

// ─── Process exit lock cleanup (D2 — match CJS state.cjs:16-23) ─────────

/**
 * Module-level set tracking held locks for process.on('exit') cleanup.
 * Exported for test access only.
 */
export const _heldStateLocks = new Set<string>();

process.on('exit', () => {
  for (const lockPath of _heldStateLocks) {
    try { unlinkSync(lockPath); } catch { /* already gone */ }
  }
});

// ─── stateReplaceField ────────────────────────────────────────────────────

/**
 * Replace a field value in STATE.md content.
 *
 * Uses separate regex instances (no g flag) to avoid lastIndex persistence.
 * Supports both **bold:** and plain: formats.
 *
 * @param content - STATE.md content
 * @param fieldName - Field name to replace
 * @param newValue - New value to set
 * @returns Updated content, or null if field not found
 */
export function stateReplaceField(content: string, fieldName: string, newValue: string): string | null {
  const escaped = escapeRegex(fieldName);
  // Try **Field:** bold format first
  const boldPattern = new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i');
  if (boldPattern.test(content)) {
    return content.replace(new RegExp(`(\\*\\*${escaped}:\\*\\*\\s*)(.*)`, 'i'), (_match, prefix: string) => `${prefix}${newValue}`);
  }
  // Try plain Field: format
  const plainPattern = new RegExp(`(^${escaped}:\\s*)(.*)`, 'im');
  if (plainPattern.test(content)) {
    return content.replace(new RegExp(`(^${escaped}:\\s*)(.*)`, 'im'), (_match, prefix: string) => `${prefix}${newValue}`);
  }
  return null;
}

/**
 * Replace a field with fallback field name support.
 *
 * Tries primary first, then fallback. Returns content unchanged if neither matches.
 */
function stateReplaceFieldWithFallback(content: string, primary: string, fallback: string | null, value: string): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

/**
 * Update fields within the ## Current Position section.
 *
 * Only updates fields that already exist in the section.
 */
function updateCurrentPositionFields(content: string, fields: Record<string, string | undefined>): string {
  const posPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
  const posMatch = content.match(posPattern);
  if (!posMatch) return content;

  let posBody = posMatch[2];

  if (fields.status && /^Status:/m.test(posBody)) {
    posBody = posBody.replace(/^Status:.*$/m, `Status: ${fields.status}`);
  }
  if (fields.lastActivity && /^Last activity:/im.test(posBody)) {
    posBody = posBody.replace(/^Last activity:.*$/im, `Last activity: ${fields.lastActivity}`);
  }
  if (fields.plan && /^Plan:/m.test(posBody)) {
    posBody = posBody.replace(/^Plan:.*$/m, `Plan: ${fields.plan}`);
  }

  return content.replace(posPattern, `${posMatch[1]}${posBody}`);
}

/** Port of `readTextArgOrFile` from `state.cjs` — inline text or file path under project root. */
function readTextArgOrFile(
  projectDir: string,
  value: string | null | undefined,
  filePath: string | null | undefined,
  label: string,
): string {
  if (!filePath) {
    return (value ?? '').trim();
  }
  const root = resolve(projectDir);
  const resolved = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
  const rel = relative(root, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${label} path rejected: outside project directory`);
  }
  try {
    return readFileSync(resolved, 'utf-8').trimEnd();
  } catch {
    throw new Error(`${label} file not found: ${filePath}`);
  }
}

// ─── Lockfile helpers ─────────────────────────────────────────────────────

/**
 * If the lock file contains a PID, return whether that process is gone (stolen
 * locks after SIGKILL/crash). Null if the file could not be read.
 */
async function isLockProcessDead(lockPath: string): Promise<boolean | null> {
  try {
    const raw = await readFile(lockPath, 'utf-8');
    const pid = parseInt(raw.trim(), 10);
    if (!Number.isFinite(pid) || pid <= 0) return true;
    try {
      process.kill(pid, 0);
      return false;
    } catch {
      return true;
    }
  } catch {
    return null;
  }
}

/**
 * Acquire a lockfile for STATE.md operations.
 *
 * Uses O_CREAT|O_EXCL for atomic creation. Retries up to 10 times with
 * 200ms + jitter delay. Cleans stale locks when the holder PID is dead, or when
 * the lock file is older than 10 seconds (existing heuristic).
 *
 * @param statePath - Path to STATE.md
 * @returns Path to the lockfile
 */
export async function acquireStateLock(statePath: string): Promise<string> {
  const lockPath = statePath + '.lock';
  const maxRetries = 10;
  const retryDelay = 200;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const fd = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      await fd.writeFile(String(process.pid));
      await fd.close();
      _heldStateLocks.add(lockPath);
      return lockPath;
    } catch (err: unknown) {
      if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EEXIST') {
        try {
          const dead = await isLockProcessDead(lockPath);
          if (dead === true) {
            await unlink(lockPath);
            continue;
          }
          const s = await stat(lockPath);
          if (Date.now() - s.mtimeMs > 10000) {
            await unlink(lockPath);
            continue;
          }
        } catch { /* lock released between check */ }

        if (i === maxRetries - 1) {
          try { await unlink(lockPath); } catch { /* ignore */ }
          return lockPath;
        }
        await new Promise<void>(r => setTimeout(r, retryDelay + Math.floor(Math.random() * 50)));
      } else {
        // D3: Graceful degradation on non-EEXIST errors (match CJS state.cjs:889)
        return lockPath;
      }
    }
  }
  return lockPath;
}

/**
 * Release a lockfile.
 *
 * @param lockPath - Path to the lockfile to release
 */
export async function releaseStateLock(lockPath: string): Promise<void> {
  _heldStateLocks.delete(lockPath);
  try { await unlink(lockPath); } catch { /* already gone */ }
}

// ─── Frontmatter sync + write helpers ─────────────────────────────────────

/**
 * Sync STATE.md content with rebuilt YAML frontmatter.
 *
 * Strips existing frontmatter, rebuilds from body + disk, and splices back.
 * Preserves existing status when body-derived status is 'unknown'.
 */
async function syncStateFrontmatter(content: string, projectDir: string): Promise<string> {
  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);
  const derivedFm = await buildStateFrontmatter(body, projectDir);

  // Preserve existing status when body-derived is 'unknown'
  if (derivedFm.status === 'unknown' && existingFm.status && existingFm.status !== 'unknown') {
    derivedFm.status = existingFm.status;
  }

  const yamlStr = reconstructFrontmatter(derivedFm);
  return `---\n${yamlStr}\n---\n\n${body}`;
}

/**
 * Atomic read-modify-write for STATE.md.
 *
 * Holds lock across the entire read -> transform -> write cycle.
 *
 * @param projectDir - Project root directory
 * @param modifier - Function to transform STATE.md content
 * @returns The final written content
 */
async function readModifyWriteStateMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const statePath = planningPaths(projectDir, workstream).state;
  const lockPath = await acquireStateLock(statePath);
  try {
    let content: string;
    try {
      content = await readFile(statePath, 'utf-8');
    } catch {
      content = '';
    }
    // Strip frontmatter before passing to modifier so that regex replacements
    // operate on body fields only (not on YAML frontmatter keys like 'status:').
    // syncStateFrontmatter rebuilds frontmatter from the modified body + disk.
    const body = stripFrontmatter(content);
    const modified = await modifier(body);
    const synced = await syncStateFrontmatter(modified, projectDir);
    const normalized = normalizeMd(synced);
    await writeFile(statePath, normalized, 'utf-8');
    return normalized;
  } finally {
    await releaseStateLock(lockPath);
  }
}

/**
 * Full-file read-modify-write for STATE.md — matches CJS `readModifyWriteStateMd` in `state.cjs`
 * (modifier receives entire file content including YAML frontmatter).
 * Used by milestone completion and other flows that replace body fields the same way as the CLI.
 */
export async function readModifyWriteStateMdFull(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<void> {
  const statePath = planningPaths(projectDir, workstream).state;
  const lockPath = await acquireStateLock(statePath);
  try {
    let content = '';
    try {
      content = await readFile(statePath, 'utf-8');
    } catch {
      /* missing */
    }
    const modified = await modifier(content);
    const synced = await syncStateFrontmatter(modified, projectDir);
    await writeFile(statePath, normalizeMd(synced), 'utf-8');
  } finally {
    await releaseStateLock(lockPath);
  }
}

// ─── Exported handlers ────────────────────────────────────────────────────

/**
 * Query handler for state.update command.
 *
 * Replaces a single field in STATE.md.
 *
 * @param args - args[0]: field name, args[1]: new value
 * @param projectDir - Project root directory
 * @returns QueryResult with { updated: true/false }
 */
export const stateUpdate: QueryHandler = async (args, projectDir, workstream) => {
  const field = args[0];
  const value = args[1];

  if (!field || value === undefined) {
    throw new GSDError('field and value required for state update', ErrorClassification.Validation);
  }

  let updated = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const result = stateReplaceField(content, field, value);
    if (result) {
      updated = true;
      return result;
    }
    return content;
  }, workstream);

  return { data: { updated } };
};

/**
 * Query handler for state.patch command.
 *
 * Replaces multiple fields atomically in one lock cycle.
 *
 * @param args - Either `--field value` pairs (CLI / gsd-tools) or a single JSON object string (SDK).
 * @param projectDir - Project root directory
 * @returns QueryResult with `{ updated, failed }` matching `cmdStatePatch` in `state.cjs`
 */
export const statePatch: QueryHandler = async (args, projectDir, workstream) => {
  let patches: Record<string, string>;

  if (args.length >= 2 && args[0]?.startsWith('--')) {
    patches = {};
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace(/^--/, '');
      const value = args[i + 1];
      if (key && value !== undefined) patches[key] = value;
    }
  } else {
    const jsonString = args[0];
    if (!jsonString) {
      throw new GSDError('JSON patches required', ErrorClassification.Validation);
    }
    try {
      patches = JSON.parse(jsonString) as Record<string, string>;
    } catch {
      throw new GSDError('Invalid JSON for patches', ErrorClassification.Validation);
    }
  }

  const updated: string[] = [];
  const failed: string[] = [];
  await readModifyWriteStateMd(projectDir, (content) => {
    for (const [field, value] of Object.entries(patches)) {
      const result = stateReplaceField(content, field, String(value));
      if (result) {
        content = result;
        updated.push(field);
      } else {
        failed.push(field);
      }
    }
    return content;
  }, workstream);

  return { data: { updated, failed } };
};

/**
 * Query handler for state.begin-phase command.
 *
 * Sets phase, plan, status, progress, and current focus fields.
 * Rewrites the Current Position section.
 *
 * Accepts gsd-tools-style argv: `--phase N [--name S] [--plans C]` or positional
 * `[phase, name?, planCount?]` (tests and direct handler calls).
 *
 * @param args - Named or positional phase / name / plan count
 * @param projectDir - Project root directory
 * @returns QueryResult with phase metadata and `updated` field names (for raw parity)
 */
export const stateBeginPhase: QueryHandler = async (args, projectDir, workstream) => {
  const named = parseNamedArgs(args, ['phase', 'name', 'plans']);
  let phaseNumber = (named.phase as string | null) || '';
  let phaseName = (named.name as string | null) || '';
  let plansStr = named.plans as string | null;

  const positionalMode = args.length > 0 && !String(args[0]).startsWith('--');
  if (positionalMode) {
    if (!phaseNumber) phaseNumber = args[0] ?? '';
    if (!phaseName) phaseName = (args[1] as string) ?? '';
    if (plansStr === null && args[2] !== undefined && !String(args[2]).startsWith('--')) {
      plansStr = args[2];
    }
  }

  const plansParsed =
    plansStr !== null && plansStr !== '' ? parseInt(String(plansStr), 10) : NaN;
  const planNum =
    Number.isFinite(plansParsed) && !Number.isNaN(plansParsed) && plansParsed > 0
      ? plansParsed
      : null;

  if (!phaseNumber) {
    throw new GSDError('phase number required', ErrorClassification.Validation);
  }

  const today = new Date().toISOString().split('T')[0];
  const updated: string[] = [];

  await readModifyWriteStateMd(projectDir, (content) => {
    // Update bold/plain fields
    const statusValue = `Executing Phase ${phaseNumber}`;
    let u = stateReplaceField(content, 'Status', statusValue);
    if (u) {
      content = u;
      updated.push('Status');
    }

    u = stateReplaceField(content, 'Last Activity', today);
    if (u) {
      content = u;
      updated.push('Last Activity');
    }

    const activityDesc = `Phase ${phaseNumber} execution started`;
    u = stateReplaceField(content, 'Last Activity Description', activityDesc);
    if (u) {
      content = u;
      updated.push('Last Activity Description');
    }

    u = stateReplaceField(content, 'Current Phase', String(phaseNumber));
    if (u) {
      content = u;
      updated.push('Current Phase');
    }

    if (phaseName) {
      u = stateReplaceField(content, 'Current Phase Name', phaseName);
      if (u) {
        content = u;
        updated.push('Current Phase Name');
      }
    }

    u = stateReplaceField(content, 'Current Plan', '1');
    if (u) {
      content = u;
      updated.push('Current Plan');
    }

    if (planNum !== null && !Number.isNaN(planNum)) {
      u = stateReplaceField(content, 'Total Plans in Phase', String(planNum));
      if (u) {
        content = u;
        updated.push('Total Plans in Phase');
      }
    }

    // Update **Current focus:**
    const focusLabel = phaseName ? `Phase ${phaseNumber} — ${phaseName}` : `Phase ${phaseNumber}`;
    const focusPattern = /(\*\*Current focus:\*\*\s*).*/i;
    if (focusPattern.test(content)) {
      content = content.replace(focusPattern, (_match, prefix: string) => `${prefix}${focusLabel}`);
      updated.push('Current focus');
    }

    // Update ## Current Position section
    const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const positionMatch = content.match(positionPattern);
    if (positionMatch) {
      const header = positionMatch[1];
      let posBody = positionMatch[2];

      const newPhase = `Phase: ${phaseNumber}${phaseName ? ` (${phaseName})` : ''} — EXECUTING`;
      if (/^Phase:/m.test(posBody)) {
        posBody = posBody.replace(/^Phase:.*$/m, newPhase);
      } else {
        posBody = newPhase + '\n' + posBody;
      }

      const newPlan = `Plan: 1 of ${planNum ?? '?'}`;
      if (/^Plan:/m.test(posBody)) {
        posBody = posBody.replace(/^Plan:.*$/m, newPlan);
      } else {
        posBody = posBody.replace(/^(Phase:.*$)/m, `$1\n${newPlan}`);
      }

      const newStatus = `Status: Executing Phase ${phaseNumber}`;
      if (/^Status:/m.test(posBody)) {
        posBody = posBody.replace(/^Status:.*$/m, newStatus);
      }

      const newActivity = `Last activity: ${today} -- Phase ${phaseNumber} execution started`;
      if (/^Last activity:/im.test(posBody)) {
        posBody = posBody.replace(/^Last activity:.*$/im, newActivity);
      }

      content = content.replace(positionPattern, `${header}${posBody}`);
      updated.push('Current Position');
    }

    return content;
  }, workstream);

  return {
    data: {
      updated,
      phase: phaseNumber,
      phase_name: phaseName || null,
      plan_count: planNum !== null && !Number.isNaN(planNum) ? planNum : null,
    },
  };
};

/**
 * Query handler for state.advance-plan command.
 *
 * Increments plan counter. Detects phase completion when at last plan.
 *
 * @param args - unused
 * @param projectDir - Project root directory
 * @returns QueryResult with { advanced, current_plan, total_plans }
 */
export const stateAdvancePlan: QueryHandler = async (_args, projectDir, workstream) => {
  const today = new Date().toISOString().split('T')[0];
  let result: Record<string, unknown> = { error: 'STATE.md not found' };

  await readModifyWriteStateMd(projectDir, (content) => {
    // Parse current plan info (content already has frontmatter stripped)
    const legacyPlan = stateExtractField(content, 'Current Plan');
    const legacyTotal = stateExtractField(content, 'Total Plans in Phase');
    const planField = stateExtractField(content, 'Plan');

    let currentPlan: number;
    let totalPlans: number;
    let useCompoundFormat = false;
    let compoundPlanField: string | null = null;

    if (legacyPlan && legacyTotal) {
      currentPlan = parseInt(legacyPlan, 10);
      totalPlans = parseInt(legacyTotal, 10);
    } else if (planField) {
      currentPlan = parseInt(planField, 10);
      const ofMatch = planField.match(/of\s+(\d+)/);
      totalPlans = ofMatch ? parseInt(ofMatch[1], 10) : NaN;
      useCompoundFormat = true;
      compoundPlanField = planField;
    } else {
      result = { error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' };
      return content;
    }

    if (isNaN(currentPlan) || isNaN(totalPlans)) {
      result = { error: 'Cannot parse Current Plan or Total Plans in Phase from STATE.md' };
      return content;
    }

    if (currentPlan >= totalPlans) {
      // Phase complete
      content = stateReplaceFieldWithFallback(content, 'Status', null, 'Phase complete — ready for verification');
      content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
      content = updateCurrentPositionFields(content, {
        status: 'Phase complete — ready for verification',
        lastActivity: today,
      });
      result = {
        advanced: false,
        reason: 'last_plan',
        current_plan: currentPlan,
        total_plans: totalPlans,
        status: 'ready_for_verification',
      };
      return content;
    }

    // Advance to next plan
    const newPlan = currentPlan + 1;
    let planDisplayValue: string;
    if (useCompoundFormat && compoundPlanField) {
      planDisplayValue = compoundPlanField.replace(/^\d+/, String(newPlan));
      content = stateReplaceField(content, 'Plan', planDisplayValue) || content;
    } else {
      planDisplayValue = `${newPlan} of ${totalPlans}`;
      content = stateReplaceField(content, 'Current Plan', String(newPlan)) || content;
    }
    content = stateReplaceFieldWithFallback(content, 'Status', null, 'Ready to execute');
    content = stateReplaceFieldWithFallback(content, 'Last Activity', 'Last activity', today);
    content = updateCurrentPositionFields(content, {
      status: 'Ready to execute',
      lastActivity: today,
      plan: planDisplayValue,
    });
    result = { advanced: true, previous_plan: currentPlan, current_plan: newPlan, total_plans: totalPlans };
    return content;
  }, workstream);

  return { data: result };
};

/**
 * Query handler for state.record-metric command.
 *
 * Appends a row to the Performance Metrics table.
 *
 * @param args - gsd-tools argv: `--phase`, `--plan`, `--duration`, `--tasks`, `--files`
 * @param projectDir - Project root directory
 * @returns QueryResult with { recorded: true/false }
 */
export const stateRecordMetric: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['phase', 'plan', 'duration', 'tasks', 'files']);
  const phase = parsed.phase as string | null;
  const plan = parsed.plan as string | null;
  const duration = parsed.duration as string | null;
  const tasks = (parsed.tasks as string | null) || '-';
  const files = (parsed.files as string | null) || '-';

  if (!phase || !plan || !duration) {
    return { data: { error: 'phase, plan, and duration required' } };
  }

  let recorded = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const metricsPattern = /(##\s*Performance Metrics[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n)([\s\S]*?)(?=\n##|\n$|$)/i;
    const metricsMatch = content.match(metricsPattern);

    if (metricsMatch) {
      let tableBody = metricsMatch[2].trimEnd();
      const newRow = `| Phase ${phase} P${plan} | ${duration} | ${tasks} tasks | ${files} files |`;

      if (tableBody.trim() === '' || tableBody.includes('None yet')) {
        tableBody = newRow;
      } else {
        tableBody = tableBody + '\n' + newRow;
      }

      content = content.replace(metricsPattern, (_match, header: string) => `${header}${tableBody}\n`);
      recorded = true;
    }
    return content;
  }, workstream);

  if (recorded) {
    return { data: { recorded: true, phase, plan, duration } };
  }
  return { data: { recorded: false, reason: 'Performance Metrics section not found in STATE.md' } };
};

/**
 * Query handler for state.update-progress command.
 *
 * Scans disk to count completed/total plans and updates progress bar.
 *
 * @param args - unused
 * @param projectDir - Project root directory
 * @returns QueryResult with { updated, percent, completed, total }
 */
export const stateUpdateProgress: QueryHandler = async (_args, projectDir, workstream) => {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  let totalPlans = 0;
  let totalSummaries = 0;

  try {
    const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const phaseDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(isDirInMilestone);

    for (const dir of phaseDirs) {
      const files = await readdir(join(phasesDir, dir));
      totalPlans += files.filter(f => /-PLAN\.md$/i.test(f)).length;
      totalSummaries += files.filter(f => /-SUMMARY\.md$/i.test(f)).length;
    }
  } catch { /* phases dir may not exist */ }

  const percent = totalPlans > 0 ? Math.min(100, Math.round(totalSummaries / totalPlans * 100)) : 0;
  const barWidth = 10;
  const filled = Math.round(percent / 100 * barWidth);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
  const progressStr = `[${bar}] ${percent}%`;

  let updated = false;
  await readModifyWriteStateMd(projectDir, (content) => {
    const boldProgressPattern = /(\*\*Progress:\*\*\s*).*/i;
    const plainProgressPattern = /^(Progress:\s*).*/im;
    if (boldProgressPattern.test(content)) {
      updated = true;
      return content.replace(boldProgressPattern, (_match, prefix: string) => `${prefix}${progressStr}`);
    }
    if (plainProgressPattern.test(content)) {
      updated = true;
      return content.replace(plainProgressPattern, (_match, prefix: string) => `${prefix}${progressStr}`);
    }
    return content;
  }, workstream);

  if (updated) {
    return { data: { updated: true, percent, completed: totalSummaries, total: totalPlans, bar: progressStr } };
  }
  return { data: { updated: false, reason: 'Progress field not found in STATE.md' } };
};

/**
 * Query handler for state.add-decision command.
 *
 * Appends a decision to the Decisions section. Removes placeholder text.
 * argv matches `gsd-tools.cjs`: `--phase`, `--summary`, `--rationale`, etc.
 */
export const stateAddDecision: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['phase', 'summary', 'summary-file', 'rationale', 'rationale-file']);
  const phase = parsed.phase as string | null;
  let summaryText: string | null = null;
  let rationaleText = '';

  try {
    summaryText = readTextArgOrFile(
      projectDir,
      (parsed.summary as string | null) ?? null,
      (parsed['summary-file'] as string | null) ?? null,
      'summary',
    );
    rationaleText = readTextArgOrFile(
      projectDir,
      (parsed.rationale as string | null) || '',
      (parsed['rationale-file'] as string | null) ?? null,
      'rationale',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { added: false, reason: msg } };
  }

  if (!summaryText) {
    return { data: { error: 'summary required' } };
  }

  const entry = `- [Phase ${phase || '?'}]: ${summaryText}${rationaleText ? ` — ${rationaleText}` : ''}`;
  let added = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None yet\.?\s*\n?/gi, '').replace(/No decisions yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      content = content.replace(sectionPattern, (_match, header: string) => `${header}${sectionBody}`);
      added = true;
    }
    return content;
  }, workstream);

  if (added) {
    return { data: { added: true, decision: entry } };
  }
  return { data: { added: false, reason: 'Decisions section not found in STATE.md' } };
};

/**
 * Query handler for state.add-blocker command.
 * argv: `--text`, `--text-file` (see `gsd-tools.cjs`).
 */
export const stateAddBlocker: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['text', 'text-file']);
  let blockerText: string | null = null;

  try {
    blockerText = readTextArgOrFile(
      projectDir,
      (parsed.text as string | null) ?? null,
      (parsed['text-file'] as string | null) ?? null,
      'blocker',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { data: { added: false, reason: msg } };
  }

  if (!blockerText) {
    return { data: { error: 'text required' } };
  }

  const entry = `- ${blockerText}`;
  let added = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      let sectionBody = match[2];
      sectionBody = sectionBody.replace(/None\.?\s*\n?/gi, '').replace(/None yet\.?\s*\n?/gi, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      content = content.replace(sectionPattern, (_match, header: string) => `${header}${sectionBody}`);
      added = true;
    }
    return content;
  }, workstream);

  if (added) {
    return { data: { added: true, blocker: blockerText } };
  }
  return { data: { added: false, reason: 'Blockers section not found in STATE.md' } };
};

/**
 * Query handler for state.resolve-blocker command.
 * argv: `--text` (see `gsd-tools.cjs`).
 */
export const stateResolveBlocker: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['text']);
  const searchText = parsed.text as string | null;
  if (!searchText) {
    return { data: { error: 'text required' } };
  }

  let removedMatchingLine = false;
  let blockersSectionFound = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    const sectionPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
    const match = content.match(sectionPattern);

    if (match) {
      blockersSectionFound = true;
      const sectionBody = match[2];
      const lines = sectionBody.split('\n');
      const filtered = lines.filter(line => {
        if (!line.startsWith('- ')) return true;
        const matches = line.toLowerCase().includes(searchText.toLowerCase());
        if (matches) removedMatchingLine = true;
        return !matches;
      });

      if (!removedMatchingLine) {
        return content;
      }

      let newBody = filtered.join('\n');
      if (!newBody.trim() || !newBody.includes('- ')) {
        newBody = 'None\n';
      }

      content = content.replace(sectionPattern, (_match, header: string) => `${header}${newBody}`);
    }
    return content;
  }, workstream);

  if (removedMatchingLine) {
    return { data: { resolved: true, blocker: searchText } };
  }
  return { data: { resolved: false, reason: blockersSectionFound
    ? 'Blocker text not found in STATE.md'
    : 'Blockers section not found in STATE.md'
  } };
};

// ─── state.add-roadmap-evolution ─────────────────────────────────────────

const VALID_ROADMAP_EVOLUTION_ACTIONS = new Set([
  'inserted', 'removed', 'moved', 'edited', 'added',
]);

/**
 * Format a canonical Roadmap Evolution entry line.
 *
 * Shapes match existing workflow templates (`insert-phase.md`, `add-phase.md`):
 *   - inserted: `- Phase {phase} inserted after Phase {after}: {note} (URGENT)`
 *   - added:    `- Phase {phase} added: {note}`
 *   - removed:  `- Phase {phase} removed: {note}`
 *   - moved:    `- Phase {phase} moved: {note}`
 *   - edited:   `- Phase {phase} edited: {note}`
 */
function formatRoadmapEvolutionEntry(opts: {
  phase: string;
  action: string;
  note?: string | null;
  after?: string | null;
  urgent?: boolean;
}): string {
  const { phase, action, note, after, urgent } = opts;
  const trimmedNote = note ? note.trim() : '';
  let line: string;
  if (action === 'inserted') {
    const afterClause = after ? ` after Phase ${after}` : '';
    line = `- Phase ${phase} inserted${afterClause}`;
    if (trimmedNote) line += `: ${trimmedNote}`;
    if (urgent) line += ' (URGENT)';
  } else {
    // added | removed | moved | edited
    line = `- Phase ${phase} ${action}`;
    if (trimmedNote) line += `: ${trimmedNote}`;
  }
  return line;
}

/**
 * Query handler for `state.add-roadmap-evolution`.
 *
 * Appends a single entry to the `### Roadmap Evolution` subsection under
 * `## Accumulated Context` in STATE.md. Creates the subsection if missing.
 * Deduplicates on exact line match against existing entries.
 *
 * Canonical replacement for the raw `Edit`/`Write` instructions in
 * `insert-phase.md` / `add-phase.md` step "update_project_state" so that
 * projects with a `protect-files.sh` PreToolUse hook blocking direct
 * STATE.md writes still update the Roadmap Evolution log.
 *
 * argv: `--phase`, `--action` (inserted|removed|moved|edited|added),
 *       `--note` (optional), `--after` (optional, for `inserted`),
 *       `--urgent` (boolean flag, appends "(URGENT)" when action=inserted).
 *
 * Returns `{ added: true, entry }` on success, or
 * `{ added: false, reason: 'duplicate', entry }` when an identical line
 * already exists.
 *
 * Throws `GSDError` with `ErrorClassification.Validation` when required
 * inputs are missing or `--action` is not in the allowed set.
 *
 * Atomicity: goes through `readModifyWriteStateMd` which holds a lockfile
 * across read -> transform -> write. Matches sibling mutation handlers.
 */
export const stateAddRoadmapEvolution: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['phase', 'action', 'note', 'after'], ['urgent']);
  const phase = (parsed.phase as string | null) ?? null;
  const action = (parsed.action as string | null) ?? null;
  const note = (parsed.note as string | null) ?? null;
  const after = (parsed.after as string | null) ?? null;
  const urgent = Boolean(parsed.urgent);

  if (!phase) {
    throw new GSDError('phase required for state.add-roadmap-evolution', ErrorClassification.Validation);
  }
  if (!action) {
    throw new GSDError('action required for state.add-roadmap-evolution', ErrorClassification.Validation);
  }
  if (!VALID_ROADMAP_EVOLUTION_ACTIONS.has(action)) {
    throw new GSDError(
      `invalid action "${action}" (expected one of: ${Array.from(VALID_ROADMAP_EVOLUTION_ACTIONS).join(', ')})`,
      ErrorClassification.Validation,
    );
  }

  const entry = formatRoadmapEvolutionEntry({ phase, action, note, after, urgent });

  let added = false;
  let duplicate = false;

  await readModifyWriteStateMd(projectDir, (content) => {
    // Match `### Roadmap Evolution` subsection up to the next heading or EOF.
    const subsectionPattern = /(###\s*Roadmap Evolution\s*\n)([\s\S]*?)(?=\n###?\s|\n##[^#]|$)/i;
    const match = content.match(subsectionPattern);

    if (match) {
      let sectionBody = match[2];
      // Dedupe: exact line match against any existing entry line.
      const existingLines = sectionBody.split('\n').map(l => l.trim());
      if (existingLines.some(l => l === entry.trim())) {
        duplicate = true;
        return content;
      }
      // Strip placeholder "None" / "None yet." lines.
      sectionBody = sectionBody.replace(/^None(?:\s+yet)?\.?\s*$/gim, '');
      sectionBody = sectionBody.trimEnd() + '\n' + entry + '\n';
      content = content.replace(subsectionPattern, (_m, header: string) => `${header}${sectionBody}`);
      added = true;
      return content;
    }

    // Subsection missing — create it.
    const accumulatedPattern = /(##\s*Accumulated Context\s*\n)/i;
    const newSubsection = `\n### Roadmap Evolution\n\n${entry}\n`;

    if (accumulatedPattern.test(content)) {
      // Insert immediately after the "## Accumulated Context" header.
      content = content.replace(accumulatedPattern, (_m, header: string) => `${header}${newSubsection}`);
      added = true;
      return content;
    }

    // No Accumulated Context section either — append both at EOF.
    const suffix = `\n## Accumulated Context\n${newSubsection}`;
    content = content.trimEnd() + suffix + '\n';
    added = true;
    return content;
  }, workstream);

  if (duplicate) {
    return { data: { added: false, reason: 'duplicate', entry } };
  }
  if (added) {
    return { data: { added: true, entry } };
  }
  // Unreachable given the logic above, but defensive.
  return { data: { added: false, reason: 'unknown', entry } };
};

/**
 * Query handler for state.record-session command.
 * argv: `--stopped-at`, `--resume-file` (see `cmdStateRecordSession` in `state.cjs`).
 */
export const stateRecordSession: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['stopped-at', 'resume-file']);
  const stoppedAt = parsed['stopped-at'] as string | null | undefined;
  const resumeFile = ((parsed['resume-file'] as string | null) ?? 'None');

  const now = new Date().toISOString();
  const updated: string[] = [];

  await readModifyWriteStateMd(projectDir, (content) => {
    let result = stateReplaceField(content, 'Last session', now);
    if (result) { content = result; updated.push('Last session'); }
    result = stateReplaceField(content, 'Last Date', now);
    if (result) { content = result; updated.push('Last Date'); }

    if (stoppedAt) {
      result = stateReplaceField(content, 'Stopped At', stoppedAt);
      if (!result) result = stateReplaceField(content, 'Stopped at', stoppedAt);
      if (result) { content = result; updated.push('Stopped At'); }
    }

    result = stateReplaceField(content, 'Resume File', resumeFile);
    if (!result) result = stateReplaceField(content, 'Resume file', resumeFile);
    if (result) { content = result; updated.push('Resume File'); }

    return content;
  }, workstream);

  if (updated.length > 0) {
    return { data: { recorded: true, updated } };
  }
  return { data: { recorded: false, reason: 'No session fields found in STATE.md' } };
};

/**
 * Query handler for state.planned-phase — port of `cmdStatePlannedPhase` from `state.cjs`.
 */
export const statePlannedPhase: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['phase', 'name', 'plans']);
  const phaseNumber = parsed.phase as string | null;
  const plansRaw = parsed.plans as string | null;
  const parsedPlanCount = plansRaw !== null && plansRaw !== '' ? parseInt(String(plansRaw), 10) : null;
  const planCount =
    parsedPlanCount !== null &&
    !Number.isNaN(parsedPlanCount) &&
    Number.isFinite(parsedPlanCount) &&
    parsedPlanCount > 0
      ? parsedPlanCount
      : null;

  if (!phaseNumber || String(phaseNumber).trim() === '') {
    return { data: { error: 'phase required (--phase <n>)' } };
  }

  const phaseLabel = String(phaseNumber).trim();

  const statePath = planningPaths(projectDir, workstream).state;
  if (!existsSync(statePath)) {
    return { data: { error: 'STATE.md not found' } };
  }

  const today = new Date().toISOString().split('T')[0];
  const updated: string[] = [];

  await readModifyWriteStateMd(projectDir, (content) => {
    let result = stateReplaceField(content, 'Status', 'Ready to execute');
    if (result) { content = result; updated.push('Status'); }

    if (planCount !== null) {
      result = stateReplaceField(content, 'Total Plans in Phase', String(planCount));
      if (result) { content = result; updated.push('Total Plans in Phase'); }
    }

    result = stateReplaceField(content, 'Last Activity', today);
    if (result) { content = result; updated.push('Last Activity'); }

    result = stateReplaceField(
      content,
      'Last Activity Description',
      `Phase ${phaseLabel} planning complete — ${planCount ?? '?'} plans ready`,
    );
    if (result) { content = result; updated.push('Last Activity Description'); }

    content = updateCurrentPositionFields(content, {
      status: 'Ready to execute',
      lastActivity: `${today} -- Phase ${phaseLabel} planning complete`,
    });
    return content;
  }, workstream);

  return { data: { updated, phase: phaseNumber, plan_count: planCount } };
};

// ─── stateMilestoneSwitch (bug #2630) ─────────────────────────────────────

/**
 * Query handler for `state.milestone-switch` — resets STATE.md for a new
 * milestone cycle (bug #2630 regression guard).
 *
 * The `/gsd-new-milestone` workflow only rewrote STATE.md's body (Current
 * Position section). The YAML frontmatter (`milestone`, `milestone_name`,
 * `status`, `progress.*`) was never touched on a mid-flight switch, so queries
 * that read frontmatter (`state.json`, `getMilestoneInfo`, every handler that
 * calls `buildStateFrontmatter`) kept reporting the old milestone and stale
 * progress counters until the first phase advance forced a resync.
 *
 * This handler performs the reset atomically under the STATE.md lock:
 * - Stomps frontmatter milestone/milestone_name with the caller-supplied
 *   values so `parseMilestoneFromState` reports the new milestone immediately.
 * - Resets `status` to `'planning'` (workflow is at "Defining requirements").
 * - Resets `progress` counters to zero (new milestone, nothing executed yet).
 * - Rewrites the `## Current Position` body to the new-milestone template so
 *   subsequent body-derived field extraction stays consistent with frontmatter.
 * - Preserves Accumulated Context (decisions, todos, blockers) — symmetric
 *   with `milestone.complete` which also keeps history.
 *
 * Args (named, matches gsd-tools style):
 * - `--version <vX.Y>` (required)
 * - `--name <milestone name>` (optional; defaults to 'milestone')
 *
 * Sibling CJS parity: `cmdInitNewMilestone` in `init.cjs` is read-only (like
 * the TS `initNewMilestone`). The workflow-level fix is to call
 * `state.milestone-switch` from `/gsd-new-milestone` Step 5 in place of the
 * manual body rewrite.
 */
export const stateMilestoneSwitch: QueryHandler = async (args, projectDir, workstream) => {
  // NOTE: the CLI flag is `--milestone` (not `--version`). gsd-tools reserves
  // `--version` as a globally-invalid help flag, so the workflow invokes this
  // handler with `--milestone vX.Y`. The internal variable is still `version`
  // because the value is a milestone version string.
  const parsed = parseNamedArgs(args, ['milestone', 'name']);
  const version = (parsed.milestone as string | null)?.trim();
  const name = ((parsed.name as string | null) ?? 'milestone').trim() || 'milestone';

  if (!version) {
    return { data: { error: 'milestone required (--milestone <vX.Y>)' } };
  }

  const today = new Date().toISOString().split('T')[0]!;
  const statePath = planningPaths(projectDir, workstream).state;
  const lockPath = await acquireStateLock(statePath);

  try {
    let content = '';
    try {
      content = await readFile(statePath, 'utf-8');
    } catch { /* STATE.md may not exist yet */ }

    const existingFm = extractFrontmatter(content);
    const body = stripFrontmatter(content);

    // Reset Current Position section body so body-derived extraction stays
    // consistent with the new frontmatter.
    const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
    const resetPositionBody =
      `\nPhase: Not started (defining requirements)\n` +
      `Plan: —\n` +
      `Status: Defining requirements\n` +
      `Last activity: ${today} — Milestone ${version} started\n\n`;
    let newBody: string;
    if (positionPattern.test(body)) {
      newBody = body.replace(positionPattern, (_m, header: string) => `${header}${resetPositionBody}`);
    } else {
      // Preserve any existing body but prepend a Current Position section.
      const preface = body.trim().length > 0 ? body : '# Project State\n';
      newBody = `${preface.trimEnd()}\n\n## Current Position\n${resetPositionBody}`;
    }

    // Build fresh frontmatter explicitly — do NOT rely on buildStateFrontmatter
    // here, because getMilestoneInfo reads the ON-DISK STATE.md and would
    // return the OLD milestone until we write it first. This is the crux of
    // bug #2630: any sync-based approach races against the very file it is
    // about to rewrite.
    const fm: Record<string, unknown> = {
      gsd_state_version: '1.0',
      milestone: version,
      milestone_name: name,
      status: 'planning',
      last_updated: new Date().toISOString(),
      last_activity: today,
      progress: {
        total_phases: 0,
        completed_phases: 0,
        total_plans: 0,
        completed_plans: 0,
        percent: 0,
      },
    };
    // Preserve frontmatter-only fields the caller may still care about
    // (paused_at cleared deliberately — a new milestone is a fresh start).
    if (existingFm.gsd_state_version) {
      fm.gsd_state_version = existingFm.gsd_state_version;
    }

    const yamlStr = reconstructFrontmatter(fm);
    const assembled = `---\n${yamlStr}\n---\n\n${newBody.replace(/^\n+/, '')}`;
    await writeFile(statePath, normalizeMd(assembled), 'utf-8');

    return {
      data: {
        switched: true,
        version,
        name,
        status: 'planning',
      },
    };
  } finally {
    await releaseStateLock(lockPath);
  }
};

// ─── parseNamedArgs (matches gsd-tools.cjs) ───────────────────────────────

function parseNamedArgs(
  args: string[],
  valueFlags: string[] = [],
  booleanFlags: string[] = [],
): Record<string, string | boolean | null> {
  const result: Record<string, string | boolean | null> = {};
  for (const flag of valueFlags) {
    const idx = args.indexOf(`--${flag}`);
    if (idx === -1) {
      result[flag] = null;
      continue;
    }
    const value = args[idx + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new GSDError(`missing value for --${flag}`, ErrorClassification.Validation);
    }
    result[flag] = value;
  }
  for (const flag of booleanFlags) {
    result[flag] = args.includes(`--${flag}`);
  }
  return result;
}

// ─── Human gate signals (WAITING.json) ───────────────────────────────────

/**
 * Port of `cmdSignalWaiting` from state.cjs.
 * Args: `--type`, `--question`, `--options` (pipe-separated), `--phase`.
 *
 * Writes `WAITING.json` under both `.gsd/` and `.planning/` so readers that only
 * watch one location (e.g. init workflows) still observe the signal.
 */
export const stateSignalWaiting: QueryHandler = async (args, projectDir, _workstream) => {
  const parsed = parseNamedArgs(args, ['type', 'question', 'options', 'phase']);
  const type = (parsed.type as string | null) || 'decision_point';
  const question = (parsed.question as string | null) || null;
  const optionsRaw = parsed.options as string | null;
  const phase = (parsed.phase as string | null) || null;

  const waitingPaths = [
    join(projectDir, '.gsd', 'WAITING.json'),
    join(projectDir, '.planning', 'WAITING.json'),
  ];

  const signal = {
    status: 'waiting',
    type,
    question,
    options: optionsRaw ? optionsRaw.split('|').map(o => o.trim()) : [],
    since: new Date().toISOString(),
    phase,
  };

  try {
    const payload = JSON.stringify(signal, null, 2);
    mkdirSync(join(projectDir, '.gsd'), { recursive: true });
    mkdirSync(join(projectDir, '.planning'), { recursive: true });
    for (const p of waitingPaths) {
      writeFileSync(p, payload, 'utf-8');
    }
    return { data: { signaled: true, path: waitingPaths[0], paths: waitingPaths } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { data: { signaled: false, error: msg } };
  }
};

/**
 * Port of `cmdSignalResume` from state.cjs.
 */
export const stateSignalResume: QueryHandler = async (_args, projectDir, _workstream) => {
  const paths = [
    join(projectDir, '.gsd', 'WAITING.json'),
    join(projectDir, '.planning', 'WAITING.json'),
  ];
  let removed = false;
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        unlinkSync(p);
        removed = true;
      } catch { /* ignore */ }
    }
  }
  return { data: { resumed: true, removed } };
};

// ─── stateValidate ───────────────────────────────────────────────────────

/**
 * Port of `cmdStateValidate` from state.cjs.
 */
export const stateValidate: QueryHandler = async (_args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);
  const statePath = paths.state;
  if (!existsSync(statePath)) {
    return { data: { error: 'STATE.md not found' } };
  }

  const content = await readFile(statePath, 'utf-8');
  const warnings: string[] = [];
  const drift: Record<string, unknown> = {};

  const status = stateExtractField(content, 'Status') || '';
  const currentPhase = stateExtractField(content, 'Current Phase');
  const totalPlansRaw = stateExtractField(content, 'Total Plans in Phase');
  const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;

  const phasesDir = paths.phases;

  if (currentPhase && existsSync(phasesDir)) {
    const normalized = normalizePhaseName(currentPhase.replace(/\s+of\s+\d+.*/, '').trim());
    try {
      const entries = readdirSync(phasesDir, { withFileTypes: true });
      const phaseDir = entries.find(
        e => e.isDirectory() && phaseTokenMatches(e.name, normalized),
      );
      if (phaseDir) {
        const phaseDirPath = join(phasesDir, phaseDir.name);
        const files = readdirSync(phaseDirPath);
        const diskPlans = files.filter(f => /-PLAN\.md$/i.test(f)).length;
        const diskSummaries = files.filter(f => /-SUMMARY\.md$/i.test(f)).length;

        if (totalPlansInPhase !== null && diskPlans !== totalPlansInPhase) {
          warnings.push(
            `Plan count mismatch: STATE.md says ${totalPlansInPhase} plans, disk has ${diskPlans}`,
          );
          drift.plan_count = { state: totalPlansInPhase, disk: diskPlans };
        }

        const verificationFiles = files.filter(f => f.includes('VERIFICATION') && f.endsWith('.md'));
        for (const vf of verificationFiles) {
          try {
            const vContent = readFileSync(join(phaseDirPath, vf), 'utf-8');
            if (/status:\s*passed/i.test(vContent) && /executing/i.test(status)) {
              warnings.push(
                `Status drift: STATE.md says "${status}" but ${vf} shows verification passed — phase may be complete`,
              );
              drift.verification_status = { state_status: status, verification: 'passed' };
            }
          } catch { /* skip */ }
        }

        if (diskPlans > 0 && diskSummaries >= diskPlans && /executing/i.test(status)) {
          if (verificationFiles.length === 0) {
            warnings.push(
              `All ${diskPlans} plans have summaries but status is still "${status}" — phase may be ready for verification`,
            );
          }
        }
      }
    } catch { /* skip */ }
  }

  const valid = warnings.length === 0;
  return { data: { valid, warnings, drift } };
};

// ─── stateSync ─────────────────────────────────────────────────────────────

/**
 * Port of `cmdStateSync` from state.cjs. Supports `--verify` dry-run.
 */
export const stateSync: QueryHandler = async (args, projectDir, workstream) => {
  const verify = args.includes('--verify');
  const paths = planningPaths(projectDir, workstream);
  const statePath = paths.state;
  if (!existsSync(statePath)) {
    return { data: { error: 'STATE.md not found' } };
  }

  const content = await readFile(statePath, 'utf-8');
  const changes: string[] = [];
  const today = new Date().toISOString().split('T')[0];

  const phasesDir = paths.phases;
  if (!existsSync(phasesDir)) {
    return { data: { synced: true, changes: [], dry_run: verify } };
  }

  let entries: string[];
  try {
    entries = readdirSync(phasesDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));
  } catch {
    return { data: { synced: true, changes: [], dry_run: verify } };
  }

  let totalDiskPlans = 0;
  let totalDiskSummaries = 0;
  let highestIncompletePhase: string | null = null;
  let highestIncompletePhaseplanCount = 0;

  for (const dir of entries) {
    const dirPath = join(phasesDir, dir);
    const files = readdirSync(dirPath);
    const plans = files.filter(f => /-PLAN\.md$/i.test(f)).length;
    const summaries = files.filter(f => /-SUMMARY\.md$/i.test(f)).length;
    totalDiskPlans += plans;
    totalDiskSummaries += summaries;

    const phaseMatch = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
    if (phaseMatch && plans > 0 && summaries < plans) {
      highestIncompletePhase = dir;
      highestIncompletePhaseplanCount = plans;
    }
  }

  const runModifier = (modified: string): string => {
    let m = modified;
    if (highestIncompletePhase) {
      const currentPlansField = stateExtractField(m, 'Total Plans in Phase');
      if (currentPlansField && parseInt(currentPlansField, 10) !== highestIncompletePhaseplanCount) {
        changes.push(`Total Plans in Phase: ${currentPlansField} -> ${highestIncompletePhaseplanCount}`);
        const result = stateReplaceField(m, 'Total Plans in Phase', String(highestIncompletePhaseplanCount));
        if (result) m = result;
      }
    }

    const percent = totalDiskPlans > 0 ? Math.min(100, Math.round((totalDiskSummaries / totalDiskPlans) * 100)) : 0;
    const currentProgress = stateExtractField(m, 'Progress');
    if (currentProgress) {
      const currentPercent = parseInt(currentProgress.replace(/[^\d]/g, ''), 10);
      if (currentPercent !== percent) {
        const barWidth = 10;
        const filled = Math.round(percent / 100 * barWidth);
        const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled);
        const progressStr = `[${bar}] ${percent}%`;
        changes.push(`Progress: ${currentProgress} -> ${progressStr}`);
        const result = stateReplaceField(m, 'Progress', progressStr);
        if (result) m = result;
      }
    }

    const oldActivity = stateExtractField(m, 'Last Activity');
    const r = stateReplaceField(m, 'Last Activity', today);
    if (r) {
      if (oldActivity !== today) {
        changes.push(`Last Activity: ${oldActivity} -> ${today}`);
      }
      m = r;
    }
    return m;
  };

  if (verify) {
    const body = stripFrontmatter(content);
    runModifier(body);
    return { data: { synced: false, changes, dry_run: true } };
  }

  await readModifyWriteStateMd(projectDir, (body) => runModifier(body), workstream);

  return { data: { synced: true, changes, dry_run: false } };
};

// ─── statePrune ────────────────────────────────────────────────────────────

/**
 * Parse phase number from a Performance Metrics table data row.
 * Supports `stateRecordMetric` rows (`| Phase 3 P1 | ...`) and legacy `| 3 | ...` rows.
 */
function extractPerformanceMetricsRowPhase(line: string): number | null {
  const phaseNamed = line.match(/^\|\s*Phase\s+(\d+)/i);
  if (phaseNamed) return parseInt(phaseNamed[1], 10);
  const legacy = line.match(/^\|\s*(\d+)\s*\|/);
  if (legacy) return parseInt(legacy[1], 10);
  return null;
}

interface PruneSection {
  section: string;
  count: number;
  lines: string[];
}

/**
 * Port of inner `prunePass` from state.cjs — mutates content string for sections
 * older than `cutoff` phase number.
 */
function prunePass(content: string, cutoff: number): { newContent: string; archivedSections: PruneSection[] } {
  const archivedSections: PruneSection[] = [];
  let contentWork = content;

  const decisionPattern = /(###?\s*(?:Decisions|Decisions Made|Accumulated.*Decisions)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const decMatch = contentWork.match(decisionPattern);
  if (decMatch) {
    const lines = decMatch[2].split('\n');
    const keep: string[] = [];
    const archive: string[] = [];
    for (const line of lines) {
      const pm = line.match(/^\s*-\s*\[Phase\s+(\d+)/i);
      if (pm && parseInt(pm[1], 10) <= cutoff) {
        archive.push(line);
      } else {
        keep.push(line);
      }
    }
    if (archive.length > 0) {
      archivedSections.push({ section: 'Decisions', count: archive.length, lines: archive });
      contentWork = contentWork.replace(decisionPattern, (_m, header: string) => `${header}${keep.join('\n')}`);
    }
  }

  const recentPattern = /(###?\s*Recently Completed\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const recMatch = contentWork.match(recentPattern);
  if (recMatch) {
    const lines = recMatch[2].split('\n');
    const keep: string[] = [];
    const archive: string[] = [];
    for (const line of lines) {
      const pm = line.match(/Phase\s+(\d+)/i);
      if (pm && parseInt(pm[1], 10) <= cutoff) {
        archive.push(line);
      } else {
        keep.push(line);
      }
    }
    if (archive.length > 0) {
      archivedSections.push({ section: 'Recently Completed', count: archive.length, lines: archive });
      contentWork = contentWork.replace(recentPattern, (_m, header: string) => `${header}${keep.join('\n')}`);
    }
  }

  const blockersPattern = /(###?\s*(?:Blockers|Blockers\/Concerns|Blockers\s*&\s*Concerns)\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const blockersMatch = contentWork.match(blockersPattern);
  if (blockersMatch) {
    const lines = blockersMatch[2].split('\n');
    const keep: string[] = [];
    const archive: string[] = [];
    for (const line of lines) {
      const isResolved = /~~.*~~|\[RESOLVED\]/i.test(line);
      const pm = line.match(/Phase\s+(\d+)/i);
      if (isResolved && pm && parseInt(pm[1], 10) <= cutoff) {
        archive.push(line);
      } else {
        keep.push(line);
      }
    }
    if (archive.length > 0) {
      archivedSections.push({ section: 'Blockers (resolved)', count: archive.length, lines: archive });
      contentWork = contentWork.replace(blockersPattern, (_m, header: string) => `${header}${keep.join('\n')}`);
    }
  }

  const metricsPattern = /(###?\s*Performance Metrics\s*\n)([\s\S]*?)(?=\n###?|\n##[^#]|$)/i;
  const metricsMatch = contentWork.match(metricsPattern);
  if (metricsMatch) {
    const sectionLines = metricsMatch[2].split('\n');
    const keep: string[] = [];
    const archive: string[] = [];
    for (const line of sectionLines) {
      const rowPhase = extractPerformanceMetricsRowPhase(line);
      if (rowPhase !== null) {
        if (rowPhase <= cutoff) {
          archive.push(line);
        } else {
          keep.push(line);
        }
      } else {
        keep.push(line);
      }
    }
    if (archive.length > 0) {
      archivedSections.push({ section: 'Performance Metrics', count: archive.length, lines: archive });
      contentWork = contentWork.replace(metricsPattern, (_m, header: string) => `${header}${keep.join('\n')}`);
    }
  }

  return { newContent: contentWork, archivedSections };
}

/**
 * Port of `cmdStatePrune` from state.cjs.
 * Args: `--keep-recent N` (default 3), `--dry-run`, `--silent` (omit extra logging fields — no-op in SDK JSON).
 */
export const statePrune: QueryHandler = async (args, projectDir, workstream) => {
  const parsed = parseNamedArgs(args, ['keep-recent'], ['dry-run', 'silent']);
  const parsedKeepRecent = Number.parseInt(String(parsed['keep-recent'] ?? '3'), 10);
  if (!Number.isInteger(parsedKeepRecent) || parsedKeepRecent < 0) {
    return { data: { error: 'keep-recent must be a non-negative integer' } };
  }
  const keepRecent = parsedKeepRecent;
  const dryRun = parsed['dry-run'] === true;

  const paths = planningPaths(projectDir, workstream);
  const statePath = paths.state;
  if (!existsSync(statePath)) {
    return { data: { error: 'STATE.md not found' } };
  }

  const fullContent = await readFile(statePath, 'utf-8');
  const currentPhaseRaw = stateExtractField(fullContent, 'Current Phase');
  const currentPhase = parseInt(String(currentPhaseRaw ?? ''), 10) || 0;
  const cutoff = currentPhase - keepRecent;

  if (cutoff <= 0) {
    return {
      data: {
        pruned: false,
        reason: `Only ${currentPhase} phases — nothing to prune with --keep-recent ${keepRecent}`,
      },
    };
  }

  const body = stripFrontmatter(fullContent);

  if (dryRun) {
    const result = prunePass(body, cutoff);
    const totalPruned = result.archivedSections.reduce((sum, s) => sum + s.count, 0);
    return {
      data: {
        pruned: false,
        dry_run: true,
        cutoff_phase: cutoff,
        keep_recent: keepRecent,
        sections: result.archivedSections.map(s => ({
          section: s.section,
          entries_would_archive: s.count,
        })),
        total_would_archive: totalPruned,
        note: totalPruned > 0 ? 'Run without --dry-run to actually prune' : 'Nothing to prune',
      },
    };
  }

  const archived: PruneSection[] = [];

  await readModifyWriteStateMd(projectDir, (b) => {
    const result = prunePass(b, cutoff);
    archived.push(...result.archivedSections);
    return result.newContent;
  }, workstream);

  const archivePath = join(paths.planning, 'STATE-ARCHIVE.md');
  const totalPruned = archived.reduce((sum, s) => sum + s.count, 0);

  if (archived.length > 0) {
    const timestamp = new Date().toISOString().split('T')[0];
    let archiveContent = '';
    if (existsSync(archivePath)) {
      archiveContent = readFileSync(archivePath, 'utf-8');
    } else {
      archiveContent = '# STATE Archive\n\nPruned entries from STATE.md. Recoverable but no longer loaded into agent context.\n\n';
    }
    archiveContent += `## Pruned ${timestamp} (phases 1-${cutoff}, kept recent ${keepRecent})\n\n`;
    for (const section of archived) {
      archiveContent += `### ${section.section}\n\n${section.lines.join('\n')}\n\n`;
    }
    writeFileSync(archivePath, archiveContent, 'utf-8');
  }

  return {
    data: {
      pruned: totalPruned > 0,
      cutoff_phase: cutoff,
      keep_recent: keepRecent,
      sections: archived.map(s => ({ section: s.section, entries_archived: s.count })),
      total_archived: totalPruned,
      archive_file: totalPruned > 0 ? 'STATE-ARCHIVE.md' : null,
    },
  };
};