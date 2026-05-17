/**
 * Pinning tests for the Workstream Inventory Builder.
 *
 * The Builder is pure (no I/O). It takes pre-collected BuilderInputs and
 * returns a WorkstreamInventory. These tests lock the projection logic against
 * the canonical shape defined in sdk/src/query/workstream-inventory.ts.
 */

import { describe, it, expect } from 'vitest';
import { buildWorkstreamInventory, isCompletedInventory } from './builder.js';
import type { BuilderInputs } from './builder.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function minimalInputs(overrides: Partial<BuilderInputs> = {}): BuilderInputs {
  return {
    name: 'my-ws',
    projectDir: '/project',
    workstreamDir: '/project/.planning/workstreams/my-ws',
    phaseDirNames: [],
    activeWorkstreamName: null,
    phaseFilesCounts: [],
    roadmapPhaseCount: 0,
    stateProjection: { status: 'unknown', current_phase: null, last_activity: null },
    filesExist: { roadmap: false, state: false, requirements: false },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildWorkstreamInventory', () => {
  it('empty inventory: no phase dirs, no STATE.md', () => {
    const result = buildWorkstreamInventory(minimalInputs());
    expect(result).toEqual({
      name: 'my-ws',
      path: '.planning/workstreams/my-ws',
      active: false,
      files: { roadmap: false, state: false, requirements: false },
      status: 'unknown',
      current_phase: null,
      last_activity: null,
      phases: [],
      phase_count: 0,
      completed_phases: 0,
      roadmap_phase_count: 0,
      total_plans: 0,
      completed_plans: 0,
      progress_percent: 0,
    });
  });

  it('one phase in_progress (partial plan completion)', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['01-alpha'],
        phaseFilesCounts: [{ directory: '01-alpha', planCount: 3, summaryCount: 1 }],
        roadmapPhaseCount: 1,
        stateProjection: { status: 'executing', current_phase: '01-alpha', last_activity: '2026-05-01' },
        filesExist: { roadmap: true, state: true, requirements: false },
      }),
    );
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0]).toEqual({
      directory: '01-alpha',
      status: 'in_progress',
      plan_count: 3,
      summary_count: 1,
    });
    expect(result.phase_count).toBe(1);
    expect(result.completed_phases).toBe(0);
    expect(result.total_plans).toBe(3);
    expect(result.completed_plans).toBe(1);
    expect(result.progress_percent).toBe(0);
    expect(result.status).toBe('executing');
    expect(result.current_phase).toBe('01-alpha');
    expect(result.last_activity).toBe('2026-05-01');
    expect(result.files).toEqual({ roadmap: true, state: true, requirements: false });
  });

  it('one phase complete (summary_count >= plan_count)', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['01-alpha'],
        phaseFilesCounts: [{ directory: '01-alpha', planCount: 2, summaryCount: 2 }],
        roadmapPhaseCount: 1,
        stateProjection: { status: 'milestone complete', current_phase: null, last_activity: '2026-04-01' },
        filesExist: { roadmap: true, state: true, requirements: true },
      }),
    );
    expect(result.phases[0].status).toBe('complete');
    expect(result.completed_phases).toBe(1);
    expect(result.progress_percent).toBe(100);
    expect(result.completed_plans).toBe(2);
  });

  it('one phase pending (plan_count is 0)', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['01-alpha'],
        phaseFilesCounts: [{ directory: '01-alpha', planCount: 0, summaryCount: 0 }],
        roadmapPhaseCount: 1,
        stateProjection: { status: 'planning', current_phase: null, last_activity: null },
      }),
    );
    expect(result.phases[0].status).toBe('pending');
    expect(result.completed_phases).toBe(0);
    expect(result.progress_percent).toBe(0);
  });

  it('multiple phases with mixed statuses', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['01-alpha', '02-beta', '03-gamma'],
        phaseFilesCounts: [
          { directory: '01-alpha', planCount: 2, summaryCount: 2 }, // complete
          { directory: '02-beta', planCount: 3, summaryCount: 1 },  // in_progress
          { directory: '03-gamma', planCount: 0, summaryCount: 0 }, // pending
        ],
        roadmapPhaseCount: 3,
        stateProjection: { status: 'executing', current_phase: '02-beta', last_activity: '2026-05-10' },
        filesExist: { roadmap: true, state: true, requirements: false },
      }),
    );
    expect(result.phases).toHaveLength(3);
    expect(result.phases[0].status).toBe('complete');
    expect(result.phases[1].status).toBe('in_progress');
    expect(result.phases[2].status).toBe('pending');
    expect(result.completed_phases).toBe(1);
    expect(result.total_plans).toBe(5);
    expect(result.completed_plans).toBe(3); // 2 from alpha + min(1,3)=1 from beta + 0 from gamma
    expect(result.progress_percent).toBe(Math.round((1 / 3) * 100)); // 33
    expect(result.roadmap_phase_count).toBe(3);
  });

  it('progress_percent clamps to 100 when completedPhases > roadmapPhaseCount', () => {
    // 3 phase dirs all complete, but roadmap only has 1 entry
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['01-alpha', '02-beta', '03-gamma'],
        phaseFilesCounts: [
          { directory: '01-alpha', planCount: 1, summaryCount: 1 },
          { directory: '02-beta', planCount: 1, summaryCount: 1 },
          { directory: '03-gamma', planCount: 1, summaryCount: 1 },
        ],
        roadmapPhaseCount: 1,
        stateProjection: { status: 'milestone complete', current_phase: null, last_activity: null },
        filesExist: { roadmap: true, state: true, requirements: false },
      }),
    );
    expect(result.completed_phases).toBe(3);
    expect(result.roadmap_phase_count).toBe(1);
    expect(result.progress_percent).toBe(100);
  });

  it('active workstream marker: active: true when activeWorkstreamName === name', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        name: 'my-ws',
        activeWorkstreamName: 'my-ws',
      }),
    );
    expect(result.active).toBe(true);
  });

  it('active: false when activeWorkstreamName is a different workstream', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        name: 'my-ws',
        activeWorkstreamName: 'other-ws',
      }),
    );
    expect(result.active).toBe(false);
  });

  it('phases are sorted by directory name', () => {
    // Provide dirs in reverse order to verify sorting
    const result = buildWorkstreamInventory(
      minimalInputs({
        phaseDirNames: ['03-gamma', '01-alpha', '02-beta'],
        phaseFilesCounts: [
          { directory: '03-gamma', planCount: 1, summaryCount: 0 },
          { directory: '01-alpha', planCount: 1, summaryCount: 1 },
          { directory: '02-beta', planCount: 1, summaryCount: 0 },
        ],
        roadmapPhaseCount: 3,
        stateProjection: { status: 'executing', current_phase: null, last_activity: null },
        filesExist: { roadmap: true, state: false, requirements: false },
      }),
    );
    expect(result.phases.map((p) => p.directory)).toEqual(['01-alpha', '02-beta', '03-gamma']);
  });

  it('path is relative from projectDir to workstreamDir using posix separators', () => {
    const result = buildWorkstreamInventory(
      minimalInputs({
        projectDir: '/home/user/project',
        workstreamDir: '/home/user/project/.planning/workstreams/my-ws',
      }),
    );
    expect(result.path).toBe('.planning/workstreams/my-ws');
  });
});

describe('isCompletedInventory', () => {
  it('returns true for "milestone complete"', () => {
    expect(isCompletedInventory('milestone complete')).toBe(true);
  });

  it('returns true for "Milestone Complete" (case-insensitive)', () => {
    expect(isCompletedInventory('Milestone Complete')).toBe(true);
  });

  it('returns true for "archived"', () => {
    expect(isCompletedInventory('archived')).toBe(true);
  });

  it('returns true for "Archived"', () => {
    expect(isCompletedInventory('Archived')).toBe(true);
  });

  it('returns false for "executing"', () => {
    expect(isCompletedInventory('executing')).toBe(false);
  });

  it('returns false for "planning"', () => {
    expect(isCompletedInventory('planning')).toBe(false);
  });

  it('returns false for "unknown"', () => {
    expect(isCompletedInventory('unknown')).toBe(false);
  });

  it('returns false for "unarchived" (word-boundary guard)', () => {
    expect(isCompletedInventory('unarchived')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isCompletedInventory('')).toBe(false);
  });
});
