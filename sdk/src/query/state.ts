/**
 * State query handlers — STATE.md loading, field extraction, and snapshots.
 *
 * Ported from get-shit-done/bin/lib/state.cjs and core.cjs.
 * Provides `state json` / `state.json` (rebuilt frontmatter JSON, `stateJson`), `state.get`
 * (field/section extraction), and state-snapshot (structured snapshot).
 *
 * @example
 * ```typescript
 * import { stateJson, stateGet, stateSnapshot } from './state.js';
 *
 * const loaded = await stateJson([], '/project');
 * // { data: { gsd_state_version: '1.0', milestone: 'v3.0', ... } }
 *
 * const field = await stateGet(['Status'], '/project');
 * // { data: { Status: 'executing' } }
 *
 * const snap = await stateSnapshot([], '/project');
 * // { data: { current_phase: '10', status: 'executing', decisions: [...], ... } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { extractFrontmatter, stripFrontmatter } from './frontmatter.js';
import { stateExtractField, planningPaths, escapeRegex } from './helpers.js';
import { getMilestoneInfo, extractCurrentMilestone } from './roadmap.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Build a filter function that checks if a phase directory belongs to the current milestone.
 *
 * Port of getMilestonePhaseFilter from core.cjs lines 1409-1442.
 */
export async function getMilestonePhaseFilter(projectDir: string, workstream?: string): Promise<((dirName: string) => boolean) & { phaseCount: number }> {
  const milestonePhaseNums = new Set<string>();
  try {
    const roadmapContent = await readFile(planningPaths(projectDir, workstream).roadmap, 'utf-8');
    const roadmap = await extractCurrentMilestone(roadmapContent, projectDir, workstream);
    const phasePattern = /#{2,4}\s*Phase\s+([\w][\w.-]*)\s*:/gi;
    let m: RegExpExecArray | null;
    while ((m = phasePattern.exec(roadmap)) !== null) {
      milestonePhaseNums.add(m[1]);
    }
  } catch { /* intentionally empty */ }

  if (milestonePhaseNums.size === 0) {
    const passAllFn = (_dirName: string): boolean => true;
    const passAll = passAllFn as typeof passAllFn & { phaseCount: number };
    passAll.phaseCount = 0;
    return passAll;
  }

  const normalized = new Set<string>(
    [...milestonePhaseNums].map(n => (n.replace(/^0+/, '') || '0').toLowerCase())
  );

  const isDirInMilestone = ((dirName: string): boolean => {
    // Try numeric match first
    const m = dirName.match(/^0*(\d+[A-Za-z]?(?:\.\d+)*)/);
    if (m && normalized.has(m[1].toLowerCase())) return true;
    // Try custom ID match
    const customMatch = dirName.match(/^([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*)/);
    if (customMatch && normalized.has(customMatch[1].toLowerCase())) return true;
    return false;
  }) as ((dirName: string) => boolean) & { phaseCount: number };

  isDirInMilestone.phaseCount = milestonePhaseNums.size;
  return isDirInMilestone;
}

/**
 * Build state frontmatter from STATE.md body content and disk scanning.
 *
 * Port of buildStateFrontmatter from state.cjs lines 650-760.
 * HIGH complexity: extracts fields, scans disk, computes progress.
 */
export async function buildStateFrontmatter(bodyContent: string, projectDir: string, workstream?: string): Promise<Record<string, unknown>> {
  const currentPhase = stateExtractField(bodyContent, 'Current Phase');
  const currentPhaseName = stateExtractField(bodyContent, 'Current Phase Name');
  const currentPlan = stateExtractField(bodyContent, 'Current Plan');
  const totalPhasesRaw = stateExtractField(bodyContent, 'Total Phases');
  const totalPlansRaw = stateExtractField(bodyContent, 'Total Plans in Phase');
  const status = stateExtractField(bodyContent, 'Status');
  const progressRaw = stateExtractField(bodyContent, 'Progress');
  const lastActivity = stateExtractField(bodyContent, 'Last Activity');
  const stoppedAt = stateExtractField(bodyContent, 'Stopped At') || stateExtractField(bodyContent, 'Stopped at');
  const pausedAt = stateExtractField(bodyContent, 'Paused At');

  // Bug #2613: read existing STATE.md frontmatter as preservation backstop.
  // The write path through `readModifyWriteStateMd` strips frontmatter before
  // invoking the modifier, so callers of `buildStateFrontmatter` only see the
  // body. Without reading frontmatter here, status defaults to 'unknown' when
  // body has no Status field, and progress is stomped to 0/0 when the current
  // milestone's phase directories have been archived. Matches the #2495 READ
  // pattern: STATE.md is authoritative, re-derive only when absent.
  let existingFm: Record<string, unknown> = {};
  try {
    const raw = await readFile(planningPaths(projectDir, workstream).state, 'utf-8');
    existingFm = extractFrontmatter(raw);
  } catch { /* STATE.md missing on first write — no preservation needed */ }

  let milestone: string | null = null;
  let milestoneName: string | null = null;
  try {
    const info = await getMilestoneInfo(projectDir, workstream);
    milestone = info.version;
    milestoneName = info.name;
  } catch { /* intentionally empty */ }

  let totalPhases: number | null = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  let completedPhases: number | null = null;
  let totalPlans: number | null = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  let completedPlans: number | null = null;

  try {
    const phasesDir = planningPaths(projectDir, workstream).phases;
    const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const phaseDirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .filter(isDirInMilestone);

    let diskTotalPlans = 0;
    let diskTotalSummaries = 0;
    let diskCompletedPhases = 0;

    for (const dir of phaseDirs) {
      const files = await readdir(join(phasesDir, dir));
      const plans = files.filter(f => /-PLAN\.md$/i.test(f)).length;
      const summaries = files.filter(f => /-SUMMARY\.md$/i.test(f)).length;
      diskTotalPlans += plans;
      diskTotalSummaries += summaries;
      if (plans > 0 && summaries >= plans) diskCompletedPhases++;
    }

    totalPhases = isDirInMilestone.phaseCount > 0
      ? Math.max(phaseDirs.length, isDirInMilestone.phaseCount)
      : phaseDirs.length;
    completedPhases = diskCompletedPhases;
    totalPlans = diskTotalPlans;
    completedPlans = diskTotalSummaries;
  } catch { /* intentionally empty */ }

  // Derive percent from disk counts (ground truth)
  let progressPercent: number | null = null;
  if (totalPlans !== null && totalPlans > 0 && completedPlans !== null) {
    progressPercent = Math.min(100, Math.round(completedPlans / totalPlans * 100));
  } else if (progressRaw) {
    const pctMatch = progressRaw.match(/(\d+)%/);
    if (pctMatch) progressPercent = parseInt(pctMatch[1], 10);
  }

  // Normalize status
  let normalizedStatus = status || 'unknown';
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('paused') || statusLower.includes('stopped') || pausedAt) {
    normalizedStatus = 'paused';
  } else if (statusLower.includes('executing') || statusLower.includes('in progress')) {
    normalizedStatus = 'executing';
  } else if (statusLower.includes('planning') || statusLower.includes('ready to plan')) {
    normalizedStatus = 'planning';
  } else if (statusLower.includes('discussing')) {
    normalizedStatus = 'discussing';
  } else if (statusLower.includes('verif')) {
    normalizedStatus = 'verifying';
  } else if (statusLower.includes('complete') || statusLower.includes('done')) {
    normalizedStatus = 'completed';
  } else if (statusLower.includes('ready to execute')) {
    normalizedStatus = 'executing';
  }

  // Bug #2613: status preservation — if body has no Status field and existing
  // frontmatter has a non-unknown status, prefer existing.
  if (normalizedStatus === 'unknown' && typeof existingFm.status === 'string' && existingFm.status && existingFm.status !== 'unknown') {
    normalizedStatus = existingFm.status;
  }

  const fm: Record<string, unknown> = { gsd_state_version: '1.0' };

  if (milestone) fm.milestone = milestone;
  if (milestoneName) fm.milestone_name = milestoneName;
  if (currentPhase) fm.current_phase = currentPhase;
  if (currentPhaseName) fm.current_phase_name = currentPhaseName;
  if (currentPlan) fm.current_plan = currentPlan;
  fm.status = normalizedStatus;
  if (stoppedAt) fm.stopped_at = stoppedAt;
  if (pausedAt) fm.paused_at = pausedAt;
  fm.last_updated = new Date().toISOString();
  if (lastActivity) fm.last_activity = lastActivity;

  const progress: Record<string, unknown> = {};
  if (totalPhases !== null) progress.total_phases = totalPhases;
  if (completedPhases !== null) progress.completed_phases = completedPhases;
  if (totalPlans !== null) progress.total_plans = totalPlans;
  if (completedPlans !== null) progress.completed_plans = completedPlans;
  if (progressPercent !== null) progress.percent = progressPercent;
  if (Object.keys(progress).length > 0) fm.progress = progress;

  // Bug #2613: progress preservation — when disk scan returns zero counts
  // (archived/shipped milestone) and existing frontmatter has non-zero counts,
  // prefer existing. Legitimate mid-milestone updates see non-zero disk counts
  // and fall through, keeping disk as ground truth.
  const existingProgress = existingFm.progress as Record<string, unknown> | undefined;
  if (existingProgress && typeof existingProgress === 'object') {
    const derivedTotalPlans = Number(progress.total_plans ?? 0);
    const derivedCompletedPlans = Number(progress.completed_plans ?? 0);
    const existingTotalPlans = Number(existingProgress.total_plans ?? 0);
    if (derivedTotalPlans === 0 && derivedCompletedPlans === 0 && existingTotalPlans > 0) {
      fm.progress = existingProgress;
    }
  }

  return fm;
}

