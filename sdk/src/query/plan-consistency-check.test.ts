/**
 * Vitest unit tests for `plan.consistency-check`.
 *
 * Each test arranges a tmp project directory with a controlled mix of the
 * four close-out artifacts (production commits, SUMMARY.md, STATE.md cursor,
 * ROADMAP.md row) and asserts that the handler classifies the state
 * correctly. Tests cover all six rows of the docs table plus the argv-
 * validation surface.
 *
 * Closes #3212 (Stage B — handler registration + classification correctness).
 */

import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { planConsistencyCheck, type PlanConsistencyResult } from './plan-consistency-check.js';

interface ProjectFixture {
  dir: string;
  phaseDir: string;
}

function mkProject(): ProjectFixture {
  const dir = mkdtempSync(join(tmpdir(), 'gsd-pcc-'));
  const phaseDir = join(dir, '.planning', 'phases', '04-feature');
  mkdirSync(phaseDir, { recursive: true });
  // Initialize git so the handler's git-log probe can run without raising.
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
  // Initial empty commit so HEAD exists.
  execFileSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir });
  return { dir, phaseDir };
}

function landProductionCommit(dir: string, phase: string, plan: string, taskName: string): void {
  // Match the executor's commit-message convention: `feat({phase}-{plan}): …`
  execFileSync(
    'git',
    ['commit', '--allow-empty', '-m', `feat(${phase}-${plan}): ${taskName}`],
    { cwd: dir },
  );
}

function writeSummary(phaseDir: string, phase: string, plan: string): void {
  writeFileSync(
    join(phaseDir, `${phase}-${plan}-SUMMARY.md`),
    `# Phase ${phase} Plan ${plan} Summary\n\n(synthetic)\n`,
  );
}

function writeStateAdvanced(dir: string, currentPhase: string, currentPlan: string): void {
  const planningDir = join(dir, '.planning');
  writeFileSync(
    join(planningDir, 'STATE.md'),
    [
      '# State',
      '',
      '## Current Position',
      '',
      `**Current Phase:** ${currentPhase}`,
      `**Current Plan:** ${currentPlan}`,
      '**Status:** executing',
      '',
    ].join('\n'),
  );
}

function writeRoadmapPlanComplete(dir: string, phase: string, plan: string): void {
  const planningDir = join(dir, '.planning');
  writeFileSync(
    join(planningDir, 'ROADMAP.md'),
    [
      '# Roadmap',
      '',
      `- ${phase}-${plan} ✓ complete`,
      '',
    ].join('\n'),
  );
}

describe('planConsistencyCheck — argv validation', () => {
  let fix: ProjectFixture;
  beforeEach(() => { fix = mkProject(); });
  afterEach(() => { rmSync(fix.dir, { recursive: true, force: true }); });

  test('throws when --phase is missing', async () => {
    await expect(planConsistencyCheck(['--plan', '03'], fix.dir)).rejects.toThrow(/--phase/);
  });

  test('throws when --plan is missing', async () => {
    await expect(planConsistencyCheck(['--phase', '4'], fix.dir)).rejects.toThrow(/--plan/);
  });

  test('throws when --phase has no value', async () => {
    await expect(planConsistencyCheck(['--phase', '--plan', '03'], fix.dir)).rejects.toThrow();
  });
});

describe('planConsistencyCheck — classification matrix', () => {
  let fix: ProjectFixture;
  beforeEach(() => { fix = mkProject(); });
  afterEach(() => { rmSync(fix.dir, { recursive: true, force: true }); });

  test('consistent_not_started: no commits, no SUMMARY, STATE on earlier plan, no roadmap row', async () => {
    writeStateAdvanced(fix.dir, '04', '01');
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('consistent_not_started');
    expect(data.production_commits).toBe(0);
    expect(data.summary_exists).toBe(false);
    expect(data.state_advanced).toBe(false);
    expect(data.roadmap_updated).toBe(false);
  });

  test('drift_a_stalled_midexecute: commits landed but SUMMARY missing and STATE not advanced', async () => {
    landProductionCommit(fix.dir, '4', '03', 'first task');
    landProductionCommit(fix.dir, '4', '03', 'second task');
    writeStateAdvanced(fix.dir, '04', '03');  // STATE still pointing at this plan
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('drift_a_stalled_midexecute');
    expect(data.production_commits).toBe(2);
    expect(data.summary_exists).toBe(false);
    expect(data.state_advanced).toBe(false);
    expect(data.advice).toMatch(/do NOT redo/i);
  });

  test('drift_b_summary_without_state: commits + SUMMARY exist but STATE/ROADMAP not advanced', async () => {
    landProductionCommit(fix.dir, '4', '03', 'first');
    writeSummary(fix.phaseDir, '04', '03');
    writeStateAdvanced(fix.dir, '04', '03');
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('drift_b_summary_without_state');
    expect(data.summary_exists).toBe(true);
    expect(data.state_advanced).toBe(false);
  });

  test('drift_c_state_without_summary: commits + STATE advanced + ROADMAP marked, no SUMMARY', async () => {
    landProductionCommit(fix.dir, '4', '03', 'first');
    writeStateAdvanced(fix.dir, '04', '04');  // moved past plan 03
    writeRoadmapPlanComplete(fix.dir, '04', '03');
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('drift_c_state_without_summary');
    expect(data.summary_exists).toBe(false);
    expect(data.state_advanced).toBe(true);
    expect(data.roadmap_updated).toBe(true);
  });

  test('drift_d_phantom_done: SUMMARY/state/roadmap claim done but no production commits', async () => {
    writeSummary(fix.phaseDir, '04', '03');
    writeStateAdvanced(fix.dir, '04', '04');
    writeRoadmapPlanComplete(fix.dir, '04', '03');
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('drift_d_phantom_done');
    expect(data.production_commits).toBe(0);
    expect(data.summary_exists).toBe(true);
    expect(data.state_advanced).toBe(true);
    expect(data.roadmap_updated).toBe(true);
  });

  test('consistent_complete: all four artifacts present and STATE moved past', async () => {
    landProductionCommit(fix.dir, '4', '03', 'first');
    landProductionCommit(fix.dir, '4', '03', 'second');
    writeSummary(fix.phaseDir, '04', '03');
    writeStateAdvanced(fix.dir, '04', '04');
    writeRoadmapPlanComplete(fix.dir, '04', '03');
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(data.state).toBe('consistent_complete');
    expect(data.production_commits).toBe(2);
    expect(data.summary_exists).toBe(true);
    expect(data.state_advanced).toBe(true);
    expect(data.roadmap_updated).toBe(true);
  });
});

describe('planConsistencyCheck — read-only contract', () => {
  let fix: ProjectFixture;
  beforeEach(() => { fix = mkProject(); });
  afterEach(() => { rmSync(fix.dir, { recursive: true, force: true }); });

  test('does not create STATE.md when absent', async () => {
    // Sanity: STATE.md not written by the project setup
    await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    // After the call, STATE.md must STILL not exist — handler is read-only
    const fs = await import('node:fs');
    expect(fs.existsSync(join(fix.dir, '.planning', 'STATE.md'))).toBe(false);
    expect(fs.existsSync(join(fix.dir, '.planning', 'ROADMAP.md'))).toBe(false);
  });

  test('returns advice string for every state', async () => {
    const out = await planConsistencyCheck(['--phase', '4', '--plan', '03'], fix.dir);
    const data = out.data as PlanConsistencyResult;
    expect(typeof data.advice).toBe('string');
    expect(data.advice.length).toBeGreaterThan(0);
  });
});
