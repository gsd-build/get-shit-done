/**
 * `plan.consistency-check` query handler — read-only diagnostic that compares
 * a plan's expected close-out artifacts (production commits, SUMMARY.md,
 * STATE.md cursor, ROADMAP.md row) and reports whether they are in sync.
 *
 * Exists to close GitHub issue #3212 (executor stall + STATE drift). The
 * handler is purely additive: it never writes any file, never mutates STATE.md,
 * and is safe to call from any workflow at any time. It is the canonical
 * implementation of the "Possible inconsistent states" table in
 * `docs/ATOMIC-CLOSEOUT-INVARIANT.md`.
 *
 * @example
 * ```bash
 * gsd-sdk query plan.consistency-check --phase 4 --plan 03
 * # → { phase: "4", plan: "03", state: "consistent_complete", ... }
 * ```
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { GSDError, ErrorClassification } from '../errors.js';
import { planningPaths, normalizePhaseName } from './helpers.js';
import type { QueryHandler } from './utils.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Closed enum of all states the close-out invariant can be in for a single
 * plan. Names mirror the rows in `docs/ATOMIC-CLOSEOUT-INVARIANT.md`.
 */
export type PlanConsistencyState =
  | 'consistent_not_started'
  | 'consistent_complete'
  | 'drift_a_stalled_midexecute'
  | 'drift_b_summary_without_state'
  | 'drift_c_state_without_summary'
  | 'drift_d_phantom_done'
  | 'unknown';

export interface PlanConsistencyResult {
  phase: string;
  plan: string;
  state: PlanConsistencyState;
  production_commits: number;
  summary_exists: boolean;
  state_advanced: boolean;
  roadmap_updated: boolean;
  advice: string;
}

// ─── argv parsing ───────────────────────────────────────────────────────────

function parseFlagArgs(args: string[]): { phase: string; plan: string } {
  const phaseIdx = args.indexOf('--phase');
  const planIdx = args.indexOf('--plan');
  if (phaseIdx === -1 || planIdx === -1) {
    throw new GSDError(
      'plan.consistency-check requires --phase <id> and --plan <id>',
      ErrorClassification.Validation,
    );
  }
  const phase = args[phaseIdx + 1];
  const plan = args[planIdx + 1];
  if (!phase || phase.startsWith('--') || !plan || plan.startsWith('--')) {
    throw new GSDError(
      'plan.consistency-check: --phase and --plan must each have a value',
      ErrorClassification.Validation,
    );
  }
  return { phase, plan };
}

// ─── disk inspection helpers (read-only) ────────────────────────────────────

function findPhaseDir(phasesRoot: string, phase: string): string | null {
  if (!existsSync(phasesRoot)) return null;
  const normalized = normalizePhaseName(phase);
  let entries: string[];
  try {
    entries = readdirSync(phasesRoot);
  } catch {
    return null;
  }
  // Phase dirs are typically `XX-name` where XX is the (zero-padded) phase id.
  // Match either the normalized id at the start, or the raw input as a prefix
  // (handles custom IDs like `PROJ-42-name`).
  for (const entry of entries) {
    if (entry.startsWith(`${normalized}-`)) return join(phasesRoot, entry);
    if (entry.startsWith(`${phase}-`)) return join(phasesRoot, entry);
    if (entry === normalized || entry === phase) return join(phasesRoot, entry);
  }
  return null;
}

function summaryExistsForPlan(phaseDir: string, phase: string, plan: string): boolean {
  if (!existsSync(phaseDir)) return false;
  let entries: string[];
  try {
    entries = readdirSync(phaseDir);
  } catch {
    return false;
  }
  // SUMMARY filename pattern: {phase}-{plan}-SUMMARY.md (with various
  // zero-padding variants — be liberal in what we accept).
  const candidates = new Set<string>([
    `${phase}-${plan}-SUMMARY.md`,
    `${normalizePhaseName(phase)}-${plan}-SUMMARY.md`,
    `${phase}-${plan.padStart(2, '0')}-SUMMARY.md`,
    `${normalizePhaseName(phase)}-${plan.padStart(2, '0')}-SUMMARY.md`,
  ]);
  for (const entry of entries) {
    if (candidates.has(entry)) return true;
    // Also accept a SUMMARY whose first two segments match phase + plan
    // followed by `-SUMMARY.md`, regardless of intermediate naming
    // conventions.
    if (entry.endsWith('-SUMMARY.md')) {
      const base = entry.slice(0, -'-SUMMARY.md'.length);
      const segs = base.split('-');
      if (segs.length >= 2 && (segs[0] === phase || segs[0] === normalizePhaseName(phase))) {
        if (segs[1] === plan || segs[1] === plan.padStart(2, '0')) return true;
      }
    }
  }
  return false;
}

