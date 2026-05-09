/**
 * Phase lifecycle handlers — add, insert, scaffold operations.
 *
 * Ported from get-shit-done/bin/lib/phase.cjs and commands.cjs.
 * Provides phaseAdd (append phase), phaseAddBatch (append multiple phases),
 * phaseInsert (decimal phase insertion), and phaseScaffold (template file/directory creation).
 *
 * Shared helpers replaceInCurrentMilestone and readModifyWriteRoadmapMd
 * are exported for use by downstream handlers (phaseComplete in Plan 03).
 *
 * @example
 * ```typescript
 * import { phaseAdd, phaseInsert, phaseScaffold } from './phase-lifecycle.js';
 *
 * await phaseAdd(['New Feature'], '/project');
 * await phaseInsert(['10', 'Urgent Fix'], '/project');
 * await phaseScaffold(['context', '9'], '/project');
 * ```
 */

import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import {
  escapeRegex,
  normalizeMd,
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  planningPaths,
  stateExtractField,
} from './helpers.js';
import { extractFrontmatter } from './frontmatter.js';
import { extractCurrentMilestone } from './roadmap.js';
import { getMilestonePhaseFilter } from './state.js';
import {
  acquireStateLock,
  readModifyWriteStateMdFull,
  releaseStateLock,
  stateReplaceField,
} from './state-mutation.js';
import type { QueryHandler } from './utils.js';

// ─── Null byte validation ────────────────────────────────────────────────

/** Reject strings containing null bytes (path traversal defense). */
function assertNoNullBytes(value: string, label: string): void {
  if (value.includes('\0')) {
    throw new GSDError(`${label} contains null byte`, ErrorClassification.Validation);
  }
}

/** Reject `..` or path separators in phase directory names. */
function assertSafePhaseDirName(dirName: string, label = 'phase directory'): void {
  if (/[/\\]|\.\./.test(dirName)) {
    throw new GSDError(`${label} contains invalid path segments`, ErrorClassification.Validation);
  }
}

function assertSafeProjectCode(code: string): void {
  if (code && /[/\\]|\.\./.test(code)) {
    throw new GSDError('project_code contains invalid characters', ErrorClassification.Validation);
  }
}

// ─── Slug generation (inline) ────────────────────────────────────────────

/** Generate kebab-case slug from description. Port of generateSlugInternal. */
function generateSlugInternal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

// ─── replaceInCurrentMilestone ──────────────────────────────────────────

/**
 * Replace a pattern only in the current milestone section of ROADMAP.md.
 *
 * Port of replaceInCurrentMilestone from core.cjs line 1197-1206.
 * If no `</details>` blocks exist, replaces in the entire content.
 * Otherwise, only replaces in content after the last `</details>` close tag.
 *
 * Edge case: when the active milestone is itself wrapped in a `<details>` block
 * (e.g. collapsed before it is fully shipped), the last `</details>` belongs to
 * the active milestone and the `after` slice is empty. In that case the function
 * falls back to searching the full content with all complete `<details>` blocks
 * stripped, so archived milestones are never touched.
 *
 * @param content - Full ROADMAP.md content
 * @param pattern - Regex or string pattern to match
 * @param replacement - Replacement string
 * @returns Modified content
 */
export function replaceInCurrentMilestone(
  content: string,
  pattern: string | RegExp,
  replacement: string,
): string {
  const lastDetailsClose = content.lastIndexOf('</details>');
  if (lastDetailsClose === -1) {
    return content.replace(pattern, replacement);
  }
  const offset = lastDetailsClose + '</details>'.length;
  const before = content.slice(0, offset);
  const after = content.slice(offset);

  // Fast path: the current milestone is not inside a <details> block — the
  // pattern lives in the plain text after the last </details>.
  const replacedAfter = after.replace(pattern, replacement);
  if (replacedAfter !== after) {
    return before + replacedAfter;
  }

  // Slow path: the active milestone is inside the last <details> block.
  // Strip every complete <details>…</details> block except the last one, then
  // apply the replacement inside that last block while leaving the stripped
  // (archived) blocks untouched.
  //
  // Strategy:
  //   1. Collect all complete <details>…</details> spans.
  //   2. Replace only inside the LAST span; leave earlier spans unchanged.
  const detailsBlockRe = /<details>[\s\S]*?<\/details>/gi;
  const spans: { start: number; end: number; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = detailsBlockRe.exec(content)) !== null) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] });
  }

  if (spans.length === 0) {
    // No complete blocks found — fall back to full-content replace.
    return content.replace(pattern, replacement);
  }

  const lastSpan = spans[spans.length - 1];
  const updatedLastBlock = lastSpan.text.replace(pattern, replacement);
  return (
    content.slice(0, lastSpan.start) +
    updatedLastBlock +
    content.slice(lastSpan.end)
  );
}

// ─── readModifyWriteRoadmapMd ───────────────────────────────────────────

/**
 * Atomic read-modify-write for ROADMAP.md.
 *
 * Holds a lockfile across the entire read -> transform -> write cycle.
 * Uses the same acquireStateLock/releaseStateLock mechanism as STATE.md
 * but with a ROADMAP.md-specific lock path.
 *
 * @param projectDir - Project root directory
 * @param modifier - Function to transform ROADMAP.md content
 * @returns The final written content
 */
export async function readModifyWriteRoadmapMd(
  projectDir: string,
  modifier: (content: string) => string | Promise<string>,
  workstream?: string,
): Promise<string> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  const lockPath = await acquireStateLock(roadmapPath);
  try {
    let content: string;
    try {
      content = await readFile(roadmapPath, 'utf-8');
    } catch {
      content = '';
    }
    const modified = await modifier(content);
    await writeFile(roadmapPath, modified, 'utf-8');
    return modified;
  } finally {
    await releaseStateLock(lockPath);
  }
}

// ─── phaseAdd handler ───────────────────────────────────────────────────

/**
 * Query handler for phase.add.
 *
 * Port of cmdPhaseAdd from phase.cjs lines 312-392.
 * Creates a new phase directory with .gitkeep, appends a phase section
 * to ROADMAP.md before the last "---" separator.
 *
 * @param args - description (required), optional customId, optional --dry-run flag.
 *   Recognized flags: --dry-run (compute result without writing to disk).
 *   Any other --flag argument is rejected with a validation error.
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, padded, name, slug, directory, naming_mode }
 *   In --dry-run mode also includes { dry_run: true, roadmap_entry: string }
 */