// ─── Exported handlers ─────────────────────────────────────────────────────

/**
 * Query handler for `state json` / `state.json` (CJS `cmdStateJson`).
 *
 * Reads STATE.md, rebuilds frontmatter from body + disk scanning.
 * Returns cached frontmatter-only fields (stopped_at, paused_at) when not in body.
 *
 * Port of cmdStateJson from state.cjs lines 872-901.
 *
 * @param args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with rebuilt state frontmatter
 */
export const stateJson: QueryHandler = async (_args, projectDir, workstream) => {
  const statePath = planningPaths(projectDir, workstream).state;

  let content: string;
  try {
    content = await readFile(statePath, 'utf-8');
  } catch {
    return { data: { error: 'STATE.md not found' } };
  }

  const existingFm = extractFrontmatter(content);
  const body = stripFrontmatter(content);

  // Always rebuild from body + disk so progress reflects current state
  const built = await buildStateFrontmatter(body, projectDir, workstream);

  // Preserve frontmatter-only fields that cannot be recovered from body
  if (existingFm && existingFm.stopped_at && !built.stopped_at) {
    built.stopped_at = existingFm.stopped_at;
  }
  if (existingFm && existingFm.paused_at && !built.paused_at) {
    built.paused_at = existingFm.paused_at;
  }

  // Preserve existing non-unknown status when body-derived is 'unknown'
  if (built.status === 'unknown' && existingFm && existingFm.status && existingFm.status !== 'unknown') {
    built.status = existingFm.status;
  }

  return { data: built };
};

