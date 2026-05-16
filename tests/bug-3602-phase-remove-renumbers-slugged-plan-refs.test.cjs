/**
 * Bug #3602: After `phase remove N`, ROADMAP references to slugged plan
 * files (`07-01-cherry-pick-foundation-PLAN.md`) keep their old phase
 * prefix while the on-disk file has already been renamed. The
 * renumber-references regex in `phase.cjs` only matched compact forms
 * (`07-01-PLAN.md`, bare `07-01`) — it did not allow a slug between the
 * plan number and the `-PLAN.md` / `-SUMMARY.md` suffix.
 *
 * Fix: extend the lookahead to allow an optional `-<slug>` segment before
 * the `-(PLAN|SUMMARY).md` suffix while still preserving the "bare token,
 * not part of a longer number/identifier" alternative.
 *
 * Assertions go through the typed `roadmap get-phase --json` query so no
 * test asserts on raw ROADMAP.md text content.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

function writeRoadmap(tmpDir, body) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), body);
}
function writeState(tmpDir, version) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'STATE.md'),
    `---\nmilestone: ${version}\n---\n`,
  );
}
function ensurePhaseDir(tmpDir, name) {
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', name), { recursive: true });
}
function ensurePlanFile(tmpDir, phaseDirName, planName) {
  const p = path.join(tmpDir, '.planning', 'phases', phaseDirName, planName);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '# Plan\n');
}
function getPhase(tmpDir, phaseNum) {
  const r = runGsdTools(['roadmap', 'get-phase', phaseNum, '--json'], tmpDir);
  if (!r.success) return { found: false, error: r.error };
  return JSON.parse(r.output);
}

describe('bug #3602: phase remove renumbers slugged plan references in ROADMAP', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempProject('bug-3602-');
  });
  afterEach(() => {
    cleanup(tmpDir);
  });

  test('slugged PLAN reference (07-01-cherry-pick-foundation-PLAN.md) is renumbered to 06-01-…', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0',
        '',
        '### Phase 6: Old Work',
        '**Goal:** RemoveThisGoal',
        '',
        '### Phase 7: New Work',
        '**Goal:** Plans: 07-01-cherry-pick-foundation-PLAN.md and 07-02-finish-it-SUMMARY.md',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '06-old');
    ensurePhaseDir(tmpDir, '07-new');
    ensurePlanFile(tmpDir, '07-new', '07-01-cherry-pick-foundation-PLAN.md');
    ensurePlanFile(tmpDir, '07-new', '07-02-finish-it-SUMMARY.md');

    const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
    assert.ok(r.success, `phase remove failed: ${r.error || r.output}`);

    // Phase 7 → Phase 6 after removal. The renumbered phase's recorded
    // goal must reference the renumbered plan filenames (06-01-… and
    // 06-02-…), not the stale 07-01-… / 07-02-… form.
    const phase6 = getPhase(tmpDir, '6');
    assert.strictEqual(phase6.found, true);
    assert.strictEqual(phase6.phase_name, 'New Work');
    assert.ok(
      phase6.goal.includes('06-01-cherry-pick-foundation-PLAN.md'),
      `Plans reference for slugged PLAN was not renumbered. Goal: ${phase6.goal}`,
    );
    assert.ok(
      phase6.goal.includes('06-02-finish-it-SUMMARY.md'),
      `Plans reference for slugged SUMMARY was not renumbered. Goal: ${phase6.goal}`,
    );
    assert.ok(
      !phase6.goal.includes('07-01'),
      `stale 07-01 prefix remains in ROADMAP. Goal: ${phase6.goal}`,
    );
    assert.ok(
      !phase6.goal.includes('07-02'),
      `stale 07-02 prefix remains in ROADMAP. Goal: ${phase6.goal}`,
    );
  });

  test('compact PLAN/SUMMARY reference (07-01-PLAN.md) still renumbers (#3601 contract preserved)', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0',
        '',
        '### Phase 6: Old',
        '**Goal:** RemoveGoal',
        '',
        '### Phase 7: New',
        '**Goal:** Plans: 07-01-PLAN.md and 07-02-SUMMARY.md',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '06-old');
    ensurePhaseDir(tmpDir, '07-new');
    ensurePlanFile(tmpDir, '07-new', '07-01-PLAN.md');
    ensurePlanFile(tmpDir, '07-new', '07-02-SUMMARY.md');

    const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
    assert.ok(r.success);

    const phase6 = getPhase(tmpDir, '6');
    assert.strictEqual(phase6.found, true);
    assert.ok(phase6.goal.includes('06-01-PLAN.md'));
    assert.ok(phase6.goal.includes('06-02-SUMMARY.md'));
    assert.ok(!phase6.goal.includes('07-01-PLAN.md'));
    assert.ok(!phase6.goal.includes('07-02-SUMMARY.md'));
  });

  test('does NOT renumber values that look like phase-plan tokens but are not (e.g. 2026-01-01 dates)', () => {
    // Counter-test: an ISO date `2026-01-01` should NOT be matched by the
    // renumber regex even though it superficially looks like NN-NN-NN.
    // The negative lookbehind `(?<![0-9-])` and trailing lookahead must
    // protect against false positives in dates and other digit clusters.
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0',
        '',
        '### Phase 6: Old',
        '**Goal:** RemoveGoal',
        '',
        '### Phase 7: Date safety',
        '**Goal:** Created 2026-01-01 and tagged v1-2-3 — must not renumber',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '06-old');
    ensurePhaseDir(tmpDir, '07-new');

    const r = runGsdTools(['phase', 'remove', '6'], tmpDir);
    assert.ok(r.success);

    const phase6 = getPhase(tmpDir, '6');
    assert.strictEqual(phase6.found, true);
    assert.ok(
      phase6.goal.includes('2026-01-01'),
      `ISO date 2026-01-01 was wrongly modified. Goal: ${phase6.goal}`,
    );
    assert.ok(
      phase6.goal.includes('v1-2-3'),
      `version-tag v1-2-3 was wrongly modified. Goal: ${phase6.goal}`,
    );
  });
});
