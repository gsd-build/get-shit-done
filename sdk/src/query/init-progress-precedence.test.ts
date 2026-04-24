/**
 * Regression guard for #2674.
 *
 * initProgress and initManager must agree on phase status given the same
 * inputs. Specifically, a ROADMAP `- [x] Phase N` checkbox wins over disk
 * state: a stub phase directory with no SUMMARY.md that is checked in
 * ROADMAP reports as `complete` from both handlers.
 *
 * Pre-fix: initManager reported `complete` (explicit override at line ~451),
 * initProgress reported `pending` (disk-only policy). This mismatch meant
 * /gsd-manager and /gsd-progress disagreed on the same data. Post-fix:
 * both apply the ROADMAP-[x]-wins policy.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProgress, initManager } from './init-complex.js';

/** Find a phase by numeric value regardless of zero-padding ('3' vs '03'). */
function findPhase(
  phases: Record<string, unknown>[],
  num: number,
): Record<string, unknown> | undefined {
  return phases.find(p => parseInt(p.number as string, 10) === num);
}

let tmpDir: string;

const CONFIG = JSON.stringify({
  model_profile: 'balanced',
  commit_docs: false,
  git: {
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    quick_branch_template: null,
  },
  workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
});

const STATE = [
  '---',
  'milestone: v1.0',
  '---',
].join('\n');

/**
 * Write a ROADMAP.md with the given phase list. Each entry is
 * `{num, name, checked}`. Emits both the checkbox summary lines AND the
 * `### Phase N:` heading sections (so initManager picks them up).
 */
async function writeRoadmap(
  dir: string,
  phases: Array<{ num: string; name: string; checked: boolean }>,
): Promise<void> {
  const checkboxes = phases
    .map(p => `- [${p.checked ? 'x' : ' '}] Phase ${p.num}: ${p.name}`)
    .join('\n');
  const sections = phases
    .map(p => `### Phase ${p.num}: ${p.name}\n\n**Goal:** ${p.name} goal\n\n**Depends on:** None\n`)
    .join('\n');
  await writeFile(join(dir, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '',
    '## v1.0: Test',
    '',
    checkboxes,
    '',
    sections,
  ].join('\n'));
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-2674-'));
  await mkdir(join(tmpDir, '.planning', 'phases'), { recursive: true });
  await writeFile(join(tmpDir, '.planning', 'config.json'), CONFIG);
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('initProgress + initManager precedence (#2674)', () => {
  it('case 1: ROADMAP [x] + stub phase dir + no SUMMARY → both report complete', async () => {
    await writeRoadmap(tmpDir, [{ num: '3', name: 'Stubbed', checked: true }]);
    await mkdir(join(tmpDir, '.planning', 'phases', '03-stubbed'), { recursive: true });
    // stub dir, no PLAN/SUMMARY/RESEARCH/CONTEXT files

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    const pPhase = findPhase(progress.phases as Record<string, unknown>[], 3);
    const mPhase = findPhase(manager.phases as Record<string, unknown>[], 3);

    expect(pPhase?.status).toBe('complete');
    expect(mPhase?.disk_status).toBe('complete');
  });

  it('case 2: ROADMAP [x] + phase dir + SUMMARY present → both complete (sanity)', async () => {
    await writeRoadmap(tmpDir, [{ num: '3', name: 'Done', checked: true }]);
    await mkdir(join(tmpDir, '.planning', 'phases', '03-done'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'phases', '03-done', '03-01-PLAN.md'), '# plan');
    await writeFile(join(tmpDir, '.planning', 'phases', '03-done', '03-01-SUMMARY.md'), '# done');

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    const pPhase = findPhase(progress.phases as Record<string, unknown>[], 3);
    const mPhase = findPhase(manager.phases as Record<string, unknown>[], 3);

    expect(pPhase?.status).toBe('complete');
    expect(mPhase?.disk_status).toBe('complete');
  });

  it('case 3: ROADMAP [ ] + phase dir + SUMMARY present → disk authoritative (complete)', async () => {
    await writeRoadmap(tmpDir, [{ num: '3', name: 'Disk', checked: false }]);
    await mkdir(join(tmpDir, '.planning', 'phases', '03-disk'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'phases', '03-disk', '03-01-PLAN.md'), '# plan');
    await writeFile(join(tmpDir, '.planning', 'phases', '03-disk', '03-01-SUMMARY.md'), '# done');

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    const pPhase = findPhase(progress.phases as Record<string, unknown>[], 3);
    const mPhase = findPhase(manager.phases as Record<string, unknown>[], 3);

    expect(pPhase?.status).toBe('complete');
    expect(mPhase?.disk_status).toBe('complete');
  });

  it('case 4: ROADMAP [ ] + stub phase dir + no SUMMARY → not complete', async () => {
    await writeRoadmap(tmpDir, [{ num: '3', name: 'Empty', checked: false }]);
    await mkdir(join(tmpDir, '.planning', 'phases', '03-empty'), { recursive: true });

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    const pPhase = findPhase(progress.phases as Record<string, unknown>[], 3);
    const mPhase = findPhase(manager.phases as Record<string, unknown>[], 3);

    // Neither should be 'complete' — preserves pre-existing classification.
    expect(pPhase?.status).not.toBe('complete');
    expect(mPhase?.disk_status).not.toBe('complete');
  });

  it('case 5: ROADMAP [x] + no phase dir → both complete (ROADMAP-only branch preserved)', async () => {
    await writeRoadmap(tmpDir, [{ num: '3', name: 'Paper', checked: true }]);
    // no directory for phase 3

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    const pPhase = findPhase(progress.phases as Record<string, unknown>[], 3);
    const mPhase = findPhase(manager.phases as Record<string, unknown>[], 3);

    expect(pPhase?.status).toBe('complete');
    expect(mPhase?.disk_status).toBe('complete');
  });

  it('case 6: completed_count agrees across handlers for the stub-dir [x] case', async () => {
    await writeRoadmap(tmpDir, [
      { num: '3', name: 'Stub', checked: true },
      { num: '4', name: 'Todo', checked: false },
    ]);
    await mkdir(join(tmpDir, '.planning', 'phases', '03-stub'), { recursive: true });
    await mkdir(join(tmpDir, '.planning', 'phases', '04-todo'), { recursive: true });

    const progress = (await initProgress([], tmpDir)).data as Record<string, unknown>;
    const manager = (await initManager([], tmpDir)).data as Record<string, unknown>;

    expect(progress.completed_count).toBe(1);
    expect(manager.completed_count).toBe(1);
  });
});
