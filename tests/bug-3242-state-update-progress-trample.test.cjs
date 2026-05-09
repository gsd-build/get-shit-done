'use strict';
// Regression tests for issue #3242 — two distinct bugs in state.cjs:
//
// Bug A: cmdStateUpdate("Last Activity", date) triggers a full disk-derived
// progress.* block rebuild via readModifyWriteStateMd → syncStateFrontmatter →
// buildStateFrontmatter, which tramples manually-curated cross-milestone counters
// in STATE.md frontmatter. A body-only field update must not modify progress.*.
//
// Bug B: buildStateFrontmatter (and the duplicate in cmdStateSync) derives
// progress.percent = completedPlans / totalPlans. When ROADMAP declares more
// phases than have dirs on disk, all plans being summarised gives percent: 100
// even though half the phases are unrealised. The formula must be
// min(plan_fraction, phase_fraction) to reflect true completion.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a minimal STATE.md body with frontmatter that has curated progress.*.
 * The progress values are cross-milestone aggregates that must NOT be overwritten
 * by a body-only field update.
 */
function buildStateWithCuratedProgress(opts) {
  const {
    completedPlans = 22,
    totalPlans = 22,
    completedPhases = 6,
    totalPhases = 12,
    percent = 50,
    lastActivity = '2026-01-01',
  } = opts || {};

  return [
    '---',
    'gsd_state_version: 1.0',
    'status: executing',
    'progress:',
    `  total_phases: ${totalPhases}`,
    `  completed_phases: ${completedPhases}`,
    `  total_plans: ${totalPlans}`,
    `  completed_plans: ${completedPlans}`,
    `  percent: ${percent}`,
    '---',
    '',
    '# GSD State',
    '',
    '## Configuration',
    'Current Phase: 6',
    'Current Phase Name: test-phase',
    'Total Plans in Phase: 4',
    'Current Plan: 1',
    'Status: Executing Phase 6',
    `Last Activity: ${lastActivity}`,
    '',
  ].join('\n');
}

/**
 * Write a ROADMAP.md with `numPhases` phase headings (matching `## Phase N:` pattern).
 * Only `numRealizedDirs` phase dirs will have plan/summary files on disk.
 */
function buildRoadmap(numPhases) {
  const lines = ['# ROADMAP', '', '## Milestone v1.0', ''];
  for (let i = 1; i <= numPhases; i++) {
    lines.push(`### Phase ${i}: phase-${i}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Create phase dirs with full plan+summary coverage for the first `count` phases.
 * Each dir gets 1 PLAN + 1 SUMMARY so the disk-scan treats them as complete.
 */
function createPhaseDirs(phasesDir, count) {
  for (let i = 1; i <= count; i++) {
    const dir = path.join(phasesDir, String(i).padStart(2, '0'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `01-PLAN.md`), `# Plan\n`);
    fs.writeFileSync(path.join(dir, `01-SUMMARY.md`), `# Summary\n`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bug A: state.update must not trample curated progress.* frontmatter
// ─────────────────────────────────────────────────────────────────────────────

describe('#3242 Bug A: body-only state.update preserves curated progress frontmatter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('state.update "Last Activity" does not overwrite progress.completed_plans', (t) => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildStateWithCuratedProgress({
      completedPlans: 22,
      totalPlans: 22,
      completedPhases: 6,
      totalPhases: 12,
      percent: 50,
      lastActivity: '2026-01-01',
    }));

    // Write 6 phase dirs with full coverage — disk would report 6/6 phases done,
    // 6/6 plans done (percent=100 from plans-only formula), but frontmatter says 50%.
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    createPhaseDirs(phasesDir, 6);

    const updateResult = runGsdTools(
      ['state', 'update', 'Last Activity', '2026-05-07'],
      tmpDir,
    );
    assert.ok(updateResult.success, `state update failed: ${updateResult.error}`);

    // Read back and assert via state json (JSON return value, not raw file grep)
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const fm = JSON.parse(jsonResult.output);
    assert.ok(fm.progress, 'frontmatter must have a progress block');

    // completed_plans must NOT have been trampled to 6 (disk reality) from the
    // curated 22 that was stored in the frontmatter before the update.
    assert.strictEqual(
      fm.progress.completed_plans,
      22,
      `state.update "Last Activity" must not overwrite curated progress.completed_plans ` +
      `(was 22, got ${fm.progress.completed_plans})`,
    );

    // total_phases must NOT have been trampled to 6 (disk dirs) from curated 12.
    assert.strictEqual(
      fm.progress.total_phases,
      12,
      `state.update "Last Activity" must not overwrite curated progress.total_phases ` +
      `(was 12, got ${fm.progress.total_phases})`,
    );

    // percent must NOT have been trampled to 100 (plan-only formula on 6 realized dirs).
    assert.strictEqual(
      fm.progress.percent,
      50,
      `state.update "Last Activity" must not overwrite curated progress.percent ` +
      `(was 50, got ${fm.progress.percent})`,
    );
  });

  test('state.update "Last Activity" updates the body field itself', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildStateWithCuratedProgress({ lastActivity: '2026-01-01' }));

    const updateResult = runGsdTools(
      ['state', 'update', 'Last Activity', '2026-05-07'],
      tmpDir,
    );
    assert.ok(updateResult.success, `state update failed: ${updateResult.error}`);

    // Assert via structured JSON output — not raw file text scanning.
    // state json extracts Last Activity from the body and surfaces it as
    // fm.last_activity, matching the no-source-grep testing standard.
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);
    const fm = JSON.parse(jsonResult.output);
    assert.strictEqual(
      fm.last_activity,
      '2026-05-07',
      'state.update should have written the new date to the Last Activity body field',
    );
  });

  test('state.update "Progress" resyncs progress frontmatter from the updated body', () => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');
    fs.writeFileSync(statePath, buildStateWithCuratedProgress({
      completedPlans: 22,
      totalPlans: 22,
      completedPhases: 6,
      totalPhases: 12,
      percent: 50,
    }).replace('Last Activity: 2026-01-01\n', 'Last Activity: 2026-01-01\nProgress: [█████░░░░░] 50%\n'));

    const updateResult = runGsdTools(
      ['state', 'update', 'Progress', '[████████░░] 80%'],
      tmpDir,
    );
    assert.ok(updateResult.success, `state update failed: ${updateResult.error}`);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);
    const fm = JSON.parse(jsonResult.output);
    assert.strictEqual(fm.progress.percent, 80);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Bug B: progress.percent must use min(plan_fraction, phase_fraction)
