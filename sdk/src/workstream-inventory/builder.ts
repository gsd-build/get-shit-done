/**
 * Workstream Inventory Builder — pure projection from pre-collected
 * filesystem data to typed WorkstreamInventory. No I/O. No async.
 *
 * The caller is responsible for collecting BuilderInputs from the filesystem
 * (or from test fixtures). This module performs only the stateless transformation.
 */

import { relative } from 'node:path';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkstreamPhaseInventory {
  directory: string;
  status: 'complete' | 'in_progress' | 'pending';
  plan_count: number;
  summary_count: number;
}

export interface WorkstreamInventory {
  name: string;
  path: string;
  active: boolean;
  files: {
    roadmap: boolean;
    state: boolean;
    requirements: boolean;
  };
  status: string;
  current_phase: string | null;
  last_activity: string | null;
  phases: WorkstreamPhaseInventory[];
  phase_count: number;
  completed_phases: number;
  roadmap_phase_count: number;
  total_plans: number;
  completed_plans: number;
  progress_percent: number;
}

export interface WorkstreamInventoryList {
  mode: 'flat' | 'workstream';
  active: string | null;
  workstreams: WorkstreamInventory[];
  count: number;
  message?: string;
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface BuilderInputs {
  /** The workstream name (directory basename). */
  name: string;
  /** Absolute path to the project root. */
  projectDir: string;
  /** Absolute path to the workstream directory. */
  workstreamDir: string;
  /** List of phase directory names (unsorted; builder will sort them). */
  phaseDirNames: string[];
  /** The currently active workstream name, or null if none. */
  activeWorkstreamName: string | null;
  /**
   * Pre-collected plan/summary counts per phase directory.
   * The `directory` field must match entries in `phaseDirNames`.
   */
  phaseFilesCounts: Array<{ directory: string; planCount: number; summaryCount: number }>;
  /** Phase count from the ROADMAP.md (already resolved, fallback applied). */
  roadmapPhaseCount: number;
  /** Projection from the workstream's STATE.md (already read). */
  stateProjection: { status: string; current_phase: string | null; last_activity: string | null };
  /** Whether each canonical file exists (already checked). */
  filesExist: { roadmap: boolean; state: boolean; requirements: boolean };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert a path to POSIX format (forward slashes only).
 * Pure string transform — no filesystem access.
 */
function toPosixPath(p: string): string {
  return p.split('\\').join('/');
}

// ─── Exports ──────────────────────────────────────────────────────────────────

/**
 * Pure classifier: returns true if the given status string indicates a
 * completed or archived workstream (case-insensitive, boundary-aware match).
 */
export function isCompletedInventory(status: string): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return /\bmilestone\s+complete\b/.test(s) || /\barchived\b/.test(s);
}

/**
 * Build a WorkstreamInventory from pre-collected BuilderInputs.
 *
 * This is a pure function — it does not read the filesystem and does not
 * produce side-effects. All I/O must be done by the caller before invoking.
 */
export function buildWorkstreamInventory(inputs: BuilderInputs): WorkstreamInventory {
  const {
    name,
    projectDir,
    workstreamDir,
    phaseDirNames,
    activeWorkstreamName,
    phaseFilesCounts,
    roadmapPhaseCount,
    stateProjection,
    filesExist,
  } = inputs;

  // Index counts by directory for O(1) lookup during sort/iteration
  const countsMap = new Map<string, { planCount: number; summaryCount: number }>();
  for (const entry of phaseFilesCounts) {
    countsMap.set(entry.directory, { planCount: entry.planCount, summaryCount: entry.summaryCount });
  }

  const phases: WorkstreamPhaseInventory[] = [];
  let completedPhases = 0;
  let totalPlans = 0;
  let completedPlans = 0;

  for (const dir of [...phaseDirNames].sort()) {
    const counts = countsMap.get(dir) ?? { planCount: 0, summaryCount: 0 };
    const status: WorkstreamPhaseInventory['status'] =
      counts.summaryCount >= counts.planCount && counts.planCount > 0
        ? 'complete'
        : counts.planCount > 0
          ? 'in_progress'
          : 'pending';

    totalPlans += counts.planCount;
    completedPlans += Math.min(counts.summaryCount, counts.planCount);
    if (status === 'complete') completedPhases++;

    phases.push({
      directory: dir,
      status,
      plan_count: counts.planCount,
      summary_count: counts.summaryCount,
    });
  }

  return {
    name,
    path: toPosixPath(relative(projectDir, workstreamDir)),
    active: name === activeWorkstreamName,
    files: {
      roadmap: filesExist.roadmap,
      state: filesExist.state,
      requirements: filesExist.requirements,
    },
    status: stateProjection.status,
    current_phase: stateProjection.current_phase,
    last_activity: stateProjection.last_activity,
    phases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    roadmap_phase_count: roadmapPhaseCount,
    total_plans: totalPlans,
    completed_plans: completedPlans,
    progress_percent:
      roadmapPhaseCount > 0
        ? Math.min(100, Math.round((completedPhases / roadmapPhaseCount) * 100))
        : 0,
  };
}