export const phaseAdd: QueryHandler = async (args, projectDir, workstream) => {
  // ── Flag parsing ────────────────────────────────────────────────────────
  // Separate recognized flags from positional args. Any unrecognized --flag
  // is rejected immediately so it is never silently absorbed into positional slots.
  const RECOGNIZED_FLAGS = new Set(['--dry-run']);
  let dryRun = false;
  const positional: string[] = [];

  for (const arg of args) {
    if (arg.startsWith('--')) {
      if (!RECOGNIZED_FLAGS.has(arg)) {
        throw new GSDError(
          `Unknown flag ${arg} for phase.add`,
          ErrorClassification.Validation,
        );
      }
      if (arg === '--dry-run') dryRun = true;
    } else {
      positional.push(arg);
    }
  }

  const description = positional[0];
  if (!description) {
    throw new GSDError('description required for phase add', ErrorClassification.Validation);
  }
  assertNoNullBytes(description, 'description');

  const configPath = planningPaths(projectDir, workstream).config;
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8'));
  } catch { /* use defaults */ }

  const slug = generateSlugInternal(description);
  // positional[1] is the optional customId — flags are already stripped
  const customId = positional[1] || null;

  // Optional project code prefix (e.g., 'CK' -> 'CK-01-foundation')
  const projectCode = (config.project_code as string) || '';
  assertSafeProjectCode(projectCode);
  const prefix = projectCode ? `${projectCode}-` : '';

  // ── Helper: compute newPhaseId / dirName / computedPhaseEntry from raw ROADMAP content ──
  // Extracted as a local async function so it can be called both inside the
  // roadmap lock (non-dry-run) and outside (dry-run, where no write occurs and
  // there is no race condition to guard against).
  const computePhaseFields = async (rawRoadmapContent: string) => {
    const milestoneContent = await extractCurrentMilestone(rawRoadmapContent, projectDir);

    let resolvedPhaseId: number | string = '';
    let resolvedDirName = '';

    if (customId || config.phase_naming === 'custom') {
      // Custom phase naming
      resolvedPhaseId = customId || slug.toUpperCase().replace(/-/g, '_');
      if (!resolvedPhaseId) {
        throw new GSDError('--id required when phase_naming is "custom"', ErrorClassification.Validation);
      }
      assertSafePhaseDirName(String(resolvedPhaseId), 'custom phase id');
      resolvedDirName = `${prefix}${resolvedPhaseId}-${slug}`;
    } else {
      // Sequential mode: find highest integer phase number (in current milestone only)
      // Skip 999.x backlog phases — they live outside the active sequence
      // Matches heading (## Phase N:), bullet checklist (- [x] Phase N:), and bold (**Phase N:**)
      const phasePattern = /(?:^|\n)\s*(?:[-*]\s*(?:\[[x ]\]\s*)?|#{2,4}\s*|\*{1,2}\s*)Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
      let maxPhase = 0;
      let m: RegExpExecArray | null;
      while ((m = phasePattern.exec(milestoneContent)) !== null) {
        const num = parseInt(m[1], 10);
        if (num >= 999) continue; // backlog phases use 999.x numbering
        if (num > maxPhase) maxPhase = num;
      }

      // Also scan on-disk phase directories (union semantics) — ROADMAP and disk
      // may diverge temporarily (e.g. a previous run created the dir but didn't
      // update ROADMAP). Taking the max of both sources prevents collisions.
      const phasesDir = planningPaths(projectDir, workstream).phases;
      try {
        const entries = await readdir(phasesDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const dirMatch = /^(?:[A-Z][A-Z0-9]*-)?(\d+)[A-Z]?(?:\.\d+)*-/i.exec(entry.name);
          if (!dirMatch) continue;
          const num = parseInt(dirMatch[1], 10);
          if (num >= 999) continue;
          if (num > maxPhase) maxPhase = num;
        }
      } catch {
        // phases dir may not exist yet — leave maxPhase as 0
      }

      resolvedPhaseId = maxPhase + 1;
      const paddedNum = String(resolvedPhaseId).padStart(2, '0');
      resolvedDirName = `${prefix}${paddedNum}-${slug}`;
    }

    assertSafePhaseDirName(resolvedDirName);

    if (!resolvedDirName) {
      throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);
    }
    if (resolvedPhaseId === '') {
      throw new GSDError('Phase ID was not computed', ErrorClassification.Execution);
    }

    const dependsOn = config.phase_naming === 'custom'
      ? ''
      : `\n**Depends on:** Phase ${typeof resolvedPhaseId === 'number' ? resolvedPhaseId - 1 : 'TBD'}`;
    const resolvedEntry = `\n### Phase ${resolvedPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${resolvedPhaseId} to break down)\n`;

    return { resolvedPhaseId, resolvedDirName, resolvedEntry };
  };

  let newPhaseId: number | string = '';
  let dirName = '';
  let computedPhaseEntry = '';

  if (dryRun) {
    // Dry-run: no write, no race condition — compute outside the lock.
    const roadmapPath = planningPaths(projectDir, workstream).roadmap;
    let rawRoadmapContent = '';
    try {
      rawRoadmapContent = await readFile(roadmapPath, 'utf-8');
    } catch { /* ROADMAP.md may not exist yet */ }

    const { resolvedPhaseId, resolvedDirName, resolvedEntry } = await computePhaseFields(rawRoadmapContent);
    newPhaseId = resolvedPhaseId;
    dirName = resolvedDirName;
    computedPhaseEntry = resolvedEntry;
  } else {
    // Real write path: hold the roadmap lock across the entire read → compute → write
    // cycle so that two concurrent phase.add calls cannot both observe the same
    // maxPhase and produce duplicate phase IDs.
    await readModifyWriteRoadmapMd(projectDir, async (roadmapRaw) => {
      const { resolvedPhaseId, resolvedDirName, resolvedEntry } = await computePhaseFields(roadmapRaw);
      newPhaseId = resolvedPhaseId;
      dirName = resolvedDirName;
      computedPhaseEntry = resolvedEntry;

      const dirPath = join(planningPaths(projectDir, workstream).phases, dirName);

      // Create directory with .gitkeep so git tracks empty folders
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');

      // Find insertion point: before last "---" or at end
      const lastSeparator = roadmapRaw.lastIndexOf('\n---');
      if (lastSeparator > 0) {
        return roadmapRaw.slice(0, lastSeparator) + computedPhaseEntry + roadmapRaw.slice(lastSeparator);
      }
      return roadmapRaw + computedPhaseEntry;
    }, workstream);
  }

  const result: Record<string, unknown> = {
    phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
    padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
    name: description,
    slug,
    directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir, workstream).phases, dirName))),
    naming_mode: config.phase_naming || 'sequential',
  };

  if (dryRun) {
    result.dry_run = true;
    result.roadmap_entry = computedPhaseEntry;
  }

  return { data: result };
};

// ─── phaseAddBatch handler ────────────────────────────────────────────────

/**
 * Query handler for phase.add-batch.
 *
 * Port of cmdPhaseAddBatch from phase.cjs lines 411-478.
 * Appends multiple phases in one locked ROADMAP pass (sequential or custom naming).
 *
 * @param args - Either `--descriptions` followed by a JSON array string, or one description per arg (`--raw` ignored)
 */
export const phaseAddBatch: QueryHandler = async (args, projectDir, workstream) => {
  let descriptions: string[];
  const descIdx = args.indexOf('--descriptions');
  if (descIdx !== -1 && args[descIdx + 1] !== undefined) {
    try {
      const parsed = JSON.parse(args[descIdx + 1]) as unknown;
      if (!Array.isArray(parsed)) {
        throw new GSDError('--descriptions must be a JSON array', ErrorClassification.Validation);
      }
      descriptions = parsed.map((x) => String(x));
    } catch (e) {
      if (e instanceof GSDError) throw e;
      throw new GSDError('--descriptions must be a valid JSON array', ErrorClassification.Validation);
    }
  } else {
    descriptions = args.filter((a) => a !== '--raw');
  }

  if (descriptions.length === 0) {
    throw new GSDError('descriptions array required for phase add-batch', ErrorClassification.Validation);
  }

  for (const d of descriptions) {
    assertNoNullBytes(d, 'description');
    if (!d.trim()) {
      throw new GSDError('description must be non-empty', ErrorClassification.Validation);
    }
  }

  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  if (!existsSync(roadmapPath)) {
    throw new GSDError('ROADMAP.md not found', ErrorClassification.Validation);
  }

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(await readFile(planningPaths(projectDir, workstream).config, 'utf-8'));
  } catch { /* use defaults */ }

  const projectCode = (config.project_code as string) || '';
  assertSafeProjectCode(projectCode);
  const prefix = projectCode ? `${projectCode}-` : '';

  const added: Array<{
    phase_number: string | number;
    padded: string;
    name: string;
    slug: string;
    directory: string;
    naming_mode: unknown;
  }> = [];

  await readModifyWriteRoadmapMd(projectDir, async (initialContent) => {
    let rawContent = initialContent;
    const content = await extractCurrentMilestone(rawContent, projectDir);
    let maxPhase = 0;

    if (config.phase_naming !== 'custom') {
      const phasePattern = /#{2,4}\s*Phase\s+(\d+)[A-Z]?(?:\.\d+)*:/gi;
      let m: RegExpExecArray | null;
      while ((m = phasePattern.exec(content)) !== null) {
        const num = parseInt(m[1], 10);
        if (num >= 999) continue;
        if (num > maxPhase) maxPhase = num;
      }

      const phasesOnDisk = planningPaths(projectDir, workstream).phases;
      if (existsSync(phasesOnDisk)) {
        const entries = await readdir(phasesOnDisk, { withFileTypes: true });
        const dirNumPattern = /^(?:[A-Z][A-Z0-9]*-)?(\d+)-/;
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const match = entry.name.match(dirNumPattern);
          if (!match) continue;
          const num = parseInt(match[1], 10);
          if (num >= 999) continue;
          if (num > maxPhase) maxPhase = num;
        }
      }
    }

    for (const description of descriptions) {
      const slug = generateSlugInternal(description);
      let newPhaseId: number | string;
      let dirName: string;

      if (config.phase_naming === 'custom') {
        // Match CJS cmdPhaseAddBatch: slug.toUpperCase().replace(/-/g, '-') (identity on hyphens)
        newPhaseId = slug.toUpperCase();
        dirName = `${prefix}${newPhaseId}-${slug}`;
      } else {
        maxPhase += 1;
        newPhaseId = maxPhase;
        dirName = `${prefix}${String(newPhaseId).padStart(2, '0')}-${slug}`;
      }

      assertSafePhaseDirName(dirName);
      const dirPath = join(planningPaths(projectDir, workstream).phases, dirName);
      await mkdir(dirPath, { recursive: true });
      await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');

      const dependsOn =
        config.phase_naming === 'custom'
          ? ''
          : `\n**Depends on:** Phase ${typeof newPhaseId === 'number' ? newPhaseId - 1 : 'TBD'}`;
      const phaseEntry = `\n### Phase ${newPhaseId}: ${description}\n\n**Goal:** [To be planned]\n**Requirements**: TBD${dependsOn}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${newPhaseId} to break down)\n`;

      const lastSeparator = rawContent.lastIndexOf('\n---');
      rawContent =
        lastSeparator > 0
          ? rawContent.slice(0, lastSeparator) + phaseEntry + rawContent.slice(lastSeparator)
          : rawContent + phaseEntry;

      added.push({
        phase_number: typeof newPhaseId === 'number' ? newPhaseId : String(newPhaseId),
        padded: typeof newPhaseId === 'number' ? String(newPhaseId).padStart(2, '0') : String(newPhaseId),
        name: description,
        slug,
        directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir, workstream).phases, dirName))),
        naming_mode: config.phase_naming || 'sequential',
      });
    }

    return rawContent;
  }, workstream);

  return { data: { phases: added, count: added.length } };
};

// ─── phaseInsert handler ────────────────────────────────────────────────

/**
 * Query handler for phase.insert.
 *
 * Port of cmdPhaseInsert from phase.cjs lines 394-492.
 * Creates a decimal phase directory after a target phase, inserting
 * the phase section in ROADMAP.md after the target.
 *
 * @param args - args[0]: afterPhase (required), args[1]: description (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase_number, after_phase, name, slug, directory }
 */
