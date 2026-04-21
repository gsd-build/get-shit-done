/**
 * Phase readiness snapshot (`check.phase-ready`).
 *
 * Deterministic file + plan/summary counts and a suggested `next_step` for orchestration.
 * See `.planning/research/decision-routing-audit.md` §3.4.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { GSDError, ErrorClassification } from '../errors.js';
import { comparePhaseNum, escapeRegex, normalizePhaseName, planningPaths } from './helpers.js';
import { findPhase } from './phase.js';
import { roadmapAnalyze } from './roadmap.js';
import type { QueryHandler } from './utils.js';

const UI_INDICATOR_RE = /UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget/i;

/**
 * True if ROADMAP phase heading line for this phase matches UI_INDICATOR_RE.
 */
async function roadmapPhaseLineHasUiIndicators(
  projectDir: string,
  phaseNum: string,
  workstream?: string,
): Promise<boolean> {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;
  let content: string;
  try {
    content = await readFile(roadmapPath, 'utf-8');
  } catch {
    return false;
  }
  const re = new RegExp(
    `#{2,4}\\s*Phase\\s+${escapeRegex(phaseNum)}\\s*:[^\\n]*`,
    'i',
  );
  const m = content.match(re);
  if (!m) return false;
  return UI_INDICATOR_RE.test(m[0]);
}

function hasUiSpecFile(phaseDirFull: string): boolean {
  if (!existsSync(phaseDirFull)) return false;
  try {
    const files = readdirSync(phaseDirFull);
    return files.some(f => f === 'UI-SPEC.md' || f.endsWith('-UI-SPEC.md'));
  } catch {
    return false;
  }
}

/**
 * Whether all roadmap phases strictly before `phaseNum` are complete on disk / roadmap.
 */
function dependenciesMet(
  phases: Array<Record<string, unknown>>,
  phaseNum: string,
): boolean {
  const sorted = [...phases].sort((a, b) =>
    comparePhaseNum(String(a.number), String(b.number)),
  );
  const idx = sorted.findIndex(p => normalizePhaseName(String(p.number)) === normalizePhaseName(phaseNum));
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    const p = sorted[i];
    const complete =
      p.roadmap_complete === true ||
      p.disk_status === 'complete';
    if (!complete) return false;
  }
  return true;
}

type NextStep = 'discuss' | 'plan' | 'execute' | 'verify' | 'complete';

function inferNextStep(params: {
  found: boolean;
  has_context: boolean;
  has_research: boolean;
  plan_count: number;
  incomplete_plans: string[];
  has_verification: boolean;
}): NextStep {
  if (!params.found) return 'discuss';
  if (!params.has_context && !params.has_research) return 'discuss';
  if (params.plan_count === 0) return 'plan';
  if (params.incomplete_plans.length > 0) return 'execute';
  if (!params.has_verification) return 'verify';
  return 'complete';
}

export const checkPhaseReady: QueryHandler = async (args, projectDir, workstream) => {
  const raw = args[0];
  if (!raw) {
    throw new GSDError('phase number required for check phase-ready', ErrorClassification.Validation);
  }
  const phaseArg = normalizePhaseName(raw);

  const phaseRes = await findPhase([raw], projectDir, workstream);
  const pdata = phaseRes.data as Record<string, unknown>;
  const found = Boolean(pdata.found);

  const planCount = (pdata.plans as string[] | undefined)?.length ?? 0;
  const incomplete = (pdata.incomplete_plans as string[] | undefined) ?? [];
  const has_context = Boolean(pdata.has_context);
  const has_research = Boolean(pdata.has_research);
  const has_verification = Boolean(pdata.has_verification);

  let has_ui_spec = false;
  let phaseDirFull: string | null = null;
  if (found && pdata.directory) {
    phaseDirFull = join(projectDir, pdata.directory as string);
    has_ui_spec = hasUiSpecFile(phaseDirFull);
  }

  const phaseNumForRoadmap = (pdata.phase_number as string) || phaseArg;
  const has_ui_indicators =
    (await roadmapPhaseLineHasUiIndicators(projectDir, phaseNumForRoadmap, workstream)) ||
    (phaseNumForRoadmap !== phaseArg ? await roadmapPhaseLineHasUiIndicators(projectDir, phaseArg, workstream) : false);

  const analysis = await roadmapAnalyze([], projectDir, workstream);
  const adata = analysis.data as { phases?: Array<Record<string, unknown>> };
  const phases = adata.phases ?? [];
  const deps = dependenciesMet(phases, phaseArg);

  const next_step = inferNextStep({
    found,
    has_context,
    has_research,
    plan_count: planCount,
    incomplete_plans: incomplete,
    has_verification,
  });

  /** Phase exists on disk and prior roadmap phases are complete — safe to focus on `next_step`. */
  const ready = found && deps;

  return {
    data: {
      found,
      ready,
      phase: phaseArg,
      phase_name: (pdata.phase_name as string) ?? null,
      phase_dir: (pdata.directory as string) ?? null,
      has_context,
      has_research,
      has_plans: planCount > 0,
      plan_count: planCount,
      incomplete_plans: incomplete.length,
      has_verification,
      has_ui_spec,
      has_ui_indicators,
      dependencies_met: deps,
      blockers: [] as string[],
      next_step,
    },
  };
};
