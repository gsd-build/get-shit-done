/**
 * GSD Tools Tests — Bug #3257
 *
 * Regression guard: `buildStateFrontmatter` must count plan/summary files in
 * the nested `phases/<N>-<slug>/plans/<N>-PLAN-<NN>-<slug>.md` layout (written
 * by gsd-plan-phase post-#3139). Prior to this fix, the loop did a flat
 * `readdirSync` on the phase directory and missed every file inside the
 * `plans/` subdirectory, so `progress.total_plans` and
 * `progress.completed_plans` were silently under-counted on every state
 * mutation that flows through `syncStateFrontmatter → buildStateFrontmatter`.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Write a minimal STATE.md that will trigger syncStateFrontmatter on any write.
 */
function writeStateFile(tmpDir, overrides = {}) {
  const phase = overrides.phase || '01';
  const status = overrides.status || 'executing';
  const content = [
    '# Project State',
    '',
    `**Current Phase:** ${phase}`,
    `**Status:** ${status}`,
    '',
    '## Current Position',
    '',
    `Phase: ${phase} — In progress`,
    'Status: Executing',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), content, 'utf-8');
}

/**
 * Write a ROADMAP.md listing the given phase numbers so the milestone-scoped
 * filter includes them (avoids needing a milestone header to count phases).
 */