export const phaseInsert: QueryHandler = async (args, projectDir, workstream) => {
  const afterPhase = args[0];
  const description = args[1];

  if (!afterPhase || !description) {
    throw new GSDError('after-phase and description required for phase insert', ErrorClassification.Validation);
  }
  assertNoNullBytes(afterPhase, 'afterPhase');
  assertNoNullBytes(description, 'description');

  const slug = generateSlugInternal(description);
  let decimalPhase = '';
  let dirName = '';

  await readModifyWriteRoadmapMd(projectDir, async (rawContent) => {
    const content = await extractCurrentMilestone(rawContent, projectDir);

    // Normalize input then strip leading zeros for flexible matching
    const normalizedAfter = normalizePhaseName(afterPhase);
    const unpadded = normalizedAfter.replace(/^0+/, '');
    const afterPhaseEscaped = unpadded.replace(/\./g, '\\.');
    const targetPattern = new RegExp(`#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:`, 'i');
    if (!targetPattern.test(content)) {
      throw new GSDError(`Phase ${afterPhase} not found in ROADMAP.md`, ErrorClassification.Validation);
    }

    // Calculate next decimal by scanning both directories AND ROADMAP.md entries
    const phasesDir = planningPaths(projectDir, workstream).phases;
    const normalizedBase = normalizePhaseName(afterPhase);
    const decimalSet = new Set<number>();

    try {
      const entries = await readdir(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const decimalPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalizedBase)}\\.(\\d+)`);
      for (const dir of dirs) {
        const dm = dir.match(decimalPattern);
        if (dm) decimalSet.add(parseInt(dm[1], 10));
      }
    } catch { /* intentionally empty */ }

    // Also scan ROADMAP.md content for decimal entries
    const rmPhasePattern = new RegExp(
      `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalizedBase)}\\.(\\d+)\\s*:`, 'gi'
    );
    let rmMatch: RegExpExecArray | null;
    while ((rmMatch = rmPhasePattern.exec(rawContent)) !== null) {
      decimalSet.add(parseInt(rmMatch[1], 10));
    }

    const nextDecimal = decimalSet.size === 0 ? 1 : Math.max(...decimalSet) + 1;
    decimalPhase = `${normalizedBase}.${nextDecimal}`;

    // Optional project code prefix
    let insertConfig: Record<string, unknown> = {};
    try {
      insertConfig = JSON.parse(await readFile(planningPaths(projectDir, workstream).config, 'utf-8'));
    } catch { /* use defaults */ }
    const projectCode = (insertConfig.project_code as string) || '';
    assertSafeProjectCode(projectCode);
    const pfx = projectCode ? `${projectCode}-` : '';
    dirName = `${pfx}${decimalPhase}-${slug}`;
    assertSafePhaseDirName(dirName);
    const dirPath = join(phasesDir, dirName);

    // Create directory with .gitkeep
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');

    // Build phase entry
    const phaseEntry = `\n### Phase ${decimalPhase}: ${description} (INSERTED)\n\n**Goal:** [Urgent work - to be planned]\n**Requirements**: TBD\n**Depends on:** Phase ${afterPhase}\n**Plans:** 0 plans\n\nPlans:\n- [ ] TBD (run /gsd-plan-phase ${decimalPhase} to break down)\n`;

    // Insert after the target phase section
    const headerPattern = new RegExp(`(#{2,4}\\s*Phase\\s+0*${afterPhaseEscaped}:[^\\n]*\\n)`, 'i');
    const headerMatch = rawContent.match(headerPattern);
    if (!headerMatch) {
      throw new GSDError(`Could not find Phase ${afterPhase} header`, ErrorClassification.Execution);
    }

    const headerIdx = rawContent.indexOf(headerMatch[0]);
    const afterHeader = rawContent.slice(headerIdx + headerMatch[0].length);
    const nextPhaseMatch = afterHeader.match(/\n#{2,4}\s+Phase\s+\d/i);

    let insertIdx: number;
    if (nextPhaseMatch && nextPhaseMatch.index !== undefined) {
      insertIdx = headerIdx + headerMatch[0].length + nextPhaseMatch.index;
    } else {
      insertIdx = rawContent.length;
    }

    return rawContent.slice(0, insertIdx) + phaseEntry + rawContent.slice(insertIdx);
  }, workstream);

  if (!decimalPhase) {
    throw new GSDError('Decimal phase was not computed', ErrorClassification.Execution);
  }
  if (!dirName) {
    throw new GSDError('Phase directory name was not computed', ErrorClassification.Execution);
  }

  const result = {
    phase_number: decimalPhase,
    after_phase: afterPhase,
    name: description,
    slug,
    directory: toPosixPath(relative(projectDir, join(planningPaths(projectDir, workstream).phases, dirName))),
  };

  return { data: result };
};

// ─── phaseScaffold handler ──────────────────────────────────────────────

/**
 * Internal helper: find phase directory matching a phase identifier.
 *
 * Reuses the same logic as findPhase handler but returns just the directory info.
 */
async function findPhaseDir(
  projectDir: string,
  phase: string,
  workstream?: string,
): Promise<{ dirPath: string; dirName: string; phaseName: string | null } | null> {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const normalized = normalizePhaseName(phase);

  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) return null;

    // Extract phase name from directory
    const dirMatch = match.match(/^(?:[A-Z]{1,6}-)?\d+[A-Z]?(?:\.\d+)*-(.+)/i);
    const phaseName = dirMatch ? dirMatch[1] : null;

    return {
      dirPath: join(phasesDir, match),
      dirName: match,
      phaseName,
    };
  } catch {
    return null;
  }
}

/**
 * Query handler for phase.scaffold.
 *
 * Port of cmdScaffold from commands.cjs lines 750-806.
 * Creates template files (context, uat, verification) or phase directories.
 *
 * @param args - Positional `[type, phase, name?]` **or** gsd-tools style
 *   `[type, '--phase', N, '--name', title]` (name may be multiple words).
 * @param projectDir - Project root directory
 * @returns QueryResult with { created, path } or { created: false, reason: 'already_exists' }
 */
function normalizeScaffoldArgs(args: string[]): string[] {
  const type = args[0];
  if (!type || !args.includes('--phase')) {
    return args;
  }
  const phaseIdx = args.indexOf('--phase');
  const phase = phaseIdx !== -1 && args[phaseIdx + 1] && !args[phaseIdx + 1].startsWith('--')
    ? args[phaseIdx + 1]
    : '';
  const nameIdx = args.indexOf('--name');
  let name: string | undefined;
  if (nameIdx !== -1) {
    const tail = args.slice(nameIdx + 1);
    const stop = tail.findIndex(a => a.startsWith('--'));
    const parts = stop === -1 ? tail : tail.slice(0, stop);
    name = parts.join(' ').trim() || undefined;
  }
  return [type, phase, ...(name !== undefined && name !== '' ? [name] : [])];
}

