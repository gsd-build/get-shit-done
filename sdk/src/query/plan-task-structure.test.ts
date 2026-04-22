/**
 * Unit tests for plan.task-structure.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planTaskStructure } from './plan-task-structure.js';

const PLAN = `---
phase: 09-foundation
plan: "01"
wave: 2
depends_on: []
autonomous: false
---

<objective>
Test objective
</objective>

<tasks>
<task type="auto">
  <name>First</name>
</task>
<task type="checkpoint">
  <name>Gate</name>
</task>
</tasks>
`;

let tmpDir: string;
let planPath: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-pts-'));
  const rel = join('.planning', 'phases', '09-x', '09-01-PLAN.md');
  planPath = join(tmpDir, rel);
  await mkdir(join(tmpDir, '.planning', 'phases', '09-x'), { recursive: true });
  await writeFile(planPath, PLAN);
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('planTaskStructure', () => {
  it('returns wave, tasks, and checkpoints', async () => {
    const rel = join('.planning', 'phases', '09-x', '09-01-PLAN.md');
    const r = await planTaskStructure([rel], tmpDir);
    const d = r.data as {
      wave: number;
      autonomous: boolean;
      task_count: number;
      checkpoint_count: number;
      tasks: Array<{ is_checkpoint: boolean }>;
    };
    expect(d.wave).toBe(2);
    expect(d.autonomous).toBe(false);
    expect(d.task_count).toBe(2);
    expect(d.checkpoint_count).toBe(1);
    expect(d.tasks.filter((t) => t.is_checkpoint).length).toBe(1);
  });
});
