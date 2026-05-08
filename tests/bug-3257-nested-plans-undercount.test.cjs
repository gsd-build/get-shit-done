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

  test('pre-bounce files are excluded from nested plan count (bare PLAN- prefix)', () => {
    // CR finding: PLAN_PRE_BOUNCE_RE was /-PLAN.*\.pre-bounce\.md$/i which missed
    // bare-prefix files like PLAN-01-foo.pre-bounce.md. Fixed to /\.pre-bounce\.md$/i.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    fs.writeFileSync(path.join(plansDir, '1-PLAN-01-work.md'), '# Real Plan\n');
    // Pre-bounce files — should NOT count as plans
    fs.writeFileSync(path.join(plansDir, 'PLAN-01-work.pre-bounce.md'), '# Pre-bounce\n');
    fs.writeFileSync(path.join(plansDir, '1-PLAN-01-work.pre-bounce.md'), '# Pre-bounce\n');

    writeRoadmap(tmpDir, [1]);
    writeStateFile(tmpDir, { phase: '01' });

    const result = runGsdTools('state update "Last Activity" "2026-05-08"', tmpDir);
    assert.ok(result.success, `state update failed: ${result.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const progress = JSON.parse(jsonResult.output).progress;
    // Only the real plan should count; pre-bounce files excluded.
    assert.strictEqual(Number(progress.total_plans), 1, 'pre-bounce files must not count as plans');
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

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateValidate nested plans/ layout (#3257 — CR finding)
//
// Prior to this fix, cmdStateValidate did a flat readdirSync on the phase dir
// and returned diskPlans=0 for nested layouts, causing false drift warnings
// when STATE.md correctly said "Total Plans in Phase: 3".
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateValidate nested plans/ layout (#3257)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('no false drift warning when STATE.md plan count matches nested disk count', () => {
    // Phase 01-init: 3 nested plans, 0 summaries (still executing).
    // STATE.md says "Total Plans in Phase: 3" — after the fix, validate sees
    // diskPlans=3 and emits no plan_count drift warning.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    for (let p = 1; p <= 3; p++) {
      const pad = String(p).padStart(2, '0');
      fs.writeFileSync(path.join(plansDir, `1-PLAN-${pad}-step${p}.md`), '# Plan\n');
    }

    // Write STATE.md with correct plan count so validate can check for drift.
    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** executing',
      '**Total Plans in Phase:** 3',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `state validate failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.valid, `state validate should be valid; warnings: ${JSON.stringify(parsed.warnings)}`);
    assert.deepStrictEqual(parsed.warnings, [], 'no drift warnings for nested-layout phase with correct plan count');
    assert.ok(!parsed.drift.plan_count, 'no plan_count drift when nested scan matches STATE.md');
  });

  test('emits drift warning when STATE.md plan count does not match nested disk count', () => {
    // STATE.md says 5 but only 2 plans exist on disk — validate should catch it.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    for (let p = 1; p <= 2; p++) {
      const pad = String(p).padStart(2, '0');
      fs.writeFileSync(path.join(plansDir, `1-PLAN-${pad}-step${p}.md`), '# Plan\n');
    }

    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** executing',
      '**Total Plans in Phase:** 5',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `state validate failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(!parsed.valid, 'state validate should report invalid when plan counts differ');
    assert.ok(parsed.warnings.length > 0, 'at least one drift warning expected');
    assert.ok(parsed.drift.plan_count, 'plan_count drift object must be present');
    assert.strictEqual(parsed.drift.plan_count.disk, 2, 'disk count must reflect nested scan (2 nested plans)');
    assert.strictEqual(parsed.drift.plan_count.state, 5, 'state count from STATE.md must be 5');
  });

  test('PLAN-OUTLINE.md excluded from nested count in validate', () => {
    // Outline files must not inflate diskPlans and cause false "too few" drift.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    fs.writeFileSync(path.join(plansDir, '1-PLAN-01-work.md'), '# Plan\n');
    fs.writeFileSync(path.join(plansDir, '1-PLAN-OUTLINE.md'), '# Outline\n'); // must not count

    // STATE.md claims 1 plan — correct after exclusion.
    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** executing',
      '**Total Plans in Phase:** 1',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state validate', tmpDir);
    assert.ok(result.success, `state validate failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.valid, `should be valid (outline excluded); warnings: ${JSON.stringify(parsed.warnings)}`);
    assert.ok(!parsed.drift.plan_count, 'no plan_count drift when outline excluded from nested count');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cmdStateSync nested plans/ layout (#3257 — CR finding)
//
// Prior to this fix, cmdStateSync did a flat readdirSync on each phase dir,
// returning plans=0 for nested layouts. It would set "Total Plans in Phase"
// to 0 even when plans existed inside plans/ — an under-count that corrupts
// the STATE.md progress block.
// ─────────────────────────────────────────────────────────────────────────────

describe('cmdStateSync nested plans/ layout (#3257)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('updates Total Plans in Phase from 0 to correct nested count on sync', () => {
    // Disk: phase 01-init with 3 nested plans, no summaries.
    // STATE.md says "Total Plans in Phase: 0" (stale / pre-fix value).
    // After sync, the field must be updated to 3.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    for (let p = 1; p <= 3; p++) {
      const pad = String(p).padStart(2, '0');
      fs.writeFileSync(path.join(plansDir, `1-PLAN-${pad}-step${p}.md`), '# Plan\n');
    }

    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** executing',
      '**Total Plans in Phase:** 0',
      '**Progress:** [░░░░░░░░░░] 0%',
      '**Last Activity:** 2026-01-01',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state sync', tmpDir);
    assert.ok(result.success, `state sync failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.synced, 'sync must report synced: true');
    // The "Total Plans in Phase" change must appear in the changes list.
    const planCountChange = parsed.changes.find(c => c.startsWith('Total Plans in Phase:'));
    assert.ok(planCountChange, `changes must include Total Plans in Phase update; got: ${JSON.stringify(parsed.changes)}`);
    assert.ok(planCountChange.includes('-> 3'), `Total Plans in Phase must update to 3; got: "${planCountChange}"`);
  });

  test('sync dry-run reports correct nested plan count without writing', () => {
    // --verify flag: sync must report what WOULD change but not write STATE.md.
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-init');
    const plansDir = path.join(phaseDir, 'plans');
    fs.mkdirSync(plansDir, { recursive: true });

    for (let p = 1; p <= 2; p++) {
      const pad = String(p).padStart(2, '0');
      fs.writeFileSync(path.join(plansDir, `PLAN-${pad}-task${p}.md`), '# Plan\n');
    }

    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 01',
      '**Status:** executing',
      '**Total Plans in Phase:** 0',
      '**Progress:** [░░░░░░░░░░] 0%',
      '**Last Activity:** 2026-01-01',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state sync --verify', tmpDir);
    assert.ok(result.success, `state sync --verify failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.dry_run, 'dry_run must be true with --verify flag');
    const planCountChange = parsed.changes.find(c => c.startsWith('Total Plans in Phase:'));
    assert.ok(planCountChange, `dry-run changes must include Total Plans in Phase; got: ${JSON.stringify(parsed.changes)}`);
    assert.ok(planCountChange.includes('-> 2'), `dry-run must show correct count of 2; got: "${planCountChange}"`);

    // STATE.md must be unchanged (dry-run): re-run sync --verify and confirm the
    // same pending change is still reported (if STATE.md had been written, the
    // change would have been applied and the second run would show no changes).
    const result2 = runGsdTools('state sync --verify', tmpDir);
    assert.ok(result2.success, `second dry-run failed: ${result2.error}`);
    const parsed2 = JSON.parse(result2.output);
    const planCountChange2 = parsed2.changes.find(c => c.startsWith('Total Plans in Phase:'));
    assert.ok(planCountChange2, 'repeated dry-run must still report pending change (file was not mutated on disk)');
  });

  test('sync across multiple phases with nested plans sums correctly', () => {
    // Phase 01: 2 nested plans, 2 summaries (complete).
    // Phase 02: 3 nested plans, 1 summary (in progress).
    // Expected "Total Plans in Phase" = 3 (current/incomplete phase).
    const phases = [
      { dir: '01-alpha', plans: 2, summaries: 2 },
      { dir: '02-beta', plans: 3, summaries: 1 },
    ];
    for (const { dir, plans, summaries } of phases) {
      const phaseDir = path.join(tmpDir, '.planning', 'phases', dir);
      const plansDir = path.join(phaseDir, 'plans');
      fs.mkdirSync(plansDir, { recursive: true });
      for (let p = 1; p <= plans; p++) {
        const pad = String(p).padStart(2, '0');
        fs.writeFileSync(path.join(plansDir, `1-PLAN-${pad}-t.md`), '# Plan\n');
      }
      for (let s = 1; s <= summaries; s++) {
        const pad = String(s).padStart(2, '0');
        fs.writeFileSync(path.join(plansDir, `1-SUMMARY-${pad}-t.md`), '# Summary\n');
      }
    }

    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 02',
      '**Status:** executing',
      '**Total Plans in Phase:** 0',
      '**Progress:** [░░░░░░░░░░] 0%',
      '**Last Activity:** 2026-01-01',
      '',
    ].join('\n');
    fs.writeFileSync(path.join(tmpDir, '.planning', 'STATE.md'), stateContent, 'utf-8');

    const result = runGsdTools('state sync', tmpDir);
    assert.ok(result.success, `state sync failed: ${result.error}`);

    const parsed = JSON.parse(result.output);
    assert.ok(parsed.synced, 'sync must succeed');
    // "Total Plans in Phase" reflects the current (incomplete) phase: 02-beta has 3 plans.
    const planCountChange = parsed.changes.find(c => c.startsWith('Total Plans in Phase:'));
    assert.ok(planCountChange, `Total Plans in Phase change expected; got: ${JSON.stringify(parsed.changes)}`);
    assert.ok(planCountChange.includes('-> 3'), `current phase plan count must be 3; got: "${planCountChange}"`);
    // Progress: computeProgressPercent uses min(plan_fraction, phase_fraction).
    // plan_fraction = 3 summaries / 5 plans = 60%.
    // phase_fraction = 1 completed phase / 2 total phases = 50%.
    // min(60%, 50%) = 50% — the phase cap applies (#3242).
    const progressChange = parsed.changes.find(c => c.startsWith('Progress:'));
    assert.ok(progressChange, `Progress change expected; got: ${JSON.stringify(parsed.changes)}`);
    assert.ok(progressChange.includes('50%'), `progress must reflect nested counts (min(3/5, 1/2)=50%); got: "${progressChange}"`);
  });
});
