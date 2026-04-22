/**
 * Next slash-command suggestion for `/gsd-next`-style routing (`route.next-action`).
 *
 * Deterministic routing from STATE.md, ROADMAP, and phase directories.
 * See `.planning/research/decision-routing-audit.md` §3.1 and `get-shit-done/workflows/next.md`.
 */

import { readFile, readdir } from 'node:fs/promises';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { planningPaths, normalizePhaseName, comparePhaseNum } from './helpers.js';
import { stateJson } from './state.js';
import { roadmapAnalyze } from './roadmap.js';
import { findPhase } from './phase.js';
import type { QueryHandler } from './utils.js';

function readConsecutiveCallCount(planningDir: string): number {
  try {
    const raw = readFileSync(join(planningDir, '.next-call-count'), 'utf-8');
    return parseInt(raw.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/** Unresolved FAIL rows in phase VERIFICATION.md (lightweight gate). */
async function hasUnresolvedVerificationFails(phaseDirAbs: string): Promise<boolean> {
  try {
    const files = await readdir(phaseDirAbs);
    const vf = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
    if (!vf) return false;
    const content = await readFile(join(phaseDirAbs, vf), 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      if (/\|\s*FAIL\s*\|/i.test(line) && !/override/i.test(line)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function verificationPassed(phaseDirAbs: string): Promise<boolean> {
  try {
    const files = await readdir(phaseDirAbs);
    const vf = files.find(f => f === 'VERIFICATION.md' || f.endsWith('-VERIFICATION.md'));
    if (!vf) return false;
    const content = await readFile(join(phaseDirAbs, vf), 'utf-8');
    return /status:\s*passed/i.test(content);
  } catch {
    return false;
  }
}

export const routeNextAction: QueryHandler = async (_args, projectDir, workstream) => {
  const planning = planningPaths(projectDir, workstream).planning;
  const continueHere = existsSync(join(planning, '.continue-here.md'));

  const sj = await stateJson([], projectDir, workstream);
  const sjd = sj.data as Record<string, unknown>;
  if (sjd.error) {
    return {
      data: {
        command: '/gsd-new-project',
        args: '',
        reason: 'No STATE.md — initialize a GSD project first',
        current_phase: null,
        phase_name: null,
        gates: {
          continue_here: continueHere,
          error_state: false,
          unresolved_verification: false,
          consecutive_calls: 0,
        },
        context: {},
      },
    };
  }

  const status = String(sjd.status ?? '');
  const errorState = /\b(error|failed)\b/i.test(status);
  const pausedAt = sjd.paused_at ? String(sjd.paused_at) : null;
  let currentPhase = sjd.current_phase ? String(sjd.current_phase) : null;
  const phaseName = sjd.current_phase_name ? String(sjd.current_phase_name) : null;

  const consecutiveCalls = readConsecutiveCallCount(planning);

  const ra = await roadmapAnalyze([], projectDir, workstream);
  const raData = ra.data as { phases?: Array<Record<string, unknown>> };
  const phases = raData.phases ?? [];

  const phasesDir = planningPaths(projectDir, workstream).phases;
  let dirCount = 0;
  try {
    dirCount = readdirSync(phasesDir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
  } catch { /* no phases dir */ }

  let unresolvedVerification = false;
  if (currentPhase) {
    const fp = await findPhase([currentPhase], projectDir, workstream);
    const fd = fp.data as Record<string, unknown>;
    if (fd.found && fd.directory) {
      unresolvedVerification = await hasUnresolvedVerificationFails(
        join(projectDir, fd.directory as string),
      );
    }
  }

  const gates = {
    continue_here: continueHere,
    error_state: errorState,
    unresolved_verification: unresolvedVerification,
    consecutive_calls: consecutiveCalls,
  };

  const buildContext = async (cp: string | null) => {
    if (!cp) {
      return {
        has_context: false,
        has_research: false,
        has_plans: false,
        plan_count: 0,
        summary_count: 0,
        has_verification: false,
        paused_at: pausedAt,
        uat_gaps: 0,
      };
    }
    const fp = await findPhase([cp], projectDir, workstream);
    const d = fp.data as Record<string, unknown>;
    const plans = (d.plans as string[]) ?? [];
    const summaries = (d.summaries as string[]) ?? [];
    return {
      has_context: Boolean(d.has_context),
      has_research: Boolean(d.has_research),
      has_plans: plans.length > 0,
      plan_count: plans.length,
      summary_count: summaries.length,
      has_verification: Boolean(d.has_verification),
      paused_at: pausedAt,
      uat_gaps: 0,
    };
  };

  if (pausedAt) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-resume-work',
        args: '',
        reason: 'Paused — resume work before other routing',
        current_phase: currentPhase,
        phase_name: phaseName,
        gates,
        context: { ...ctx, paused_at: pausedAt },
      },
    };
  }

  if (continueHere || errorState || unresolvedVerification) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '',
        args: '',
        reason: continueHere
          ? 'Blocked: .planning/.continue-here.md exists'
          : errorState
            ? 'Blocked: STATE.md status is error or failed'
            : 'Blocked: unresolved VERIFICATION FAIL items',
        current_phase: currentPhase,
        phase_name: phaseName,
        gates,
        context: ctx,
      },
    };
  }

  // Route 1 — ROADMAP lists phases but no phase directories
  if (phases.length > 0 && dirCount === 0) {
    const first = String(phases[0].number);
    const ctx = await buildContext(first);
    return {
      data: {
        command: '/gsd-discuss-phase',
        args: first,
        reason: 'ROADMAP has phases but no phase directories on disk yet',
        current_phase: first,
        phase_name: String(phases[0].name ?? ''),
        gates,
        context: ctx,
      },
    };
  }

  if (!currentPhase && phases.length > 0) {
    currentPhase = String(phases[0].number);
  }

  if (!currentPhase) {
    const ctx = await buildContext(null);
    return {
      data: {
        command: '',
        args: '',
        reason: 'No current phase in STATE.md and no roadmap phases',
        current_phase: null,
        phase_name: null,
        gates,
        context: ctx,
      },
    };
  }

  const fp = await findPhase([currentPhase], projectDir, workstream);
  const pd = fp.data as Record<string, unknown>;
  const found = Boolean(pd.found);
  const cp = normalizePhaseName(currentPhase);
  const displayName = (pd.phase_name as string) || phaseName || '';

  const sorted = [...phases].sort((a, b) =>
    comparePhaseNum(String(a.number), String(b.number)),
  );

  if (!found) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-discuss-phase',
        args: cp,
        reason: 'Phase directory not found — start with discuss',
        current_phase: currentPhase,
        phase_name: displayName,
        gates,
        context: ctx,
      },
    };
  }

  const plans = (pd.plans as string[]) ?? [];
  const incomplete = (pd.incomplete_plans as string[]) ?? [];
  const hasContext = Boolean(pd.has_context);
  const hasResearch = Boolean(pd.has_research);
  const phaseDirAbs = pd.directory ? join(projectDir, pd.directory as string) : '';

  // Route 2
  if (!hasContext && !hasResearch) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-discuss-phase',
        args: cp,
        reason: 'No CONTEXT.md or RESEARCH.md for this phase',
        current_phase: currentPhase,
        phase_name: displayName,
        gates,
        context: ctx,
      },
    };
  }

  // Route 3
  if (plans.length === 0) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-plan-phase',
        args: cp,
        reason: 'Context exists but no PLAN.md files',
        current_phase: currentPhase,
        phase_name: displayName,
        gates,
        context: ctx,
      },
    };
  }

  // Route 4
  if (incomplete.length > 0) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-execute-phase',
        args: cp,
        reason: `${incomplete.length} plan(s) still need SUMMARY.md`,
        current_phase: currentPhase,
        phase_name: displayName,
        gates,
        context: ctx,
      },
    };
  }

  // Summaries match plans — verification / advance
  const verPassed = phaseDirAbs ? await verificationPassed(phaseDirAbs) : false;
  const hasVerFile = Boolean(pd.has_verification);

  if (!hasVerFile || !verPassed) {
    const ctx = await buildContext(currentPhase);
    return {
      data: {
        command: '/gsd-verify-work',
        args: '',
        reason: 'All plans have summaries — run verification',
        current_phase: currentPhase,
        phase_name: displayName,
        gates,
        context: ctx,
      },
    };
  }

  // Phase verified — Route 6 vs 7 handled by allComplete above; find next incomplete phase
  const idx = sorted.findIndex(p => normalizePhaseName(String(p.number)) === cp);
  const next = idx >= 0 ? sorted.slice(idx + 1).find(p => p.disk_status !== 'complete' && !p.roadmap_complete) : null;

  if (next) {
    const nextNum = String(next.number);
    const ctx = await buildContext(nextNum);
    return {
      data: {
        command: '/gsd-discuss-phase',
        args: nextNum,
        reason: 'Current phase verified — advance to next phase',
        current_phase: nextNum,
        phase_name: String(next.name ?? ''),
        gates,
        context: ctx,
      },
    };
  }

  const ctx = await buildContext(currentPhase);
  return {
    data: {
      command: '/gsd-complete-milestone',
      args: '',
      reason: 'Verified phase with no further phases — complete milestone',
      current_phase: currentPhase,
      phase_name: displayName,
      gates,
      context: ctx,
    },
  };
};
