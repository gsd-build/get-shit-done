import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { scanPhasePlans } from './plan-scan.js';

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
