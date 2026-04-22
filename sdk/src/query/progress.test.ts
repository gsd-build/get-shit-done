/**
 * Unit tests for progress query handlers.
 *
 * Tests progressJson and determinePhaseStatus.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { progressJson, determinePhaseStatus } from './progress.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'progress-test-'));
  await mkdir(join(tmpDir, '.planning', 'phases'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── determinePhaseStatus ─────────────────────────────────────────────────

describe('determinePhaseStatus', () => {
  it('returns Pending when no plans', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    const status = await determinePhaseStatus(0, 0, phaseDir);
    expect(status).toBe('Pending');
  });

  it('returns Planned when plans but no summaries', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    const status = await determinePhaseStatus(3, 0, phaseDir);
    expect(status).toBe('Planned');
  });

  it('returns In Progress when some summaries', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    const status = await determinePhaseStatus(3, 1, phaseDir);
    expect(status).toBe('In Progress');
  });

  it('returns Executed when all summaries but no VERIFICATION.md', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    const status = await determinePhaseStatus(3, 3, phaseDir);
    expect(status).toBe('Executed');
  });

  it('returns Complete when VERIFICATION.md has status: passed', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'VERIFICATION.md'), '---\nstatus: passed\n---\n');
    const status = await determinePhaseStatus(3, 3, phaseDir);
    expect(status).toBe('Complete');
  });

  it('returns Needs Review when VERIFICATION.md has status: human_needed', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'VERIFICATION.md'), '---\nstatus: human_needed\n---\n');
    const status = await determinePhaseStatus(3, 3, phaseDir);
    expect(status).toBe('Needs Review');
  });

  it('returns Executed when VERIFICATION.md has status: gaps_found', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'VERIFICATION.md'), '---\nstatus: gaps_found\n---\n');
    const status = await determinePhaseStatus(3, 3, phaseDir);
    expect(status).toBe('Executed');
  });

  it('returns Executed when VERIFICATION.md has unrecognized status', async () => {
    const phaseDir = join(tmpDir, '.planning', 'phases', '01-test');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, 'VERIFICATION.md'), '---\nstatus: unknown\n---\n');
    const status = await determinePhaseStatus(3, 3, phaseDir);
    expect(status).toBe('Executed');
  });
});

// ─── progressJson ─────────────────────────────────────────────────────────

describe('progressJson', () => {
  it('returns progress data with phases', async () => {
    // Create ROADMAP.md for milestone info
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '## v1.0: First Milestone\n');

    // Create phase directories with plans/summaries
    const phase1 = join(tmpDir, '.planning', 'phases', '01-foundation');
    const phase2 = join(tmpDir, '.planning', 'phases', '02-features');
    await mkdir(phase1, { recursive: true });
    await mkdir(phase2, { recursive: true });

    await writeFile(join(phase1, '01-01-PLAN.md'), '');
    await writeFile(join(phase1, '01-01-SUMMARY.md'), '');
    await writeFile(join(phase2, '02-01-PLAN.md'), '');

    const result = await progressJson([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.milestone_version).toBe('v1.0');
    expect(data.milestone_name).toBe('First Milestone');
    expect(data.total_plans).toBe(2);
    expect(data.total_summaries).toBe(1);
    expect(data.percent).toBe(50);

    const phases = data.phases as Array<Record<string, unknown>>;
    expect(phases.length).toBe(2);

    // Phase 1: 1 plan, 1 summary (dir name 01-foundation => number '01')
    expect(phases[0].number).toBe('01');
    expect(phases[0].name).toBe('foundation');
    expect(phases[0].plans).toBe(1);
    expect(phases[0].summaries).toBe(1);

    // Phase 2: 1 plan, 0 summaries (dir name 02-features => number '02')
    expect(phases[1].number).toBe('02');
    expect(phases[1].plans).toBe(1);
    expect(phases[1].summaries).toBe(0);
    expect(phases[1].status).toBe('Planned');
  });

  it('returns 0 percent when no plans', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '## v1.0: Milestone\n');
    const result = await progressJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.percent).toBe(0);
    expect(data.total_plans).toBe(0);
  });

  it('sorts phases by comparePhaseNum order', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), '## v1.0: Milestone\n');

    const phase10 = join(tmpDir, '.planning', 'phases', '10-later');
    const phase2 = join(tmpDir, '.planning', 'phases', '02-early');
    await mkdir(phase10, { recursive: true });
    await mkdir(phase2, { recursive: true });

    const result = await progressJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Array<Record<string, unknown>>;

    expect(phases[0].number).toBe('02');
    expect(phases[1].number).toBe('10');
  });
});
