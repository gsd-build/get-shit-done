/**
 * MVP-mode query handlers — three centralized seams for the MVP umbrella feature (#2826).
 *
 * Replaces three architectural duplications surfaced by the v1.50.0-canary.2 review:
 *
 * 1. **`phase.mvp-mode`** — resolves the precedence chain
 *    `--mvp` CLI flag → ROADMAP `**Mode:** mvp` → `workflow.mvp_mode` config → false.
 *    Replaces near-identical bash blocks in `plan-phase.md`, `execute-phase.md`,
 *    `verify-work.md`, `progress.md`. Single canonical resolution; workflows just
 *    call the verb and read the boolean.
 *
 * 2. **`task.is-behavior-adding`** — applies the three-check predicate
 *    (tdd=true frontmatter AND `<behavior>` block AND non-test source files in `<files>`)
 *    that was previously prose-only in `references/execute-mvp-tdd.md`. The gsd-executor
 *    agent now invokes the verb instead of inlining the checks.
 *
 * 3. **`user-story.validate`** — applies the canonical user-story regex
 *    `/^As a .+, I want to .+, so that .+\.$/` previously hardcoded in `verify-work.md`
 *    prose. Consumed by the verifier (phase-goal guard) and by `/gsd-mvp-phase`
 *    (interactive-prompt validation).
 *
 * Domain terms: see CONTEXT.md → MVP Mode, User Story, Behavior-Adding Task.
 * Concept index: get-shit-done/references/mvp-concepts.md.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { relative, resolve, sep, join } from 'node:path';

import { GSDError, ErrorClassification } from '../errors.js';
import { loadConfig } from '../config.js';
import { roadmapGetPhase } from './roadmap.js';
import { planningPaths } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── phase.mvp-mode ─────────────────────────────────────────────────────────

export type MvpModeSource = 'cli_flag' | 'roadmap' | 'config' | 'none';

interface MvpModeResult {
  /** True when MVP mode applies to the phase. */
  active: boolean;
  /** Which signal in the precedence chain decided the result. */
  source: MvpModeSource;
  /** The literal value seen in ROADMAP.md `**Mode:**` (lowercased), or null when the field is absent. */
  roadmap_mode: string | null;
  /** The `workflow.mvp_mode` config value seen at resolution time. */
  config_mvp_mode: boolean;
  /** True when the caller indicated the `--mvp` CLI flag was present. */
  cli_flag_present: boolean;
}

/**
 * Resolve MVP mode for a phase. Precedence (first hit wins):
 *   1. `--cli-flag` arg on this verb (caller asserts the user passed `--mvp`)
 *   2. ROADMAP.md `**Mode:** mvp` for the phase
 *   3. `workflow.mvp_mode` config (project-wide default)
 *   4. false
 *
 * @example
 *   gsd-sdk query phase.mvp-mode 1                    # roadmap + config check
 *   gsd-sdk query phase.mvp-mode 1 --cli-flag         # caller saw --mvp on CLI
 */
export const phaseMvpMode: QueryHandler<MvpModeResult> = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError(
      'Usage: phase.mvp-mode <phase-number> [--cli-flag]',
      ErrorClassification.Validation,
    );
  }
  const cliFlagPresent = args.includes('--cli-flag');

  // Precedence #2: ROADMAP.md
  const phaseResult = await roadmapGetPhase([phaseNum], projectDir, workstream);
  const phaseData = phaseResult.data as { found?: boolean; mode?: string | null };
  const roadmapMode = phaseData.found && typeof phaseData.mode === 'string'
    ? phaseData.mode.trim().toLowerCase()
    : null;

  // Precedence #3: config
  const config = await loadConfig(projectDir, workstream);
  const wf = (config.workflow ?? {}) as unknown as Record<string, unknown>;
  const configMvpMode = Boolean(wf.mvp_mode ?? false);

  let active = false;
  let source: MvpModeSource = 'none';
  if (cliFlagPresent) {
    active = true;
    source = 'cli_flag';
  } else if (roadmapMode === 'mvp') {
    active = true;
    source = 'roadmap';
  } else if (configMvpMode) {
    active = true;
    source = 'config';
  }

  return {
    data: {
      active,
      source,
      roadmap_mode: roadmapMode,
      config_mvp_mode: configMvpMode,
      cli_flag_present: cliFlagPresent,
    },
  };
};

// ─── task.is-behavior-adding ────────────────────────────────────────────────

