/**
 * Unit tests for phase.list-plans and phase.list-artifacts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GSDError } from '../errors.js';
import { phaseListPlans, phaseListArtifacts } from './phase-list-queries.js';

const PLAN_A = `---
phase: 09-foundation
plan: 01
wave: 1
must_haves:
  truths: []
---

<objective>
A
</objective>
<tasks><task type="auto"><name>T</name></task></tasks>
`;

const PLAN_B = `---
phase: 09-foundation
plan: 02
wave: 1
---

<objective>
B
</objective>
<tasks><task type="auto"><name>T</name></task></tasks>
`;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-plans-'));
  const phaseDir = join(tmpDir, '.planning', 'phases', '09-foundation');
  await mkdir(phaseDir, { recursive: true });
  await writeFile(join(phaseDir, '09-01-PLAN.md'), PLAN_A);
  await writeFile(join(phaseDir, '09-02-PLAN.md'), PLAN_B);
  await writeFile(join(phaseDir, '09-CONTEXT.md'), 'ctx');
  await writeFile(join(phaseDir, '09-RESEARCH.md'), 'res');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('phaseListPlans', () => {
  it('lists all plans in phase', async () => {
    const r = await phaseListPlans(['9'], tmpDir);
    const data = r.data as { plans: Array<{ id: string }> };
    expect(data.plans.map((p) => p.id).sort()).toEqual(['09-01', '09-02']);
  });

  it('filters with --with-schema', async () => {
    const r = await phaseListPlans(['9', '--with-schema', 'must_haves'], tmpDir);
    const data = r.data as { plans: Array<{ id: string }> };
    expect(data.plans.map((p) => p.id)).toEqual(['09-01']);
  });

  it('throws when phase missing', async () => {
    await expect(phaseListPlans([], tmpDir)).rejects.toThrow(GSDError);
  });
});

describe('phaseListArtifacts', () => {
  it('lists context artifacts', async () => {
    const r = await phaseListArtifacts(['9', '--type', 'context'], tmpDir);
    const data = r.data as { artifacts: string[] };
    expect(data.artifacts.some((a) => a.endsWith('09-CONTEXT.md'))).toBe(true);
  });

  it('lists research artifacts', async () => {
    const r = await phaseListArtifacts(['9', '--type', 'research'], tmpDir);
    const data = r.data as { artifacts: string[] };
    expect(data.artifacts.some((a) => a.endsWith('09-RESEARCH.md'))).toBe(true);
  });

  it('throws without --type', async () => {
    await expect(phaseListArtifacts(['9'], tmpDir)).rejects.toThrow(GSDError);
  });
});
