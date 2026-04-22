/**
 * Unit tests for phase query handlers.
 *
 * Tests findPhase and phasePlanIndex handlers.
 * Uses temp directories with real .planning/ structures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';

import { findPhase, phasePlanIndex } from './phase.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const PLAN_01_CONTENT = `---
phase: 09-foundation
plan: 01
wave: 1
autonomous: true
files_modified:
  - sdk/src/errors.ts
  - sdk/src/errors.test.ts
---

<objective>
Build error classification system.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Create error types</name>
</task>
<task type="auto">
  <name>Task 2: Add exit codes</name>
</task>
</tasks>
`;

const PLAN_02_CONTENT = `---
phase: 09-foundation
plan: 02
wave: 1
autonomous: false
files_modified:
  - sdk/src/query/registry.ts
---

<objective>
Build query registry.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Registry class</name>
</task>
<task type="checkpoint:human-verify">
  <name>Task 2: Verify registry</name>
</task>
</tasks>
`;

const PLAN_03_CONTENT = `---
phase: 09-foundation
plan: 03
wave: 2
autonomous: true
---

<objective>
Golden file tests.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Setup golden files</name>
</task>
</tasks>
`;

let tmpDir: string;

// ─── Setup / Teardown ──────────────────────────────────────────────────────

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-phase-test-'));
  const planningDir = join(tmpDir, '.planning');
  const phasesDir = join(planningDir, 'phases');

  await mkdir(phasesDir, { recursive: true });

  // Phase 09
  const phase09 = join(phasesDir, '09-foundation');
  await mkdir(phase09, { recursive: true });
  await writeFile(join(phase09, '09-01-PLAN.md'), PLAN_01_CONTENT);
  await writeFile(join(phase09, '09-01-SUMMARY.md'), 'Summary 1');
  await writeFile(join(phase09, '09-02-PLAN.md'), PLAN_02_CONTENT);
  await writeFile(join(phase09, '09-02-SUMMARY.md'), 'Summary 2');
  await writeFile(join(phase09, '09-03-PLAN.md'), PLAN_03_CONTENT);
  // No summary for plan 03 (incomplete)
  await writeFile(join(phase09, '09-RESEARCH.md'), 'Research');
  await writeFile(join(phase09, '09-CONTEXT.md'), 'Context');

  // Phase 10
  const phase10 = join(phasesDir, '10-read-only-queries');
  await mkdir(phase10, { recursive: true });
  await writeFile(join(phase10, '10-01-PLAN.md'), '---\nphase: 10\nplan: 01\n---\n<objective>\nPort helpers.\n</objective>\n<tasks>\n<task type="auto">\n  <name>Task 1</name>\n</task>\n</tasks>');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── findPhase ─────────────────────────────────────────────────────────────

describe('findPhase', () => {
  it('finds existing phase by number', async () => {
    const result = await findPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.found).toBe(true);
    expect(data.phase_number).toBe('09');
    expect(data.phase_name).toBe('foundation');
  });

  it('returns posix-style directory path', async () => {
    const result = await findPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.directory).toBe('.planning/phases/09-foundation');
    // No backslashes
    expect((data.directory as string)).not.toContain('\\');
  });

  it('lists plans and summaries', async () => {
    const result = await findPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    const plans = data.plans as string[];
    const summaries = data.summaries as string[];

    expect(plans.length).toBe(3);
    expect(summaries.length).toBe(2);
    expect(plans).toContain('09-01-PLAN.md');
    expect(summaries).toContain('09-01-SUMMARY.md');
  });

  it('returns not found for nonexistent phase', async () => {
    const result = await findPhase(['99'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.found).toBe(false);
    expect(data.directory).toBeNull();
    expect(data.phase_number).toBeNull();
    expect(data.plans).toEqual([]);
    expect(data.summaries).toEqual([]);
  });

  it('throws GSDError with Validation classification when no args', async () => {
    await expect(findPhase([], tmpDir)).rejects.toThrow(GSDError);
    try {
      await findPhase([], tmpDir);
    } catch (err) {
      expect((err as GSDError).classification).toBe('validation');
    }
  });

  it('handles two-digit phase numbers', async () => {
    const result = await findPhase(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.found).toBe(true);
    expect(data.phase_number).toBe('10');
    expect(data.phase_name).toBe('read-only-queries');
  });

  it('includes file stats (research, context)', async () => {
    const result = await findPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.has_research).toBe(true);
    expect(data.has_context).toBe(true);
  });

  it('computes incomplete plans', async () => {
    const result = await findPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const incompletePlans = data.incomplete_plans as string[];

    expect(incompletePlans.length).toBe(1);
    expect(incompletePlans[0]).toBe('09-03-PLAN.md');
  });

  it('searches archived milestone phases', async () => {
    // Create archived milestone directory
    const archiveDir = join(tmpDir, '.planning', 'milestones', 'v1.0-phases', '01-setup');
    await mkdir(archiveDir, { recursive: true });
    await writeFile(join(archiveDir, '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\n---\nPlan');
    await writeFile(join(archiveDir, '01-01-SUMMARY.md'), 'Summary');

    const result = await findPhase(['1'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.found).toBe(true);
    expect(data.archived).toBe('v1.0');
  });
});

// ─── phasePlanIndex ────────────────────────────────────────────────────────

describe('phasePlanIndex', () => {
  it('returns plan metadata for phase', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase).toBe('09');
    const plans = data.plans as Array<Record<string, unknown>>;
    expect(plans.length).toBe(3);
  });

  it('includes plan details (id, wave, autonomous, objective, task_count)', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const plans = data.plans as Array<Record<string, unknown>>;

    const plan1 = plans.find(p => p.id === '09-01');
    expect(plan1).toBeDefined();
    expect(plan1!.wave).toBe(1);
    expect(plan1!.autonomous).toBe(true);
    expect(plan1!.objective).toBe('Build error classification system.');
    expect(plan1!.task_count).toBe(2);
    expect(plan1!.has_summary).toBe(true);
  });

  it('correctly counts XML task tags', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const plans = data.plans as Array<Record<string, unknown>>;

    const plan1 = plans.find(p => p.id === '09-01');
    expect(plan1!.task_count).toBe(2);

    const plan2 = plans.find(p => p.id === '09-02');
    expect(plan2!.task_count).toBe(2);

    const plan3 = plans.find(p => p.id === '09-03');
    expect(plan3!.task_count).toBe(1);
  });

  it('groups plans by wave', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const waves = data.waves as Record<string, string[]>;

    expect(waves['1']).toContain('09-01');
    expect(waves['1']).toContain('09-02');
    expect(waves['2']).toContain('09-03');
  });

  it('identifies incomplete plans', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const incomplete = data.incomplete as string[];

    expect(incomplete).toContain('09-03');
    expect(incomplete).not.toContain('09-01');
  });

  it('detects has_checkpoints from non-autonomous plans', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Plan 02 has autonomous: false
    expect(data.has_checkpoints).toBe(true);
  });

  it('parses files_modified from frontmatter', async () => {
    const result = await phasePlanIndex(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const plans = data.plans as Array<Record<string, unknown>>;

    const plan1 = plans.find(p => p.id === '09-01');
    const filesModified = plan1!.files_modified as string[];

    expect(filesModified).toContain('sdk/src/errors.ts');
    expect(filesModified).toContain('sdk/src/errors.test.ts');
  });

  it('throws GSDError with Validation classification when no args', async () => {
    await expect(phasePlanIndex([], tmpDir)).rejects.toThrow(GSDError);
    try {
      await phasePlanIndex([], tmpDir);
    } catch (err) {
      expect((err as GSDError).classification).toBe('validation');
    }
  });

  it('returns error for nonexistent phase', async () => {
    const result = await phasePlanIndex(['99'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.error).toBe('Phase not found');
    expect(data.plans).toEqual([]);
  });
});