function escapeGrepFixed(needle: string): string {
  // With -F (fixed-string), git treats the pattern literally. We still strip
  // newlines defensively in case a caller passes a corrupt phase/plan id.
  return needle.replace(/[\r\n]/g, '');
}

function countProductionCommits(projectDir: string, phase: string, plan: string): number {
  // Look for commits whose subject contains `({phase}-{plan})` — the
  // executor's commit-message convention from `agents/gsd-executor.md`
  // <task_commit_protocol>. We use --grep with -F (fixed-string) so the
  // parens in the pattern are not treated as regex metacharacters.
  const variants = [
    `(${phase}-${plan})`,
    `(${normalizePhaseName(phase)}-${plan})`,
    `(${phase}-${plan.padStart(2, '0')})`,
    `(${normalizePhaseName(phase)}-${plan.padStart(2, '0')})`,
  ];
  // Dedupe (if normalization is a no-op all four collapse).
  const unique = Array.from(new Set(variants));
  const seen = new Set<string>();
  for (const needle of unique) {
    try {
      const out = execFileSync(
        'git',
        ['log', '--all', '--oneline', `--grep=${escapeGrepFixed(needle)}`, '-F'],
        { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000 },
      );
      for (const line of out.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Each git-log line starts with the short hash followed by a space.
        // Dedupe by hash so commits whose subject matches multiple variants
        // (when phase/plan normalize identically) only count once.
        const hash = trimmed.split(/\s/, 1)[0];
        if (hash) seen.add(hash);
      }
    } catch {
      // git not available, not a repo, or other transient — treat as zero
      // for this variant (the caller still gets a result so workflows do
      // not hard-fail in non-git scratch dirs).
      continue;
    }
  }
  return seen.size;
}

function stateAdvancedPastPlan(projectDir: string, phase: string, plan: string, workstream?: string): boolean {
  const statePath = planningPaths(projectDir, workstream).state;
  if (!existsSync(statePath)) return false;
  let content: string;
  try {
    content = readFileSync(statePath, 'utf8');
  } catch {
    return false;
  }
  // Look for "Current Plan:" body field. `state advanced past plan` means
  // STATE.md's cursor is now on a plan with a higher numeric id within the
  // same phase, OR the phase has been incremented entirely.
  const currentPhaseMatch = content.match(/\*\*Current Phase:\*\*\s*([^\n\r]+)/i)
    || content.match(/^Current Phase:\s*([^\n\r]+)/im);
  const currentPlanMatch = content.match(/\*\*Current Plan:\*\*\s*([^\n\r]+)/i)
    || content.match(/^Current Plan:\s*([^\n\r]+)/im);
  if (!currentPhaseMatch || !currentPlanMatch) return false;
  const curPhase = normalizePhaseName(currentPhaseMatch[1].trim());
  const askPhase = normalizePhaseName(phase);
  const curPlan = parseInt(String(currentPlanMatch[1]).trim().replace(/^0+/, '') || '0', 10);
  const askPlan = parseInt(plan.replace(/^0+/, '') || '0', 10);
  if (curPhase > askPhase) return true;
  if (curPhase === askPhase && Number.isFinite(curPlan) && Number.isFinite(askPlan) && curPlan > askPlan) return true;
  // STATE.md may also encode completion via status === 'completed' for the
  // milestone — that signal is downstream of all individual plans being
  // done, so we treat it as "advanced past everything".
  if (/Status:\s*(completed|complete|done)/i.test(content)) return true;
  return false;
}