/**
 * Query handler for state.get.
 *
 * Reads STATE.md and extracts a specific field or section.
 * Returns full content when no field specified.
 *
 * Port of cmdStateGet from state.cjs lines 72-113.
 *
 * @param args - args[0] is optional field/section name
 * @param projectDir - Project root directory
 * @returns QueryResult with field value or full content
 */
export const stateGet: QueryHandler = async (args, projectDir, workstream) => {
  const statePath = planningPaths(projectDir, workstream).state;

  let content: string;
  try {
    content = await readFile(statePath, 'utf-8');
  } catch {
    return { data: { error: 'STATE.md not found' } };
  }

  const section = args[0];
  if (!section) {
    return { data: { content } };
  }

  const fieldEscaped = escapeRegex(section);

  // Check for **field:** value (bold format)
  const boldPattern = new RegExp(`\\*\\*${fieldEscaped}:\\*\\*\\s*(.*)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) {
    return { data: { [section]: boldMatch[1].trim() } };
  }

  // Check for field: value (plain format)
  const plainPattern = new RegExp(`^${fieldEscaped}:\\s*(.*)`, 'im');
  const plainMatch = content.match(plainPattern);
  if (plainMatch) {
    return { data: { [section]: plainMatch[1].trim() } };
  }

  // Check for ## Section
  const sectionPattern = new RegExp(`##\\s*${fieldEscaped}\\s*\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
  const sectionMatch = content.match(sectionPattern);
  if (sectionMatch) {
    return { data: { [section]: sectionMatch[1].trim() } };
  }

  return { data: { error: `Section or field "${section}" not found` } };
};

/**
 * Query handler for state-snapshot.
 *
 * Returns a structured snapshot of project state with decisions, blockers, and session.
 *
 * Port of cmdStateSnapshot from state.cjs lines 546-641.
 *
 * @param args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with structured snapshot
 */
export const stateSnapshot: QueryHandler = async (_args, projectDir, workstream) => {
  const statePath = planningPaths(projectDir, workstream).state;

  let content: string;
  try {
    content = await readFile(statePath, 'utf-8');
  } catch {
    return { data: { error: 'STATE.md not found' } };
  }

  // Extract basic fields
  const currentPhase = stateExtractField(content, 'Current Phase');
  const currentPhaseName = stateExtractField(content, 'Current Phase Name');
  const totalPhasesRaw = stateExtractField(content, 'Total Phases');
  const currentPlan = stateExtractField(content, 'Current Plan');
  const totalPlansRaw = stateExtractField(content, 'Total Plans in Phase');
  const status = stateExtractField(content, 'Status');
  const progressRaw = stateExtractField(content, 'Progress');
  const lastActivity = stateExtractField(content, 'Last Activity');
  const lastActivityDesc = stateExtractField(content, 'Last Activity Description');
  const pausedAt = stateExtractField(content, 'Paused At');

  // Parse numeric fields
  const totalPhases = totalPhasesRaw ? parseInt(totalPhasesRaw, 10) : null;
  const totalPlansInPhase = totalPlansRaw ? parseInt(totalPlansRaw, 10) : null;
  // Match gsd-tools `cmdStateSnapshot` (state.cjs): parseInt(progressRaw.replace('%',''), 10) — NaN → null
  let progressPercent: number | null = null;
  if (progressRaw) {
    const n = parseInt(progressRaw.replace(/%/g, ''), 10);
    progressPercent = Number.isFinite(n) ? n : null;
  }

  // Extract decisions table
  const decisions: Array<{ phase: string; summary: string; rationale: string }> = [];
  const decisionsMatch = content.match(/##\s*Decisions Made[\s\S]*?\n\|[^\n]+\n\|[-|\s]+\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (decisionsMatch) {
    const tableBody = decisionsMatch[1];
    const rows = tableBody.trim().split('\n').filter(r => r.includes('|'));
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        decisions.push({
          phase: cells[0],
          summary: cells[1],
          rationale: cells[2],
        });
      }
    }
  }

  // Extract blockers list
  const blockers: string[] = [];
  const blockersMatch = content.match(/##\s*Blockers\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (blockersMatch) {
    const blockersSection = blockersMatch[1];
    const items = blockersSection.match(/^-\s+(.+)$/gm) || [];
    for (const item of items) {
      blockers.push(item.replace(/^-\s+/, '').trim());
    }
  }

  // Extract session info
  const session: { last_date: string | null; stopped_at: string | null; resume_file: string | null } = {
    last_date: null,
    stopped_at: null,
    resume_file: null,
  };

  const sessionMatch = content.match(/##\s*Session\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (sessionMatch) {
    const sessionSection = sessionMatch[1];
    const lastDateMatch = sessionSection.match(/\*\*Last Date:\*\*\s*(.+)/i)
      || sessionSection.match(/^Last Date:\s*(.+)/im);
    const stoppedAtMatch = sessionSection.match(/\*\*Stopped At:\*\*\s*(.+)/i)
      || sessionSection.match(/^Stopped At:\s*(.+)/im);
    const resumeFileMatch = sessionSection.match(/\*\*Resume File:\*\*\s*(.+)/i)
      || sessionSection.match(/^Resume File:\s*(.+)/im);

    if (lastDateMatch) session.last_date = lastDateMatch[1].trim();
    if (stoppedAtMatch) session.stopped_at = stoppedAtMatch[1].trim();
    if (resumeFileMatch) session.resume_file = resumeFileMatch[1].trim();
  }

  const result = {
    current_phase: currentPhase,
    current_phase_name: currentPhaseName,
    total_phases: totalPhases,
    current_plan: currentPlan,
    total_plans_in_phase: totalPlansInPhase,
    status,
    progress_percent: progressPercent,
    last_activity: lastActivity,
    last_activity_desc: lastActivityDesc,
    decisions,
    blockers,
    paused_at: pausedAt,
    session,
  };

  return { data: result };
};