export const phaseScaffold: QueryHandler = async (args, projectDir, workstream) => {
  const normalized = normalizeScaffoldArgs(args);
  const type = normalized[0];
  const phase = normalized[1];
  const name = normalized[2] || undefined;

  if (!type) {
    throw new GSDError('type required for scaffold', ErrorClassification.Validation);
  }

  const validTypes = new Set(['context', 'uat', 'verification', 'phase-dir']);
  if (!validTypes.has(type)) {
    throw new GSDError(
      `Unknown scaffold type: ${type}. Available: context, uat, verification, phase-dir`,
      ErrorClassification.Validation,
    );
  }

  if (phase) {
    assertNoNullBytes(phase, 'phase');
  }
  if (name) {
    assertNoNullBytes(name, 'name');
  }

  const padded = phase ? normalizePhaseName(phase) : '00';
  const today = new Date().toISOString().split('T')[0];

  // Handle phase-dir type separately
  if (type === 'phase-dir') {
    if (!phase || !name) {
      throw new GSDError('phase and name required for phase-dir scaffold', ErrorClassification.Validation);
    }
    const slug = generateSlugInternal(name);
    const dirNameNew = `${padded}-${slug}`;
    assertSafePhaseDirName(dirNameNew, 'scaffold phase directory');
    const phasesParent = planningPaths(projectDir, workstream).phases;
    await mkdir(phasesParent, { recursive: true });
    const dirPath = join(phasesParent, dirNameNew);
    await mkdir(dirPath, { recursive: true });
    await writeFile(join(dirPath, '.gitkeep'), '', 'utf-8');
    return {
      data: {
        created: true,
        directory: toPosixPath(relative(projectDir, dirPath)),
        path: dirPath,
      },
    };
  }

  // For context/uat/verification types, find the phase directory
  const phaseInfo = phase ? await findPhaseDir(projectDir, phase, workstream) : null;
  if (phase && !phaseInfo) {
    throw new GSDError(`Phase ${phase} directory not found`, ErrorClassification.Blocked);
  }

  const phaseDir = phaseInfo!.dirPath;
  const phaseName = name || phaseInfo?.phaseName || 'Unnamed';

  let filePath: string;
  let content: string;

  switch (type) {
    case 'context': {
      filePath = join(phaseDir, `${padded}-CONTEXT.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\n---\n\n# Phase ${phase}: ${phaseName} — Context\n\n## Decisions\n\n_Decisions will be captured during /gsd-discuss-phase ${phase}_\n\n## Discretion Areas\n\n_Areas where the executor can use judgment_\n\n## Deferred Ideas\n\n_Ideas to consider later_\n`;
      break;
    }
    case 'uat': {
      filePath = join(phaseDir, `${padded}-UAT.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — User Acceptance Testing\n\n## Test Results\n\n| # | Test | Status | Notes |\n|---|------|--------|-------|\n\n## Summary\n\n_Pending UAT_\n`;
      break;
    }
    case 'verification': {
      filePath = join(phaseDir, `${padded}-VERIFICATION.md`);
      content = `---\nphase: "${padded}"\nname: "${phaseName}"\ncreated: ${today}\nstatus: pending\n---\n\n# Phase ${phase}: ${phaseName} — Verification\n\n## Goal-Backward Verification\n\n**Phase Goal:** [From ROADMAP.md]\n\n## Checks\n\n| # | Requirement | Status | Evidence |\n|---|------------|--------|----------|\n\n## Result\n\n_Pending verification_\n`;
      break;
    }
    default:
      throw new GSDError(`Unknown scaffold type: ${type}`, ErrorClassification.Validation);
  }

  // Check if file already exists
  if (existsSync(filePath)) {
    return {
      data: {
        created: false,
        reason: 'already_exists',
        path: filePath,
      },
    };
  }

  await writeFile(filePath, content, 'utf-8');
  const relPath = toPosixPath(relative(projectDir, filePath));
  return { data: { created: true, path: relPath } };
};

// ─── renameDecimalPhases ───────────────────────────────────────────────

/**
 * Renumber sibling decimal phases after a decimal phase is removed.
 *
 * Port of renameDecimalPhases from phase.cjs lines 499-524.
 * e.g. removing 06.2 -> 06.3 becomes 06.2, 06.4 becomes 06.3, etc.
 * Renames directories AND files inside them that contain the old phase ID.
 *
 * CRITICAL: Sorted in DESCENDING order to avoid rename conflicts.
 *
 * @param phasesDir - Path to the phases directory
 * @param baseInt - The integer part of the decimal phase (e.g. "06")
 * @param removedDecimal - The decimal part that was removed (e.g. 2 for 06.2)
 * @returns { renamedDirs, renamedFiles }
 */
async function renameDecimalPhases(
  phasesDir: string,
  baseInt: string,
  removedDecimal: number,
): Promise<{ renamedDirs: Array<{ from: string; to: string }>; renamedFiles: Array<{ from: string; to: string }> }> {
  const renamedDirs: Array<{ from: string; to: string }> = [];
  const renamedFiles: Array<{ from: string; to: string }> = [];

  const decPattern = new RegExp(`^${escapeRegex(baseInt)}\\.(\\d+)-(.+)$`);
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const toRename = dirs
    .map(dir => {
      const m = dir.match(decPattern);
      return m ? { dir, oldDecimal: parseInt(m[1], 10), slug: m[2] } : null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.oldDecimal > removedDecimal)
    .sort((a, b) => b.oldDecimal - a.oldDecimal); // DESCENDING to avoid conflicts

  for (const item of toRename) {
    const newDecimal = item.oldDecimal - 1;
    const oldPhaseId = `${baseInt}.${item.oldDecimal}`;
    const newPhaseId = `${baseInt}.${newDecimal}`;
    const newDirName = `${baseInt}.${newDecimal}-${item.slug}`;

    await rename(join(phasesDir, item.dir), join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });

    // Rename files inside that contain the old phase ID
    const files = await readdir(join(phasesDir, newDirName));
    for (const f of files) {
      if (f.includes(oldPhaseId)) {
        const newFileName = f.replace(oldPhaseId, newPhaseId);
        await rename(join(phasesDir, newDirName, f), join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }

  return { renamedDirs, renamedFiles };
}

// ─── renameIntegerPhases ───────────────────────────────────────────────

/**
 * Renumber all integer phases after a removed integer phase.
 *
 * Port of renameIntegerPhases from phase.cjs lines 531-564.
 * e.g. removing phase 5 -> phase 6 becomes 5, phase 7 becomes 6, etc.
 * Handles letter suffixes (12A) and decimals (6.1).
 *
 * CRITICAL: Sorted in DESCENDING order to avoid rename conflicts.
 *
 * @param phasesDir - Path to the phases directory
 * @param removedInt - The integer phase number that was removed
 * @returns { renamedDirs, renamedFiles }
 */
async function renameIntegerPhases(
  phasesDir: string,
  removedInt: number,
): Promise<{ renamedDirs: Array<{ from: string; to: string }>; renamedFiles: Array<{ from: string; to: string }> }> {
  const renamedDirs: Array<{ from: string; to: string }> = [];
  const renamedFiles: Array<{ from: string; to: string }> = [];

  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  const toRename = dirs
    .map(dir => {
      const m = dir.match(/^(\d+)([A-Z])?(?:\.(\d+))?-(.+)$/i);
      if (!m) return null;
      const dirInt = parseInt(m[1], 10);
      if (dirInt <= removedInt) return null;
      return {
        dir,
        oldInt: dirInt,
        letter: m[2] ? m[2].toUpperCase() : '',
        decimal: m[3] !== undefined ? parseInt(m[3], 10) : null,
        slug: m[4],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.oldInt !== b.oldInt
      ? b.oldInt - a.oldInt
      : (b.decimal ?? 0) - (a.decimal ?? 0)); // DESCENDING

  for (const item of toRename) {
    const newInt = item.oldInt - 1;
    const newPadded = String(newInt).padStart(2, '0');
    const oldPadded = String(item.oldInt).padStart(2, '0');
    const letterSuffix = item.letter || '';
    const decimalSuffix = item.decimal !== null ? `.${item.decimal}` : '';
    const oldPrefix = `${oldPadded}${letterSuffix}${decimalSuffix}`;
    const newPrefix = `${newPadded}${letterSuffix}${decimalSuffix}`;
    const newDirName = `${newPrefix}-${item.slug}`;

    await rename(join(phasesDir, item.dir), join(phasesDir, newDirName));
    renamedDirs.push({ from: item.dir, to: newDirName });

    // Rename files that start with the old prefix
    const files = await readdir(join(phasesDir, newDirName));
    for (const f of files) {
      if (f.startsWith(oldPrefix)) {
        const newFileName = newPrefix + f.slice(oldPrefix.length);
        await rename(join(phasesDir, newDirName, f), join(phasesDir, newDirName, newFileName));
        renamedFiles.push({ from: f, to: newFileName });
      }
    }
  }

  return { renamedDirs, renamedFiles };
}

// ─── updateRoadmapAfterPhaseRemoval ────────────────────────────────────

/**
 * Remove a phase section from ROADMAP.md and renumber subsequent integer phases.
 *
 * Port of updateRoadmapAfterPhaseRemoval from phase.cjs lines 569-595.
 * Uses readModifyWriteRoadmapMd for atomic writes.
 *
 * @param projectDir - Project root directory
 * @param targetPhase - Phase identifier that was removed
 * @param isDecimal - Whether the removed phase was a decimal phase
 * @param removedInt - The integer part of the removed phase
 */
async function updateRoadmapAfterPhaseRemoval(
  projectDir: string,
  targetPhase: string,
  isDecimal: boolean,
  removedInt: number,
  workstream?: string,
): Promise<void> {
  await readModifyWriteRoadmapMd(projectDir, (content) => {
    const escaped = escapeRegex(targetPhase);

    // Remove the phase section (header + body until next phase header or end)
    content = content.replace(
      new RegExp(`\\n?#{2,4}\\s*Phase\\s+${escaped}\\s*:[\\s\\S]*?(?=\\n#{2,4}\\s+Phase\\s+\\d|$)`, 'i'),
      '',
    );

    // Remove checkbox lines referencing the phase
    content = content.replace(
      new RegExp(`\\n?-\\s*\\[[ x]\\]\\s*.*Phase\\s+${escaped}[:\\s][^\\n]*`, 'gi'),
      '',
    );

    // Remove table rows referencing the phase
    content = content.replace(
      new RegExp(`\\n?\\|\\s*${escaped}\\.?\\s[^|]*\\|[^\\n]*`, 'gi'),
      '',
    );

    // For integer phase removal, renumber all subsequent phases in ROADMAP text
    if (!isDecimal) {
      const MAX_PHASE = 99;
      for (let oldNum = MAX_PHASE; oldNum > removedInt; oldNum--) {
        const newNum = oldNum - 1;
        const oldStr = String(oldNum);
        const newStr = String(newNum);
        const oldPad = oldStr.padStart(2, '0');
        const newPad = newStr.padStart(2, '0');

        // Renumber phase headers: ### Phase N:
        content = content.replace(
          new RegExp(`(#{2,4}\\s*Phase\\s+)${escapeRegex(oldStr)}(\\s*:)`, 'gi'),
          `$1${newStr}$2`,
        );

        // Renumber inline Phase N references
        content = content.replace(
          new RegExp(`(Phase\\s+)${escapeRegex(oldStr)}([:\\s])`, 'g'),
          `$1${newStr}$2`,
        );

        // Renumber padded plan references: 07-01 -> 06-01
        content = content.replace(
          new RegExp(`${escapeRegex(oldPad)}-(\\d{2})`, 'g'),
          `${newPad}-$1`,
        );

        // Renumber table row phase numbers: | 7. -> | 6.
        content = content.replace(
          new RegExp(`(\\|\\s*)${escapeRegex(oldStr)}\\.\\s`, 'g'),
          `$1${newStr}. `,
        );

        // Renumber depends-on references
        content = content.replace(
          new RegExp(`(\\*\\*Depends on:\\*\\*\\s*Phase\\s+)${escapeRegex(oldStr)}\\b`, 'gi'),
          `$1${newStr}`,
        );
      }
    }

    return content;
  }, workstream);
}

// ─── phaseRemove handler ───────────────────────────────────────────────

/**
 * Query handler for phase.remove.
 *
 * Port of cmdPhaseRemove from phase.cjs lines 597-661.
 * Deletes phase directory, renumbers subsequent phases on disk,
 * updates ROADMAP.md (removes section + renumbers), and decrements
 * STATE.md total_phases count.
 *
 * @param args - args[0]: targetPhase (required), args[1]: '--force' (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { removed, directory_deleted, renamed_directories, renamed_files, roadmap_updated, state_updated }
 */
export const phaseRemove: QueryHandler = async (args, projectDir, workstream) => {
  const targetPhase = args[0];
  if (!targetPhase) {
    throw new GSDError('phase number required for phase remove', ErrorClassification.Validation);
  }
  assertNoNullBytes(targetPhase, 'targetPhase');

  const paths = planningPaths(projectDir, workstream);
  const phasesDir = paths.phases;

  if (!existsSync(paths.roadmap)) {
    throw new GSDError('ROADMAP.md not found', ErrorClassification.Validation);
  }

  const normalized = normalizePhaseName(targetPhase);
  const isDecimal = targetPhase.includes('.');
  const force = args[1] === '--force';

  // Find target directory
  const entries = await readdir(phasesDir, { withFileTypes: true });
  const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  const targetDir = dirs.find(d => phaseTokenMatches(d, normalized)) ?? null;

  // Guard against removing executed work
  if (targetDir && !force) {
    const files = await readdir(join(phasesDir, targetDir));
    const summaries = files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
    if (summaries.length > 0) {
      throw new GSDError(
        `Phase ${targetPhase} has ${summaries.length} executed plan(s). Use --force to remove anyway.`,
        ErrorClassification.Validation,
      );
    }
  }

  // Delete directory
  if (targetDir) {
    await rm(join(phasesDir, targetDir), { recursive: true, force: true });
  }

  // Renumber subsequent phases on disk
  let renamedDirs: Array<{ from: string; to: string }> = [];
  let renamedFiles: Array<{ from: string; to: string }> = [];
  try {
    let renamed: { renamedDirs: Array<{ from: string; to: string }>; renamedFiles: Array<{ from: string; to: string }> };
    if (isDecimal) {
      const parts = normalized.split('.');
      if (parts.length < 2 || !parts[1]) {
        throw new GSDError(`Invalid decimal phase identifier: ${targetPhase}`, ErrorClassification.Validation);
      }
      const decimalPart = parseInt(parts[1], 10);
      if (isNaN(decimalPart)) {
        throw new GSDError(`Invalid decimal part in phase: ${targetPhase}`, ErrorClassification.Validation);
      }
      renamed = await renameDecimalPhases(phasesDir, parts[0], decimalPart);
    } else {
      renamed = await renameIntegerPhases(phasesDir, parseInt(normalized, 10));
    }
    renamedDirs = renamed.renamedDirs;
    renamedFiles = renamed.renamedFiles;
  } catch { /* intentionally empty — renaming is best-effort */ }

  // Update ROADMAP.md
  await updateRoadmapAfterPhaseRemoval(projectDir, targetPhase, isDecimal, parseInt(normalized, 10), workstream);

  // Update STATE.md: decrement total_phases
  let stateUpdated = false;
  const statePath = paths.state;
  if (existsSync(statePath)) {
    const lockPath = await acquireStateLock(statePath);
    try {
      let stateContent = await readFile(statePath, 'utf-8');

      // Decrement total_phases in frontmatter
      const totalPhasesMatch = stateContent.match(/total_phases:\s*(\d+)/);
      if (totalPhasesMatch) {
        const oldTotal = parseInt(totalPhasesMatch[1], 10);
        stateContent = stateContent.replace(
          /total_phases:\s*\d+/,
          `total_phases: ${oldTotal - 1}`,
        );
      }

      // Decrement "of N" pattern in body (e.g., "Plan: 2 of 3")
      const ofMatch = stateContent.match(/(\bof\s+)(\d+)(\s*(?:\(|phases?))/i);
      if (ofMatch) {
        stateContent = stateContent.replace(
          /(\bof\s+)(\d+)(\s*(?:\(|phases?))/i,
          `$1${parseInt(ofMatch[2], 10) - 1}$3`,
        );
      }

      // Also try stateReplaceField for "Total Phases" field
      const totalRaw = stateExtractField(stateContent, 'Total Phases');
      if (totalRaw) {
        const replaced = stateReplaceField(stateContent, 'Total Phases', String(parseInt(totalRaw, 10) - 1));
        if (replaced) stateContent = replaced;
      }

      await writeFile(statePath, stateContent, 'utf-8');
      stateUpdated = true;
    } finally {
      await releaseStateLock(lockPath);
    }
  }

  return {
    data: {
      removed: targetPhase,
      directory_deleted: targetDir,
      renamed_directories: renamedDirs,
      renamed_files: renamedFiles,
      roadmap_updated: true,
      state_updated: stateUpdated,
    },
  };
};

// ─── stateReplaceFieldWithFallback (inline) ────────────────────────────────

/**
 * Replace a field with fallback field name support.
 *
 * Tries primary first, then fallback. Returns content unchanged if neither matches.
 * Reimplemented here because state-mutation.ts keeps it module-private.
 */
function stateReplaceFieldWithFallback(
  content: string,
  primary: string,
  fallback: string | null,
  value: string,
): string {
  let result = stateReplaceField(content, primary, value);
  if (result) return result;
  if (fallback) {
    result = stateReplaceField(content, fallback, value);
    if (result) return result;
  }
  return content;
}

// ─── updatePerformanceMetricsSection ───────────────────────────────────────

/**
 * Update the Performance Metrics section in STATE.md content.
 *
 * Port of updatePerformanceMetricsSection from state.cjs lines 1125-1156.
 * Updates "Total plans completed" counter and upserts a row in the By Phase table.
 *
 * @param content - STATE.md content
 * @param phaseNum - Phase number being completed
 * @param planCount - Total number of plans in the phase
 * @param summaryCount - Number of completed summaries
 * @returns Modified content
 */
function updatePerformanceMetricsSection(
  content: string,
  phaseNum: string,
  planCount: number,
  summaryCount: number,
): string {
  // Update Velocity: Total plans completed
  const totalMatch = content.match(/Total plans completed:\s*(\d+|\[N\])/);
  const prevTotal = totalMatch && totalMatch[1] !== '[N]' ? parseInt(totalMatch[1], 10) : 0;
  const newTotal = prevTotal + summaryCount;
  content = content.replace(
    /Total plans completed:\s*(\d+|\[N\])/,
    `Total plans completed: ${newTotal}`,
  );

  // Update By Phase table — upsert row for this phase
  const byPhaseTablePattern = /(\|\s*Phase\s*\|\s*Plans\s*\|\s*Total\s*\|\s*Avg\/Plan\s*\|[ \t]*\n\|(?:[- :\t]+\|)+[ \t]*\n)((?:[ \t]*\|[^\n]*\n)*)(?=\n|$)/i;
  const byPhaseMatch = content.match(byPhaseTablePattern);
  if (byPhaseMatch) {
    let tableBody = byPhaseMatch[2].trim();
    const phaseRowPattern = new RegExp(`^\\|\\s*${escapeRegex(String(phaseNum))}\\s*\\|.*$`, 'm');
    const newRow = `| ${phaseNum} | ${summaryCount} | - | - |`;

    if (phaseRowPattern.test(tableBody)) {
      // Update existing row
      tableBody = tableBody.replace(new RegExp(`^\\|\\s*${escapeRegex(String(phaseNum))}\\s*\\|.*$`, 'm'), newRow);
    } else {
      // Remove placeholder row and add new row
      tableBody = tableBody.replace(/^\|\s*-\s*\|\s*-\s*\|\s*-\s*\|\s*-\s*\|$/m, '').trim();
      tableBody = tableBody ? tableBody + '\n' + newRow : newRow;
    }

    content = content.replace(byPhaseTablePattern, `$1${tableBody}\n`);
  }

  return content;
}

// ─── phaseComplete handler ────────────────────────────────────────────────

/**
 * Query handler for phase.complete.
 *
 * Port of cmdPhaseComplete from phase.cjs lines 663-932.
 * Marks a phase as done — updates ROADMAP.md (checkbox, progress table,
 * plan count, plan checkboxes), REQUIREMENTS.md (requirement checkboxes,
 * traceability table), and STATE.md (current phase, status, progress,
 * performance metrics) atomically with per-file locks.
 *
 * @param args - args[0]: phaseNum (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with completion details and warnings
 */
export const phaseComplete: QueryHandler = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError('phase number required for phase complete', ErrorClassification.Validation);
  }
  assertNoNullBytes(phaseNum, 'phaseNum');

  const paths = planningPaths(projectDir, workstream);
  const today = new Date().toISOString().split('T')[0];

  // Step A: Validate phase exists and get info
  const phaseInfo = await findPhaseDir(projectDir, phaseNum, workstream);
  if (!phaseInfo) {
    throw new GSDError(`Phase ${phaseNum} not found`, ErrorClassification.Validation);
  }

  const phaseDir = phaseInfo.dirPath;
  let phaseFiles: string[];
  try {
    phaseFiles = await readdir(phaseDir);
  } catch {
    phaseFiles = [];
  }

  const plans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
  const summaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
  const planCount = plans.length;
  const summaryCount = summaries.length;
  let requirementsUpdated = false;

  // Step B: Check for verification warnings (non-blocking)
  const warnings: string[] = [];
  for (const file of phaseFiles.filter(f => f.includes('-UAT') && f.endsWith('.md'))) {
    try {
      const content = await readFile(join(phaseDir, file), 'utf-8');
      if (/result: pending/.test(content)) warnings.push(`${file}: has pending tests`);
      if (/result: blocked/.test(content)) warnings.push(`${file}: has blocked tests`);
      if (/status: partial/.test(content)) warnings.push(`${file}: testing incomplete (partial)`);
      if (/status: diagnosed/.test(content)) warnings.push(`${file}: has diagnosed gaps`);
    } catch { /* intentionally empty */ }
  }
  for (const file of phaseFiles.filter(f => f.includes('-VERIFICATION') && f.endsWith('.md'))) {
    try {
      const content = await readFile(join(phaseDir, file), 'utf-8');
      if (/status: human_needed/.test(content)) warnings.push(`${file}: needs human verification`);
      if (/status: gaps_found/.test(content)) warnings.push(`${file}: has unresolved gaps`);
    } catch { /* intentionally empty */ }
  }

  // Step C: Update ROADMAP.md atomically
  if (existsSync(paths.roadmap)) {
    await readModifyWriteRoadmapMd(projectDir, async (roadmapContent) => {
      const phaseEscaped = escapeRegex(phaseNum);

      // Checkbox: - [ ] Phase N: -> - [x] Phase N: (...completed DATE)
      const checkboxPattern = new RegExp(
        `(-\\s*\\[)[ ](\\]\\s*.*Phase\\s+${phaseEscaped}[:\\s][^\\n]*)`,
        'i',
      );
      roadmapContent = replaceInCurrentMilestone(roadmapContent, checkboxPattern, `$1x$2 (completed ${today})`);

      // Progress table: update Status to Complete, add date
      const tableRowPattern = new RegExp(
        `^(\\|\\s*${phaseEscaped}\\.?\\s[^|]*(?:\\|[^\\n]*))$`,
        'im',
      );
      roadmapContent = roadmapContent.replace(tableRowPattern, (fullRow) => {
        const cells = fullRow.split('|').slice(1, -1);
        if (cells.length === 5) {
          cells[2] = ` ${summaryCount}/${planCount} `;
          cells[3] = ' Complete    ';
          cells[4] = ` ${today} `;
        } else if (cells.length === 4) {
          cells[1] = ` ${summaryCount}/${planCount} `;
          cells[2] = ' Complete    ';
          cells[3] = ` ${today} `;
        }
        return '|' + cells.join('|') + '|';
      });

      // Update plan count in phase section
      const planCountPattern = new RegExp(
        `(#{2,4}\\s*Phase\\s+${phaseEscaped}(?:(?!\\n#{2,4})[\\s\\S])*?\\*\\*Plans:\\*\\*[ \\t]*)[^\\n]+`,
        'i',
      );
      roadmapContent = replaceInCurrentMilestone(
        roadmapContent, planCountPattern,
        `$1${summaryCount}/${planCount} plans complete`,
      );

      // Mark completed plan checkboxes
      for (const summaryFile of summaries) {
        const planId = summaryFile.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
        if (!planId) continue;
        const planEscaped = escapeRegex(planId);
        const planCheckboxPattern = new RegExp(
          `(-\\s*\\[) (\\]\\s*(?:\\*\\*)?${planEscaped}(?:\\*\\*)?)`,
          'i',
        );
        roadmapContent = roadmapContent.replace(planCheckboxPattern, '$1x$2');
      }

      // Step D: Update REQUIREMENTS.md
      const reqPath = paths.requirements;
      if (existsSync(reqPath)) {
        const currentMilestoneRoadmap = await extractCurrentMilestone(roadmapContent, projectDir);
        const phaseSectionMatch = currentMilestoneRoadmap.match(
          new RegExp(`(#{2,4}\\s*Phase\\s+${phaseEscaped}[:\\s][\\s\\S]*?)(?=#{2,4}\\s*Phase\\s+|$)`, 'i'),
        );

        const sectionText = phaseSectionMatch ? phaseSectionMatch[1] : '';
        const reqMatch = sectionText.match(/\*\*Requirements\*?\*?:?\s*([^\n]+)/i);

        if (reqMatch) {
          const reqIds = reqMatch[1].replace(/[[\]]/g, '').split(/[,\s]+/).map(r => r.trim()).filter(Boolean);
          let reqContent = await readFile(reqPath, 'utf-8');

          for (const reqId of reqIds) {
            const reqEscaped = escapeRegex(reqId);
            // Update checkbox: - [ ] **REQ-ID** -> - [x] **REQ-ID**
            reqContent = reqContent.replace(
              new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi'),
              '$1x$2',
            );
            // Update traceability table: Pending/In Progress -> Complete
            reqContent = reqContent.replace(
              new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*(?:Pending|In Progress)\\s*(\\|)`, 'gi'),
              '$1 Complete $2',
            );
          }

          await writeFile(reqPath, reqContent, 'utf-8');
          requirementsUpdated = true;
        }
      }

      return roadmapContent;
    }, workstream);
  }

  // Step E: Find next phase — filesystem first, then ROADMAP.md fallback
  let nextPhaseNum: string | null = null;
  let nextPhaseName: string | null = null;
  let isLastPhase = true;
  // Tracks whether the completed phase belongs to the primary milestone in STATE.md.
  // When false (parallel-milestone case, Bug #2676), the milestone filter is bypassed
  // for next-phase detection so phases from the same secondary milestone are visible.
  let completedPhaseInPrimaryMilestone = true;

  try {
    const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);
    const entries = await readdir(paths.phases, { withFileTypes: true });
    const allDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

    // Guard: if the completed phase's directory is not in the current-milestone filter
    // set, the filter was built from a different (primary) milestone in STATE.md.
    // In that case skip the filter so we can find the true next phase on disk.
    // This handles parallel-milestone workflows where STATE.md's `milestone:` field
    // points at the primary milestone but the phase being completed belongs to a
    // secondary in-flight milestone. (Bug #2676)
    const completedDirInFilter = allDirs.some((d) => {
      const dm = d.match(/^(\d+[A-Z]?(?:\.\d+)*)-?/i);
      return dm && comparePhaseNum(dm[1], phaseNum) === 0 && isDirInMilestone(d);
    });
    completedPhaseInPrimaryMilestone = completedDirInFilter;
    const effectiveFilter = completedDirInFilter ? isDirInMilestone : (_d: string) => true;

    const dirs = allDirs
      .filter(effectiveFilter)
      .sort((a, b) => comparePhaseNum(a, b));

    for (const dir of dirs) {
      const dm = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      if (dm) {
        if (comparePhaseNum(dm[1], phaseNum) > 0) {
          nextPhaseNum = dm[1];
          nextPhaseName = dm[2] || null;
          isLastPhase = false;
          break;
        }
      }
    }
  } catch { /* intentionally empty */ }

  // Fallback: check ROADMAP.md for phases not yet scaffolded.
  // When the completed phase is from a parallel (non-primary) milestone, scan the
  // full ROADMAP rather than the primary-milestone slice so 41.3 is visible when
  // completing 41.2 for a secondary milestone. (Bug #2676)
  if (isLastPhase && existsSync(paths.roadmap)) {
    try {
      const roadmapContent = await readFile(paths.roadmap, 'utf-8');
      const roadmapForPhases = completedPhaseInPrimaryMilestone
        ? await extractCurrentMilestone(roadmapContent, projectDir)
        : roadmapContent;
      const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
      let pm: RegExpExecArray | null;
      while ((pm = phasePattern.exec(roadmapForPhases)) !== null) {
        if (comparePhaseNum(pm[1], phaseNum) > 0) {
          nextPhaseNum = pm[1];
          nextPhaseName = pm[2].replace(/\(INSERTED\)/i, '').trim().toLowerCase().replace(/\s+/g, '-');
          isLastPhase = false;
          break;
        }
      }
    } catch { /* intentionally empty */ }
  }

  // Step F: Update STATE.md atomically
  let stateUpdated = false;
  if (existsSync(paths.state)) {
    const lockPath = await acquireStateLock(paths.state);
    try {
      const rawState = await readFile(paths.state, 'utf-8');

      // Split into frontmatter and body to prevent field replacement from
      // matching YAML keys (e.g., `status:` in frontmatter vs `Status:` in body).
      // Pattern 11: Strip frontmatter before modifier (from Phase 11 decisions).
      const fmMatch = rawState.match(/^(---\r?\n[\s\S]*?\r?\n---)\s*/);
      let frontmatter = fmMatch ? fmMatch[1] : '';
      let body = fmMatch ? rawState.slice(fmMatch[0].length) : rawState;

      // Update Current Phase — preserve "X of Y (Name)" compound format
      const phaseValue = nextPhaseNum || phaseNum;
      const existingPhaseField = stateExtractField(body, 'Current Phase')
        || stateExtractField(body, 'Phase');
      let newPhaseValue = String(phaseValue);
      if (existingPhaseField) {
        const totalMatch = existingPhaseField.match(/of\s+(\d+)/);
        const nameMatch = existingPhaseField.match(/\(([^)]+)\)/);
        if (totalMatch) {
          const total = totalMatch[1];
          const nameStr = nextPhaseName
            ? ` (${nextPhaseName.replace(/-/g, ' ')})`
            : (nameMatch ? ` (${nameMatch[1]})` : '');
          newPhaseValue = `${phaseValue} of ${total}${nameStr}`;
        }
      }
      body = stateReplaceFieldWithFallback(body, 'Current Phase', 'Phase', newPhaseValue);

      // Update Status
      body = stateReplaceFieldWithFallback(body, 'Status', null,
        isLastPhase ? 'Milestone complete' : 'Ready to plan');

      // Update Current Plan
      body = stateReplaceFieldWithFallback(body, 'Current Plan', 'Plan', 'Not started');

      // Update Last Activity
      body = stateReplaceFieldWithFallback(body, 'Last Activity', 'Last activity', today);

      // Update Performance Metrics section (operates on body only)
      body = updatePerformanceMetricsSection(body, phaseNum, planCount, summaryCount);

      // Update frontmatter fields separately
      // Increment completed_phases
      const completedFmMatch = frontmatter.match(/completed_phases:\s*(\d+)/);
      if (completedFmMatch) {
        const newCompleted = parseInt(completedFmMatch[1], 10) + 1;
        frontmatter = frontmatter.replace(
          /completed_phases:\s*\d+/,
          `completed_phases: ${newCompleted}`,
        );

        // Recalculate percent
        const totalFmMatch = frontmatter.match(/total_phases:\s*(\d+)/);
        if (totalFmMatch) {
          const totalPhases = parseInt(totalFmMatch[1], 10);
          if (totalPhases > 0) {
            const newPercent = Math.round((newCompleted / totalPhases) * 100);
            frontmatter = frontmatter.replace(
              /(percent:\s*)\d+/,
              `$1${newPercent}`,
            );
          }
        }
      }

      // Update frontmatter status field
      frontmatter = frontmatter.replace(
        /status:\s*.+/,
        `status: ${isLastPhase ? 'milestone_complete' : 'ready_to_plan'}`,
      );

      // Reassemble and write
      const stateContent = frontmatter + '\n\n' + body;
      await writeFile(paths.state, stateContent, 'utf-8');
      stateUpdated = true;
    } finally {
      await releaseStateLock(lockPath);
    }
  }

  // Step G: Return result
  return {
    data: {
      completed_phase: phaseNum,
      phase_name: phaseInfo.phaseName,
      plans_executed: `${summaryCount}/${planCount}`,
      next_phase: nextPhaseNum,
      next_phase_name: nextPhaseName,
      is_last_phase: isLastPhase,
      date: today,
      roadmap_updated: existsSync(paths.roadmap),
      state_updated: stateUpdated,
      requirements_updated: requirementsUpdated,
      warnings,
      has_warnings: warnings.length > 0,
    },
  };
};

// ─── phasesClear handler ──────────────────────────────────────────────────

/**
 * Query handler for phases.clear.
 *
 * Port of cmdPhasesClear from milestone.cjs lines 250-277.
 * Deletes all phase directories except 999.x backlog phases.
 * Requires --confirm flag to proceed.
 *
 * @param args - args[0]: '--confirm' to proceed (optional)
 * @param projectDir - Project root directory
 * @returns QueryResult with { cleared: count }
 */
export const phasesClear: QueryHandler = async (args, projectDir, workstream) => {
  const phasesDir = planningPaths(projectDir, workstream).phases;
  const confirm = Array.isArray(args) && args.includes('--confirm');
  let cleared = 0;

  if (existsSync(phasesDir)) {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !/^999(?:\.|$)/.test(e.name));

    if (dirs.length > 0 && !confirm) {
      throw new GSDError(
        `phases clear would delete ${dirs.length} phase director${dirs.length === 1 ? 'y' : 'ies'}. ` +
        `Pass --confirm to proceed.`,
        ErrorClassification.Validation,
      );
    }

    for (const entry of dirs) {
      await rm(join(phasesDir, entry.name), { recursive: true, force: true });
      cleared++;
    }
  }

  return { data: { cleared } };
};

// ─── phasesArchive handler ────────────────────────────────────────────────

/**
 * Query handler for phases.archive.
 *
 * Extracted from cmdMilestoneComplete, milestone.cjs lines 210-227.
 * Moves milestone phase directories to milestones/{version}-phases/.
 *
 * @param args - args[0]: version string (e.g., "v3.0")
 * @param projectDir - Project root directory
 * @returns QueryResult with { archived: count, version, archive_directory }
 */
export const phasesList: QueryHandler = async (args, projectDir, workstream) => {
  const paths = planningPaths(projectDir, workstream);
  const phasesDir = paths.phases;

  const typeIdx = args.indexOf('--type');
  const phaseIdx = args.indexOf('--phase');
  const type = typeIdx !== -1 ? args[typeIdx + 1] : null;
  const phase = phaseIdx !== -1 ? args[phaseIdx + 1] : null;
  const includeArchived = args.includes('--include-archived');

  if (!existsSync(phasesDir)) {
    return { data: type ? { files: [], count: 0 } : { directories: [], count: 0 } };
  }

  const entries = await readdir(phasesDir, { withFileTypes: true });
  let dirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (includeArchived) {
    const milestonesDir = join(paths.planning, 'milestones');
    if (existsSync(milestonesDir)) {
      const milestoneEntries = await readdir(milestonesDir, { withFileTypes: true });
      for (const mDir of milestoneEntries.filter(e => e.isDirectory() && e.name.endsWith('-phases'))) {
        const milestone = mDir.name.replace(/-phases$/, '');
        const archivedEntries = await readdir(join(milestonesDir, mDir.name), { withFileTypes: true });
        for (const a of archivedEntries.filter(e => e.isDirectory())) {
          dirs.push(`${a.name} [${milestone}]`);
        }
      }
    }
  }

  dirs.sort((a, b) => comparePhaseNum(a, b));

  if (phase) {
    const normalized = normalizePhaseName(phase);
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) {
      return { data: { files: [], count: 0, phase_dir: null, error: 'Phase not found' } };
    }
    dirs = [match];
  }

  if (type) {
    const files: string[] = [];
    for (const dir of dirs) {
      const dirPath = join(phasesDir, dir);
      if (!existsSync(dirPath)) continue;
      const dirFiles = await readdir(dirPath);
      let filtered: string[];
      if (type === 'plans') {
        filtered = dirFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      } else if (type === 'summaries') {
        filtered = dirFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      } else {
        filtered = dirFiles;
      }
      files.push(...filtered.sort());
    }
    return { data: { files, count: files.length, phase_dir: phase ? dirs[0]?.replace(/^\d+(?:\.\d+)*-?/, '') : null } };
  }

  return { data: { directories: dirs, count: dirs.length } };
};

export const phaseNextDecimal: QueryHandler = async (args, projectDir, workstream) => {
  const basePhase = args[0];
  if (!basePhase) {
    throw new GSDError('base phase number required', ErrorClassification.Validation);
  }
  assertNoNullBytes(basePhase, 'basePhase');

  const paths = planningPaths(projectDir, workstream);
  const phasesDir = paths.phases;
  const normalized = normalizePhaseName(basePhase);
  const decimalSet = new Set<number>();
  let baseExists = false;

  if (existsSync(phasesDir)) {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    baseExists = dirNames.some(d => phaseTokenMatches(d, normalized));

    const dirPattern = new RegExp(`^(?:[A-Z]{1,6}-)?${escapeRegex(normalized)}\\.(\\d+)`);
    for (const dir of dirNames) {
      const match = dir.match(dirPattern);
      if (match) decimalSet.add(parseInt(match[1], 10));
    }
  }

  const roadmapPath = paths.roadmap;
  if (existsSync(roadmapPath)) {
    try {
      const roadmapContent = await readFile(roadmapPath, 'utf-8');
      const phasePattern = new RegExp(
        `#{2,4}\\s*Phase\\s+0*${escapeRegex(normalized)}\\.(\\d+)\\s*:`, 'gi',
      );
      let pm;
      while ((pm = phasePattern.exec(roadmapContent)) !== null) {
        decimalSet.add(parseInt(pm[1], 10));
      }
    } catch { /* ROADMAP.md read failure is non-fatal */ }
  }

  const existingDecimals = Array.from(decimalSet)
    .sort((a, b) => a - b)
    .map(n => `${normalized}.${n}`);

  const nextDecimal = decimalSet.size === 0
    ? `${normalized}.1`
    : `${normalized}.${Math.max(...decimalSet) + 1}`;

  return {
    data: {
      found: baseExists,
      base_phase: normalized,
      next: nextDecimal,
      existing: existingDecimals,
    },
  };
};

export const phasesArchive: QueryHandler = async (args, projectDir, workstream) => {
  const version = args[0];
  if (!version) {
    throw new GSDError('version required for phases archive', ErrorClassification.Validation);
  }
  assertNoNullBytes(version, 'version');

  const paths = planningPaths(projectDir, workstream);
  const phasesDir = paths.phases;
  const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);

  const archiveDir = join(paths.planning, 'milestones', `${version}-phases`);
  await mkdir(archiveDir, { recursive: true });

  let archivedCount = 0;
  if (existsSync(phasesDir)) {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const phaseDirNames = entries.filter(e => e.isDirectory()).map(e => e.name);

    for (const dir of phaseDirNames) {
      if (!isDirInMilestone(dir)) continue;
      await rename(join(phasesDir, dir), join(archiveDir, dir));
      archivedCount++;
    }
  }

  return {
    data: {
      archived: archivedCount,
      version,
      archive_directory: toPosixPath(relative(projectDir, archiveDir)),
    },
  };
};

// ─── milestoneComplete ────────────────────────────────────────────────────

/** Port of `parseMultiwordArg` in `gsd-tools.cjs`. */
function parseMultiwordArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(`--${flag}`);
  if (idx === -1) return null;
  const tokens: string[] = [];
  for (let i = idx + 1; i < args.length; i++) {
    if (args[i]!.startsWith('--')) break;
    tokens.push(args[i]!);
  }
  return tokens.length > 0 ? tokens.join(' ') : null;
}

/** Port of `extractOneLinerFromBody` from `core.cjs` / `summary.ts`. */
function extractOneLinerFromBody(content: string): string | null {
  if (!content) return null;
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n*/, '');
  const match = body.match(/^#[^\n]*\n+\*\*([^*]+)\*\*/m);
  return match ? match[1]!.trim() : null;
}

/**
 * Query handler for `milestone.complete` — port of `cmdMilestoneComplete` from `milestone.cjs`.
 */
export const milestoneComplete: QueryHandler = async (args, projectDir, workstream) => {
  const version = args[0];
  if (!version) {
    throw new GSDError('version required for milestone complete (e.g., v1.0)', ErrorClassification.Validation);
  }
  // #3259: defense-in-depth — reject --help / -h as a version value before
  // any disk write, regardless of whether the dispatcher guard intercepted first.
  if (version === '--help' || version === '-h') {
    throw new GSDError(
      `"${version}" is not a valid milestone version; see \`gsd-sdk query --help\` for command list`,
      ErrorClassification.Validation,
    );
  }
  assertNoNullBytes(version, 'version');

  const nameOpt = parseMultiwordArg(args, 'name');
  const archivePhases = args.includes('--archive-phases');

  const paths = planningPaths(projectDir, workstream);
  const roadmapPath = paths.roadmap;
  const reqPath = paths.requirements;
  const statePath = paths.state;
  const milestonesPath = join(paths.planning, 'MILESTONES.md');
  const archiveDir = join(paths.planning, 'milestones');
  const phasesDir = paths.phases;
  const today = new Date().toISOString().split('T')[0]!;
  const milestoneName = nameOpt || version;

  await mkdir(archiveDir, { recursive: true });

  const isDirInMilestone = await getMilestonePhaseFilter(projectDir, workstream);

  let phaseCount = 0;
  let totalPlans = 0;
  let totalTasks = 0;
  const accomplishments: string[] = [];

  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

    for (const dir of dirs) {
      if (!isDirInMilestone(dir)) continue;

      phaseCount++;
      const phaseFiles = await readdir(join(phasesDir, dir));
      const plans = phaseFiles.filter((f) => f.endsWith('-PLAN.md') || f === 'PLAN.md');
      const summaries = phaseFiles.filter((f) => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
      totalPlans += plans.length;

      for (const s of summaries) {
        try {
          const content = await readFile(join(phasesDir, dir, s), 'utf-8');
          const fm = extractFrontmatter(content);
          const oneLiner =
            (fm['one-liner'] as string | undefined) || extractOneLinerFromBody(content);
          if (oneLiner) {
            accomplishments.push(oneLiner);
          }
          const tasksFieldMatch = content.match(/\*\*Tasks:\*\*\s*(\d+)/);
          if (tasksFieldMatch) {
            totalTasks += parseInt(tasksFieldMatch[1]!, 10);
          } else {
            const xmlTaskMatches = content.match(/<task[\s>]/gi) || [];
            const mdTaskMatches = content.match(/##\s*Task\s*\d+/gi) || [];
            totalTasks += xmlTaskMatches.length || mdTaskMatches.length;
          }
        } catch {
          /* intentionally empty */
        }
      }
    }
  } catch {
    /* intentionally empty */
  }

  if (existsSync(roadmapPath)) {
    const roadmapContent = await readFile(roadmapPath, 'utf-8');
    await writeFile(join(archiveDir, `${version}-ROADMAP.md`), roadmapContent, 'utf-8');
  }

  if (existsSync(reqPath)) {
    const reqContent = await readFile(reqPath, 'utf-8');
    const archiveHeader =
      `# Requirements Archive: ${version} ${milestoneName}\n\n` +
      `**Archived:** ${today}\n**Status:** SHIPPED\n\n` +
      `For current requirements, see \`.planning/REQUIREMENTS.md\`.\n\n---\n\n`;
    await writeFile(join(archiveDir, `${version}-REQUIREMENTS.md`), archiveHeader + reqContent, 'utf-8');
  }

  const auditFile = join(projectDir, '.planning', `${version}-MILESTONE-AUDIT.md`);
  if (existsSync(auditFile)) {
    await rename(auditFile, join(archiveDir, `${version}-MILESTONE-AUDIT.md`));
  }

  const accomplishmentsList = accomplishments.map((a) => `- ${a}`).join('\n');
  const milestoneEntry =
    `## ${version} ${milestoneName} (Shipped: ${today})\n\n` +
    `**Phases completed:** ${phaseCount} phases, ${totalPlans} plans, ${totalTasks} tasks\n\n` +
    `**Key accomplishments:**\n${accomplishmentsList || '- (none recorded)'}\n\n---\n\n`;

  if (existsSync(milestonesPath)) {
    const existing = await readFile(milestonesPath, 'utf-8');
    if (!existing.trim()) {
      await writeFile(milestonesPath, normalizeMd(`# Milestones\n\n${milestoneEntry}`), 'utf-8');
    } else {
      const headerMatch = existing.match(/^(#{1,3}\s+[^\n]*\n\n?)/);
      if (headerMatch) {
        const header = headerMatch[1]!;
        const rest = existing.slice(header.length);
        await writeFile(milestonesPath, normalizeMd(header + milestoneEntry + rest), 'utf-8');
      } else {
        await writeFile(milestonesPath, normalizeMd(milestoneEntry + existing), 'utf-8');
      }
    }
  } else {
    await writeFile(milestonesPath, normalizeMd(`# Milestones\n\n${milestoneEntry}`), 'utf-8');
  }

  if (existsSync(statePath)) {
    await readModifyWriteStateMdFull(projectDir, (stateContent) => {
      let next = stateReplaceFieldWithFallback(
        stateContent,
        'Status',
        null,
        `${version} milestone complete`,
      );
      next = stateReplaceFieldWithFallback(next, 'Last Activity', 'Last activity', today);
      next = stateReplaceFieldWithFallback(
        next,
        'Last Activity Description',
        null,
        `${version} milestone completed and archived`,
      );

      const positionPattern = /(##\s*Current Position\s*\n)([\s\S]*?)(?=\n##|$)/i;
      const closedPositionBody =
        `\nPhase: Milestone ${version} complete\n` +
        `Plan: —\n` +
        `Status: Awaiting next milestone\n` +
        `Last activity: ${today} — Milestone ${version} completed and archived\n\n`;
      if (positionPattern.test(next)) {
        next = next.replace(positionPattern, (_m, header) => `${header}${closedPositionBody}`);
      } else {
        next = `${next.trimEnd()}\n\n## Current Position\n${closedPositionBody}`;
      }

      const operatorPattern = /(##\s*Operator Next Steps\s*\n)([\s\S]*?)(?=\n##|$)/i;
      if (operatorPattern.test(next)) {
        next = next.replace(
          operatorPattern,
          `$1\n- Start the next milestone with /gsd-new-milestone\n\n`,
        );
      } else {
        next = `${next.trimEnd()}\n\n## Operator Next Steps\n\n- Start the next milestone with /gsd-new-milestone\n`;
      }

      return next;
    }, workstream);
  }

  let phasesArchived = false;
  if (archivePhases) {
    try {
      const phaseArchiveDir = join(archiveDir, `${version}-phases`);
      await mkdir(phaseArchiveDir, { recursive: true });

      const phaseEntries = await readdir(phasesDir, { withFileTypes: true });
      const phaseDirNames = phaseEntries.filter((e) => e.isDirectory()).map((e) => e.name);
      let archivedCount = 0;
      for (const dir of phaseDirNames) {
        if (!isDirInMilestone(dir)) continue;
        await rename(join(phasesDir, dir), join(phaseArchiveDir, dir));
        archivedCount++;
      }
      phasesArchived = archivedCount > 0;
    } catch {
      /* intentionally empty */
    }
  }

  return {
    data: {
      version,
      name: milestoneName,
      date: today,
      phases: phaseCount,
      plans: totalPlans,
      tasks: totalTasks,
      accomplishments,
      archived: {
        roadmap: existsSync(join(archiveDir, `${version}-ROADMAP.md`)),
        requirements: existsSync(join(archiveDir, `${version}-REQUIREMENTS.md`)),
        audit: existsSync(join(archiveDir, `${version}-MILESTONE-AUDIT.md`)),
        phases: phasesArchived,
      },
      milestones_updated: true,
      state_updated: existsSync(statePath),
    },
  };
};