function roadmapMentionsPlanComplete(projectDir: string, phase: string, plan: string, workstream?: string): boolean {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  if (!existsSync(roadmapPath)) return false;
  let content: string;
  try {
    content = readFileSync(roadmapPath, 'utf8');
  } catch {
    return false;
  }
  // ROADMAP.md progress tables typically have rows like
  //   | Phase 04 | 03/05 plans | … |
  // We do NOT try to parse these tables — a generic check is "is there
  // any row mentioning this phase whose progress numerator >= the plan id?"
  // That is brittle, so as a deliberately-conservative proxy, we look for
  // the {phase}-{plan} pair appearing in the same line as one of the
  // completion markers. If we cannot prove completion, we report `false`
  // and let the consumer decide.
  const planNorm = plan.padStart(2, '0');
  const phaseNorm = normalizePhaseName(phase);
  const planRefs = [
    `${phase}-${plan}`, `${phaseNorm}-${plan}`,
    `${phase}-${planNorm}`, `${phaseNorm}-${planNorm}`,
  ];
  for (const line of content.split(/\r?\n/)) {
    for (const ref of planRefs) {
      if (line.includes(ref) && /[✓✔]|complete|done/i.test(line)) return true;
    }
  }
  // Fallback: phase-level completion in the roadmap implies all its plans
  // are complete.
  const phaseCompleteRe = new RegExp(`Phase\\s+${phaseNorm}\\b[^\\n\\r]*\\b(complete|done)\\b`, 'i');
  if (phaseCompleteRe.test(content)) return true;
  return false;
}

// ─── classification ─────────────────────────────────────────────────────────

function classify(
  productionCommits: number,
  summaryExists: boolean,
  stateAdvanced: boolean,
  roadmapUpdated: boolean,
): { state: PlanConsistencyState; advice: string } {
  // Truth table — order matters; matches the doc's "Possible inconsistent
  // states" table 1:1.
  if (productionCommits === 0 && !summaryExists && !stateAdvanced && !roadmapUpdated) {
    return { state: 'consistent_not_started', advice: 'Plan has not been executed; safe to dispatch.' };
  }
  if (productionCommits > 0 && summaryExists && stateAdvanced && roadmapUpdated) {
    return { state: 'consistent_complete', advice: 'Plan finished cleanly; safe to advance.' };
  }
  if (productionCommits > 0 && !summaryExists && !stateAdvanced && !roadmapUpdated) {
    return {
      state: 'drift_a_stalled_midexecute',
      advice: 'Production commits landed but SUMMARY.md is missing. Reconcile manually — do NOT redo code.',
    };
  }
  if (productionCommits > 0 && summaryExists && !stateAdvanced && !roadmapUpdated) {
    return {
      state: 'drift_b_summary_without_state',
      advice: 'SUMMARY.md exists but STATE.md / ROADMAP.md not updated. Re-run only the state-update step.',
    };
  }
  if (productionCommits > 0 && !summaryExists && stateAdvanced && roadmapUpdated) {
    return {
      state: 'drift_c_state_without_summary',
      advice: 'STATE.md advanced but SUMMARY.md is missing. Reconstruct SUMMARY from git log; do NOT redo code.',
    };
  }
  if (productionCommits === 0 && summaryExists && stateAdvanced && roadmapUpdated) {
    return {
      state: 'drift_d_phantom_done',
      advice: 'SUMMARY/state say done but no production commits exist. Investigate — likely a manually-edited STATE.md.',
    };
  }
  return {
    state: 'unknown',
    advice: 'Plan is in an unrecognized partial state. Inspect the four artifacts manually.',
  };
}

// ─── handler ────────────────────────────────────────────────────────────────

/**
 * Query handler implementing `plan.consistency-check`.
 *
 * @param args argv tail after the dispatch tokens. Must contain
 *             `--phase <id>` and `--plan <id>`.
 * @param projectDir Project root resolved by the dispatcher.
 * @param workstream Optional workstream name.
 * @returns `{ data: PlanConsistencyResult }` — never throws for missing
 *          artifacts; only throws `GSDError(Validation)` for missing argv.
 */
export const planConsistencyCheck: QueryHandler<PlanConsistencyResult> = async (args, projectDir, workstream) => {
  const { phase, plan } = parseFlagArgs(args);

  const paths = planningPaths(projectDir, workstream);
  const phaseDir = findPhaseDir(paths.phases, phase);

  const summary_exists = phaseDir ? summaryExistsForPlan(phaseDir, phase, plan) : false;
  const production_commits = countProductionCommits(projectDir, phase, plan);
  const state_advanced = stateAdvancedPastPlan(projectDir, phase, plan, workstream);
  const roadmap_updated = roadmapMentionsPlanComplete(projectDir, phase, plan, workstream);

  const { state, advice } = classify(production_commits, summary_exists, state_advanced, roadmap_updated);

  return {
    data: {
      phase,
      plan,
      state,
      production_commits,
      summary_exists,
      state_advanced,
      roadmap_updated,
      advice,
    },
  };
};