interface BehaviorAddingResult {
  /** True when ALL three predicate checks pass. */
  is_behavior_adding: boolean;
  /** Per-check breakdown — useful for halt-and-report messages. */
  checks: {
    tdd_true: boolean;
    has_behavior_block: boolean;
    has_source_files: boolean;
  };
  /** Human-readable reason when `is_behavior_adding` is false. */
  reason: string | null;
}

/**
 * Predicate: does this PLAN.md task add user-visible behavior under MVP+TDD?
 *
 * Three checks, all required:
 *   (1) `tdd="true"` frontmatter
 *   (2) `<behavior>` block names a user-visible outcome (block exists and is non-empty)
 *   (3) `<files>` includes at least one non-test source file
 *       (excludes `*.md`, `*.json`, `*.test.*`, `*.spec.*`)
 *
 * Pure doc-only / config-only / test-only tasks return `is_behavior_adding=false`
 * and are exempt from the MVP+TDD Gate.
 *
 * Canonical specification: get-shit-done/references/execute-mvp-tdd.md.
 *
 * @example
 *   gsd-sdk query task.is-behavior-adding ./plans/01-PLAN-auth.md
 *   gsd-sdk query task.is-behavior-adding --task-content "<task>...</task>"
 */
export const taskIsBehaviorAdding: QueryHandler<BehaviorAddingResult> = async (args, projectDir) => {
  let content: string | null = null;
  if (args[0] === '--task-content') {
    content = args[1] ?? null;
  } else if (args[0]) {
    const requestedPath = args[0];
    const projectRoot = resolve(projectDir ?? process.cwd());
    const resolvedTaskPath = resolve(projectRoot, requestedPath);
    const rel = relative(projectRoot, resolvedTaskPath);
    if (rel === '..' || rel.startsWith(`..${sep}`)) {
      throw new GSDError(
        `Task file is outside project scope: ${requestedPath}`,
        ErrorClassification.Validation,
      );
    }
    if (!existsSync(resolvedTaskPath)) {
      throw new GSDError(
        `Task file not found: ${requestedPath}`,
        ErrorClassification.Validation,
      );
    }
    content = await readFile(resolvedTaskPath, 'utf-8');
  }
  if (!content) {
    throw new GSDError(
      'Usage: task.is-behavior-adding <plan-file-path> | --task-content "<xml>"',
      ErrorClassification.Validation,
    );
  }

  // Check 1: tdd="true" — accept either single or double quotes, case-insensitive.
  const tddTrue = /\btdd\s*=\s*["']true["']/i.test(content);

  // Check 2: <behavior>...</behavior> block exists and is non-empty after trim.
  const behaviorMatch = content.match(/<behavior>([\s\S]*?)<\/behavior>/i);
  const hasBehaviorBlock = Boolean(behaviorMatch && behaviorMatch[1].trim().length > 0);

  // Check 3: <files>...</files> includes at least one source file
  // (anything that is NOT *.md, *.json, *.test.*, *.spec.*).
  const filesMatch = content.match(/<files>([\s\S]*?)<\/files>/i);
  let hasSourceFiles = false;
  if (filesMatch) {
    const filesBody = filesMatch[1];
    const fileLines = filesBody
      .split(/[\n,]/)
      .map(l => l.trim().replace(/^[-*]\s*/, ''))
      .filter(Boolean);
    hasSourceFiles = fileLines.some(f =>
      !/\.md$/i.test(f) &&
      !/\.json$/i.test(f) &&
      !/\.test\.[^.]+$/i.test(f) &&
      !/\.spec\.[^.]+$/i.test(f) &&
      !/(^|[\\/])tests?[\\/]/i.test(f) &&
      !/\.(yml|yaml|toml|ini|cfg|conf|properties)$/i.test(f) &&
      !/(^|[\\/])\.env(\..+)?$/i.test(f)
    );
  }

  const isBehaviorAdding = tddTrue && hasBehaviorBlock && hasSourceFiles;
  let reason: string | null = null;
  if (!isBehaviorAdding) {
    const missing: string[] = [];
    if (!tddTrue) missing.push('tdd="true" frontmatter absent');
    if (!hasBehaviorBlock) missing.push('<behavior> block missing or empty');
    if (!hasSourceFiles) missing.push('<files> has no non-test source file');
    reason = `Not behavior-adding: ${missing.join('; ')}`;
  }

  return {
    data: {
      is_behavior_adding: isBehaviorAdding,
      checks: {
        tdd_true: tddTrue,
        has_behavior_block: hasBehaviorBlock,
        has_source_files: hasSourceFiles,
      },
      reason,
    },
  };
};

// ─── user-story.validate ────────────────────────────────────────────────────

interface UserStoryValidateResult {
  /** True when the input matches the canonical user-story regex. */
  valid: boolean;
  /** The literal input string echoed back. */
  input: string;
  /** Per-slot extraction when `valid` is true; null when invalid. */
  slots: { role: string; capability: string; outcome: string } | null;
  /** Specific guidance when `valid` is false. */
  errors: string[];
}

/**
 * The canonical User Story regex — exported so unit tests can assert it directly
 * and other modules can import it without re-defining.
 *
 * Pattern: `As a [role], I want to [capability], so that [outcome].`
 */
export const USER_STORY_REGEX = /^As a (?<role>.+?), I want to (?<capability>.+?), so that (?<outcome>.+?)\.$/;

/**
 * Validate that a string matches the User Story format used by MVP-mode phases.
 * Used by `gsd-verifier` (phase-goal guard) and `/gsd-mvp-phase` (interactive prompting).
 *
 * @example
 *   gsd-sdk query user-story.validate "As a user, I want to log in, so that I can see my data."
 *   gsd-sdk query user-story.validate --story "<text>"
 */
export const userStoryValidate: QueryHandler<UserStoryValidateResult> = async (args, _projectDir) => {
  let input: string | null = null;
  if (args[0] === '--story') {
    input = args[1] ?? null;
  } else if (args[0]) {
    input = args.join(' ');
  }
  if (input === null || input === '') {
    throw new GSDError(
      'Usage: user-story.validate "<story text>" | --story "<text>"',
      ErrorClassification.Validation,
    );
  }

  const match = input.match(USER_STORY_REGEX);
  const errors: string[] = [];
  let slots: UserStoryValidateResult['slots'] = null;

  if (match && match.groups) {
    slots = {
      role: match.groups.role.trim(),
      capability: match.groups.capability.trim(),
      outcome: match.groups.outcome.trim(),
    };
  } else {
    if (!/^As a /i.test(input)) errors.push('Must begin with "As a ".');
    if (!/, I want to /i.test(input)) errors.push('Must contain ", I want to ".');
    if (!/, so that /i.test(input)) errors.push('Must contain ", so that ".');
    if (!/\.$/.test(input)) errors.push('Must end with a period.');
    if (errors.length === 0) errors.push('Does not match canonical User Story shape.');
  }

  return {
    data: {
      valid: match !== null,
      input,
      slots,
      errors,
    },
  };
};

// ─── phase.walking-skeleton-trigger ─────────────────────────────────────────

/**
 * Extensions to exclude when scanning for source files.
 * Directories to skip entirely — never descend into these.
 */
const SCAN_EXCLUDED_DIRS = new Set([
  '.git',
  '.planning',
  '.gsd',
  'node_modules',
  'dist',
  'build',
  '.changeset',
  '.github',
  'coverage',
  '.next',
  '.cache',
]);

/**
 * File extensions that count as "source code" for the brownfield-detection
 * heuristic. A project with zero matching files is treated as greenfield.
 */
const SOURCE_CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs',
  '.py', '.rs', '.go', '.swift', '.java', '.kt',
  '.rb', '.php', '.c', '.cpp', '.cc', '.h', '.hpp', '.hh',
  '.html', '.css', '.scss', '.vue',
  '.ex', '.exs', '.ml', '.scala', '.clj', '.cljs',
  '.lua', '.nim', '.zig', '.erl',
]);

