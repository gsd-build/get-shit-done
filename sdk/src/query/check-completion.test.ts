/**
 * Unit tests for `check.completion` (decision-routing audit §3.7).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompletion } from './check-completion.js';

describe('checkCompletion', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-check-completion-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when scope arg is missing', async () => {
    await expect(checkCompletion([], projectDir)).rejects.toThrow();
  });

  it('throws when scope is invalid', async () => {
    await expect(checkCompletion(['invalid', '1'], projectDir)).rejects.toThrow();
  });

  it('throws when phase number is missing for phase scope', async () => {
    await expect(checkCompletion(['phase'], projectDir)).rejects.toThrow();
  });

  describe('phase scope', () => {
    it('returns complete true when all plans have summaries', async () => {
      const phaseDir = join(projectDir, '.planning', 'phases', '01-foundation');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '01-01-PLAN.md'), '---\nphase: 1\n---\n', 'utf-8');
      await writeFile(join(phaseDir, '01-02-PLAN.md'), '---\nphase: 1\n---\n', 'utf-8');
      await writeFile(join(phaseDir, '01-01-SUMMARY.md'), '# Summary', 'utf-8');
      await writeFile(join(phaseDir, '01-02-SUMMARY.md'), '# Summary', 'utf-8');

      const { data } = await checkCompletion(['phase', '1'], projectDir);
      const d = data as Record<string, unknown>;
      expect(d.complete).toBe(true);
      expect(d.plans_total).toBe(2);
      expect(d.plans_with_summaries).toBe(2);
      expect((d.missing_summaries as string[]).length).toBe(0);
    });

    it('returns complete false when not all plans have summaries', async () => {
      const phaseDir = join(projectDir, '.planning', 'phases', '02-core');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '02-01-PLAN.md'), '---\nphase: 2\n---\n', 'utf-8');
      await writeFile(join(phaseDir, '02-02-PLAN.md'), '---\nphase: 2\n---\n', 'utf-8');
      await writeFile(join(phaseDir, '02-01-SUMMARY.md'), '# Summary', 'utf-8');

      const { data } = await checkCompletion(['phase', '2'], projectDir);
      const d = data as Record<string, unknown>;
      expect(d.complete).toBe(false);
      expect(d.plans_total).toBe(2);
      expect(d.plans_with_summaries).toBe(1);
      expect((d.missing_summaries as string[]).length).toBe(1);
    });

    it('includes debt rollup fields', async () => {
      const phaseDir = join(projectDir, '.planning', 'phases', '03-api');
      await mkdir(phaseDir, { recursive: true });

      const { data } = await checkCompletion(['phase', '3'], projectDir);
      const d = data as Record<string, unknown>;
      const debt = d.debt as Record<string, unknown>;
      expect(debt).toBeDefined();
      expect(typeof debt.uat_gaps).toBe('number');
      expect(typeof debt.verification_failures).toBe('number');
      expect(typeof debt.human_needed).toBe('boolean');
    });

    it('returns verification_status from VERIFICATION.md when present', async () => {
      const phaseDir = join(projectDir, '.planning', 'phases', '04-ui');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '04-01-PLAN.md'), '---\nphase: 4\n---\n', 'utf-8');
      await writeFile(join(phaseDir, '04-01-SUMMARY.md'), '# Summary', 'utf-8');
      await writeFile(
        join(phaseDir, 'VERIFICATION.md'),
        '---\nstatus: passed\n---\n\n| ID | Description | Status |\n|---|---|---|\n| T-01 | Auth works | PASS |',
        'utf-8',
      );

      const { data } = await checkCompletion(['phase', '4'], projectDir);
      const d = data as Record<string, unknown>;
      expect(d.verification_status).not.toBeNull();
    });
  });

  describe('milestone scope', () => {
    it('returns milestone completion fields', async () => {
      await writeFile(
        join(projectDir, '.planning', 'ROADMAP.md'),
        '# Roadmap\n\n## Phase 01: Foundation\n\n## Phase 02: Core\n',
        'utf-8',
      );

      const { data } = await checkCompletion(['milestone', 'v1.0'], projectDir);
      const d = data as Record<string, unknown>;
      expect(typeof d.complete).toBe('boolean');
      expect(typeof d.phase_count).toBe('number');
      expect(typeof d.phases_complete).toBe('number');
      expect(Array.isArray(d.phases_incomplete)).toBe(true);
    });
  });
});
