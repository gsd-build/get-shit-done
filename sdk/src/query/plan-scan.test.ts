import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { isRootPlanFile, scanPhasePlans } from './plan-scan.js';

describe('isRootPlanFile', () => {
  // Legacy <N>-PLAN-<NN> flat layout (pre-#3139): the summary filename
  // `14-PLAN-01-SUMMARY.md` contains the substring "PLAN", so the broad
  // /PLAN/i fallback used to mis-classify it as a plan file — double-counting
  // every summary as a plan and dragging the phase's completion ratio down.
  it('rejects a legacy -PLAN-NN-SUMMARY.md summary masquerading as a plan', () => {
    expect(isRootPlanFile('14-PLAN-01-SUMMARY.md')).toBe(false);
  });

  it('still accepts the matching legacy -PLAN-NN.md plan file', () => {
    expect(isRootPlanFile('14-PLAN-01.md')).toBe(true);
  });
});

describe('scanPhasePlans — legacy <N>-PLAN-<NN> flat layout', () => {
  it('does not double-count -PLAN-NN-SUMMARY.md files as plans', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-legacy-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '14');
      await mkdir(phaseDir, { recursive: true });
      for (const n of ['01', '02', '03', '04']) {
        await writeFile(join(phaseDir, `14-PLAN-${n}.md`), '# Plan');
        await writeFile(join(phaseDir, `14-PLAN-${n}-SUMMARY.md`), '# Summary');
      }

      // Four plans, four summaries → a completed phase. Before the fix this
      // reported planCount: 8 (summaries counted as plans) and completed: false.
      expect(scanPhasePlans(phaseDir)).toMatchObject({
        planCount: 4,
        summaryCount: 4,
        completed: true,
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('scanPhasePlans', () => {
  it('counts flat and nested plan files while excluding derivative files', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plan-scan-'));
    try {
      const phaseDir = join(tmpDir, 'phases', '1');
      const nestedDir = join(phaseDir, 'plans');
      await mkdir(nestedDir, { recursive: true });
      await writeFile(join(phaseDir, '01-01-PLAN.md'), '# Plan');
      await writeFile(join(phaseDir, '01-01-SUMMARY.md'), '# Summary');
      await writeFile(join(phaseDir, '01-01-PLAN-OUTLINE.md'), '# Outline');
      await writeFile(join(nestedDir, 'PLAN-02-next.md'), '# Plan');
      await writeFile(join(nestedDir, 'SUMMARY-02-next.md'), '# Summary');
      await writeFile(join(nestedDir, 'PLAN-03-draft.pre-bounce.md'), '# Draft');
      await writeFile(join(nestedDir, 'PLAN-04-OUTLINE.md'), '# Outline');

      expect(scanPhasePlans(phaseDir)).toMatchObject({
        planCount: 2,
        summaryCount: 2,
        completed: true,
        hasNestedPlans: true,
        planFiles: ['01-01-PLAN.md', 'PLAN-02-next.md'],
        summaryFiles: ['01-01-SUMMARY.md', 'SUMMARY-02-next.md'],
      });
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