// ─────────────────────────────────────────────────────────────────────────────

describe('#3242 Bug B: progress.percent reflects phase fraction when ROADMAP declares future phases', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('12 declared phases / 6 realized / 6/6 plans done → percent is 50, not 100', (t) => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    // Body: 6 realized phases visible to disk scan.
    // Frontmatter: intentionally absent so buildStateFrontmatter runs fresh.
    fs.writeFileSync(statePath, [
      '# GSD State',
      '',
      '## Configuration',
      'Current Phase: 6',
      'Current Phase Name: test-phase-6',
      'Total Plans in Phase: 1',
      'Current Plan: 1',
      'Status: Executing Phase 6',
      'Last Activity: 2026-01-01',
      '',
    ].join('\n'));

    // ROADMAP with 12 phase headings — only 6 will have dirs on disk
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      buildRoadmap(12),
    );

    // 6 fully-realized phases (all plans have summaries)
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    createPhaseDirs(phasesDir, 6);

    // state json rebuilds frontmatter from disk+body — this exercises buildStateFrontmatter
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const fm = JSON.parse(jsonResult.output);
    assert.ok(fm.progress, 'frontmatter must have a progress block');

    // ROADMAP declares 12 phases; only 6 exist on disk → totalPhases = 12
    assert.strictEqual(
      fm.progress.total_phases,
      12,
      `total_phases must reflect ROADMAP-declared count (12), got ${fm.progress.total_phases}`,
    );

    // 6 of 12 phases realized → phase_fraction = 50%
    // 6/6 plans done → plan_fraction = 100%
    // percent = min(100, 50) = 50
    assert.strictEqual(
      fm.progress.percent,
      50,
      `percent must be 50 (phase fraction), not 100 (plan fraction) — ` +
      `6 of 12 ROADMAP phases realized. Got ${fm.progress.percent}`,
    );
  });

  test('all phases realized: percent equals plan fraction (no artificial cap)', (t) => {
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    fs.writeFileSync(statePath, [
      '# GSD State',
      '',
      '## Configuration',
      'Current Phase: 3',
      'Current Phase Name: final-phase',
      'Total Plans in Phase: 1',
      'Current Plan: 1',
      'Status: Executing Phase 3',
      'Last Activity: 2026-01-01',
      '',
    ].join('\n'));

    // ROADMAP declares 3 phases; all 3 have dirs and full plan+summary coverage
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      buildRoadmap(3),
    );

    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    createPhaseDirs(phasesDir, 3);

    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const fm = JSON.parse(jsonResult.output);
    assert.ok(fm.progress, 'frontmatter must have progress block');

    // 3/3 phases done → phase_fraction = 100%
    // 3/3 plans done → plan_fraction = 100%
    // percent = min(100, 100) = 100
    assert.strictEqual(
      fm.progress.percent,
      100,
      `percent must be 100 when all phases are realized and all plans summarized`,
    );
  });

  test('state sync also reflects phase-fraction-capped percent in body Progress field', () => {
    // state sync updates the body's Progress: field — it must use the same capped formula
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    fs.writeFileSync(statePath, [
      '# GSD State',
      '',
      '## Configuration',
      'Current Phase: 6',
      'Current Phase Name: phase-6',
      'Total Plans in Phase: 1',
      'Current Plan: 1',
      'Status: Executing Phase 6',
      'Last Activity: 2026-01-01',
      'Progress: [░░░░░░░░░░] 0%',
      '',
    ].join('\n'));

    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      buildRoadmap(12),
    );

    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    createPhaseDirs(phasesDir, 6);

    const syncResult = runGsdTools('state sync', tmpDir);
    assert.ok(syncResult.success, `state sync failed: ${syncResult.error}`);

    // Read the body's Progress field via state json (JSON output is authoritative)
    const jsonResult = runGsdTools('state json', tmpDir);
    assert.ok(jsonResult.success, `state json failed: ${jsonResult.error}`);

    const fm = JSON.parse(jsonResult.output);
    assert.ok(fm.progress, 'frontmatter must have progress block');

    // state sync wrote a Progress: body field; state json re-derives percent from disk.
    // Both must agree: 50%, not 100%.
    assert.strictEqual(
      fm.progress.percent,
      50,
      `state sync must cap percent at phase fraction (50%), got ${fm.progress.percent}`,
    );
  });
});