const SOURCE_SCAN_LIMIT = 100;

interface SourceScanResult {
  count: number;
  sample: string[];
}

/**
 * Walk `rootDir` (non-recursively into excluded dirs) and count files whose
 * extension is in SOURCE_CODE_EXTENSIONS.  Stops after SOURCE_SCAN_LIMIT
 * matches — we only need "is it zero", not an exact total.
 *
 * Returns the count (capped at SOURCE_SCAN_LIMIT) and up to 5 sample paths
 * for debugging.
 */
function scanSourceFilesSync(rootDir: string): SourceScanResult {
  let count = 0;
  const sample: string[] = [];

  function walk(dir: string): void {
    if (count >= SOURCE_SCAN_LIMIT) return;
    let entries: string[];
    try {
      entries = readdirSync(dir) as string[];
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count >= SOURCE_SCAN_LIMIT) return;
      if (SCAN_EXCLUDED_DIRS.has(entry)) continue;
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (stat.isFile()) {
        const lastDot = entry.lastIndexOf('.');
        if (lastDot !== -1) {
          const ext = entry.slice(lastDot).toLowerCase();
          if (SOURCE_CODE_EXTENSIONS.has(ext)) {
            count++;
            if (sample.length < 5) sample.push(fullPath);
          }
        }
      }
    }
  }

  walk(rootDir);
  return { count, sample };
}