function writeRoadmap(tmpDir, phaseNums) {
  const lines = ['## Roadmap v1.0'];
  for (const n of phaseNums) {
    lines.push('', `### Phase ${n}: Phase ${n}`);
  }
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'ROADMAP.md'),
    lines.join('\n'),
    'utf-8'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nested layout — core bug (#3257)
// ─────────────────────────────────────────────────────────────────────────────

describe('buildStateFrontmatter nested plans/ layout (#3257)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('counts plans and summaries in nested plans/ subdirectory', () => {
    // Layout: phases/01-init/plans/1-PLAN-01-setup.md etc.
    // 2 phases × 3 plans each, all completed (3 summaries each).
    for (let phase = 1; phase <= 2; phase++) {
      const phaseSlug = `0${phase}-phase-${phase}`;
      const phaseDir = path.join(tmpDir, '.planning', 'phases', phaseSlug);
      const plansDir = path.join(phaseDir, 'plans');
      fs.mkdirSync(plansDir, { recursive: true });

      for (let plan = 1; plan <= 3; plan++) {
        const planPad = String(plan).padStart(2, '0');
        // Reporter's format: {N}-PLAN-{NN}-{slug}.md
        const planFile = `${phase}-PLAN-${planPad}-step${plan}.md`;
        const summaryFile = `${phase}-SUMMARY-${planPad}-step${plan}.md`;
        fs.writeFileSync(path.join(plansDir, planFile), '# Plan\n');
        fs.writeFileSync(path.join(plansDir, summaryFile), '# Summary\n');
      }
    }

    writeRoadmap(tmpDir, [1, 2]);
    writeStateFile(tmpDir, { phase: '02' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    assert.strictEqual(Number(progress.total_plans), 6, 'total_plans must count nested plans/ files (2 phases × 3 plans)');
    assert.strictEqual(Number(progress.completed_plans), 6, 'completed_plans must count nested summary files (2 phases × 3 summaries)');
    assert.strictEqual(Number(progress.completed_phases), 2, 'completed_phases: both phases have summaries >= plans');
  });

  test('counts PLAN-NN-slug form (bare PLAN- prefix, no phase prefix)', () => {
    // roadmap.cjs uses /^PLAN-\d+.*\.md$/i — test that form too.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    fs.writeFileSync(path.join(plansDir, 'PLAN-01-foundation.md'), '# Plan\n');
    fs.writeFileSync(path.join(plansDir, 'PLAN-02-infra.md'), '# Plan\n');
    fs.writeFileSync(path.join(plansDir, 'SUMMARY-01-foundation.md'), '# Summary\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    assert.strictEqual(Number(progress.total_plans), 2, 'bare PLAN-NN-slug.md files must be counted');
    assert.strictEqual(Number(progress.completed_plans), 1, 'SUMMARY-NN-slug.md files must be counted');
    // 1 summary < 2 plans → phase NOT completed
    assert.strictEqual(Number(progress.completed_phases), 0, 'phase not complete when summaries < plans');
  });

  test('flat-layout repos are unaffected (no plans/ subdirectory)', () => {
    // Pre-#3139 flat layout: plans live directly in the phase dir.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    fs.mkdirSync(phaseDir, { recursive: true });

    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    assert.strictEqual(Number(progress.total_plans), 2, 'flat layout: top-level *-PLAN.md files counted');
    assert.strictEqual(Number(progress.completed_plans), 2, 'flat layout: top-level *-SUMMARY.md files counted');
    assert.strictEqual(Number(progress.completed_phases), 1, 'flat layout: phase complete when summaries >= plans');
  });

  test('no double-count when both top-level and nested plan files coexist', () => {
    // Edge case: phase has a top-level plan AND a plans/ subdir.
    // Only the nested files should be counted (or both, depending on logic),
    // but the critical thing is no file is counted twice.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    // Top-level flat plan
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Top-level Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Top-level Summary\n');

    // Nested plan
    fs.writeFileSync(path.join(plansDir, '1-PLAN-02-nested.md'), '# Nested Plan\n');
    fs.writeFileSync(path.join(plansDir, '1-SUMMARY-02-nested.md'), '# Nested Summary\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    // 1 top-level + 1 nested = 2 total (not 4 from double-counting)
    assert.strictEqual(Number(progress.total_plans), 2, 'mixed layout: no double-counting of plan files');
    assert.strictEqual(Number(progress.completed_plans), 2, 'mixed layout: no double-counting of summary files');
  });

  test('empty plans/ directory is a no-op (does not break counting)', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });
    // plans/ dir exists but is empty

    // One top-level plan
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '# Plan\n');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    assert.strictEqual(Number(progress.total_plans), 1, 'empty plans/ must not add phantom plan count');
    assert.strictEqual(Number(progress.completed_plans), 1, 'empty plans/ must not affect summary count');
    assert.strictEqual(Number(progress.completed_phases), 1, 'phase complete: 1 summary >= 1 plan');
  });

  test('PLAN-OUTLINE.md files are excluded from nested plan count', () => {
    // phase.cjs explicitly excludes *-PLAN-OUTLINE.md (not real plans).
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    fs.writeFileSync(path.join(plansDir, '1-PLAN-01-work.md'), '# Real Plan\n');
    // Outline file — should NOT count as a plan
    fs.writeFileSync(path.join(plansDir, '1-PLAN-OUTLINE.md'), '# Outline\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    // Only the real plan should count; outline excluded.
    assert.strictEqual(Number(progress.total_plans), 1, 'PLAN-OUTLINE.md must not count as a plan');
  });

  test('reporter scenario: 2 phases × multiple plans, all complete', () => {
    // Mirrors the reporter's observation: after a state mutation the progress
    // block should reflect the TRUE on-disk count, not an under-count.
    // Phase 1: 4 plans, all with summaries.
    // Phase 2: 3 plans, all with summaries.
    // Expected: total=7, completed=7, completed_phases=2.
    const phases = [
      { num: 1, plans: 4 },
      { num: 2, plans: 3 },
    ];

    for (const { num, plans } of phases) {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', `0${num}-phase-${num}`);
      const plansDir = path.join(phaseDir, 'plans');
      fs.mkdirSync(plansDir, { recursive: true });

      for (let p = 1; p <= plans; p++) {
        const pad = String(p).padStart(2, '0');
        fs.writeFileSync(path.join(plansDir, `${num}-PLAN-${pad}-task${p}.md`), '# Plan\n');
        fs.writeFileSync(path.join(plansDir, `${num}-SUMMARY-${pad}-task${p}.md`), '# Summary\n');
      }
    }

    writeRoadmap(tmpDir, [1, 2]);
    writeStateFile(tmpDir, { phase: '02' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    assert.strictEqual(Number(progress.total_plans), 7, 'reporter scenario: total_plans must be 7');
    assert.strictEqual(Number(progress.completed_plans), 7, 'reporter scenario: completed_plans must be 7');
    assert.strictEqual(Number(progress.completed_phases), 2, 'reporter scenario: both phases complete');
    assert.strictEqual(Number(progress.percent), 100, 'reporter scenario: 100% when all plans have summaries');
  });
});