/**
 * Count summary files across all phase directories under `.planning/phases/`.
 * A file counts as a summary if it ends with `-SUMMARY.md` or equals `SUMMARY.md`.
 */
async function countSummariesTotal(projectDir: string, workstream?: string): Promise<number> {
  const paths = planningPaths(projectDir, workstream);
  const phasesDir = paths.phases;
  if (!existsSync(phasesDir)) return 0;
  let total = 0;
  let phaseDirs: string[];
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    phaseDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch {
    return 0;
  }
  for (const phaseDir of phaseDirs) {
    const phasePath = join(phasesDir, phaseDir);
    let files: string[];
    try {
      files = await readdir(phasePath);
    } catch {
      continue;
    }
    total += files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
  }
  return total;
}

interface WalkingSkeletonSignals {
  mvp_mode_active: boolean;
  phase_number: number;
  is_phase_one: boolean;
  summaries_total: number;
  source_files_count: number;
  source_files_sampled: string[];
}

interface WalkingSkeletonTriggerResult {
  active: boolean;
  signals: WalkingSkeletonSignals;
  reason: string | null;
}

/**
 * Evaluate whether Walking Skeleton mode should activate for a phase.
 *
 * All four conditions must hold:
 *   1. MVP mode is active (via phaseMvpMode precedence chain)
 *   2. Phase number is 1
 *   3. No prior phase summaries exist (summaries_total === 0)
 *   4. No source files detected in the project root (source_files_count === 0)
 *
 * Condition 4 guards against false-firing on brownfield projects — a repo
 * with existing source code but no GSD summaries yet.
 *
 * Implements ADR docs/adr/2826-vertical-mvp-slice-planning-mode.md:34 which
 * specifies the trigger as `MVP_MODE=true && PHASE_NUMBER=1 && no-existing-code`.
 *
 * @example
 *   gsd-sdk query phase.walking-skeleton-trigger 1
 *   gsd-sdk query phase.walking-skeleton-trigger 1 --cli-flag
 */
export const phaseWalkingSkeletonTrigger: QueryHandler<WalkingSkeletonTriggerResult> = async (
  args,
  projectDir,
  workstream,
) => {
  const phaseArg = args[0];
  if (!phaseArg) {
    throw new GSDError(
      'Usage: phase.walking-skeleton-trigger <phase-number> [--cli-flag]',
      ErrorClassification.Validation,
    );
  }

  const phaseNumber = parseInt(phaseArg, 10);
  const isPhaseOne = phaseNumber === 1;

  // Signal 1: MVP mode via existing precedence chain
  const mvpResult = await phaseMvpMode(args, projectDir, workstream);
  const mvpActive = mvpResult.data.active;

  // Signal 3: prior summaries count
  const summariesTotal = await countSummariesTotal(projectDir ?? process.cwd(), workstream);

  // Signal 4: source file scan (synchronous walk — stops at SOURCE_SCAN_LIMIT)
  const sources = scanSourceFilesSync(projectDir ?? process.cwd());

  const active = mvpActive && isPhaseOne && summariesTotal === 0 && sources.count === 0;

  let reason: string | null = null;
  if (!active) {
    if (!mvpActive) {
      reason = 'mvp mode not active for this phase';
    } else if (!isPhaseOne) {
      reason = `phase ${phaseNumber} is not phase 1`;
    } else if (summariesTotal > 0) {
      reason = `${summariesTotal} prior phase summar${summariesTotal === 1 ? 'y' : 'ies'} exist`;
    } else if (sources.count > 0) {
      reason = `${sources.count}+ source files detected (brownfield project)`;
    }
  }

  return {
    data: {
      active,
      signals: {
        mvp_mode_active: mvpActive,
        phase_number: phaseNumber,
        is_phase_one: isPhaseOne,
        summaries_total: summariesTotal,
        source_files_count: sources.count,
        source_files_sampled: sources.sample,
      },
      reason,
    },
  };
};
