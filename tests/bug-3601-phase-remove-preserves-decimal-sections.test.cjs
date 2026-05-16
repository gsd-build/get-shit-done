/**
 * Bug #3601: `phase remove N` for an integer phase can also delete the
 * adjacent decimal phase section (`### Phase N.1:`) when the decimal is a
 * peer-level header at the same depth as the integer being removed.
 *
 * Root cause: the section-removal regex in
 * `get-shit-done/bin/lib/phase.cjs:updateRoadmapAfterPhaseRemoval` used a
 * depth-blind lookahead (`(?=\n#{2,4}\s+Phase\s+\d+\s*:|$)`) that required
 * the next header's digits to be followed by `\s*:`. `### Phase 2.1:`
 * (depth 3, decimal) did not satisfy `\d+\s*:` because of the `.1`, so
 * the non-greedy match consumed `Phase 2.1` along with `Phase 2` until it
 * reached the next integer header.
 *
 * The fix makes the lookahead depth-aware: it captures the hash count of
 * the header being removed and stops only at a subsequent header of the
 * SAME depth, integer or decimal. That preserves the #3355 contract
 * (`#### Phase 27.1:` at depth 4 is a CHILD of `### Phase 27:` at depth 3
 * and must be removed alongside it) while fixing the #3601 contract
 * (`### Phase 2.1:` at depth 3 is a PEER of `### Phase 2:` and must be
 * preserved).
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
function getPhase(tmpDir, phaseNum) {
  const r = runGsdTools(['roadmap', 'get-phase', phaseNum, '--json'], tmpDir);
  if (!r.success) return { found: false, error: r.error };
  return JSON.parse(r.output);
}

describe('bug #3601: phase remove preserves peer-depth decimal sections', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempProject('bug-3601-');
  });
  afterEach(() => {
    cleanup(tmpDir);
  });

  test('removing Phase 2 preserves peer-depth Phase 2.1 and renumbers Phase 3 → 2', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 2: Parent',
        '**Goal:** RemoveMeGoal',
        '',
        '### Phase 2.1: Follow-up',
        '**Goal:** PreserveDecimalGoal',
        '',
        '### Phase 3: Trailing',
        '**Goal:** PreserveTrailingGoal',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '02-parent');
    ensurePhaseDir(tmpDir, '02.1-follow-up');
    ensurePhaseDir(tmpDir, '03-trailing');

    const r = runGsdTools(['phase', 'remove', '2'], tmpDir);
    assert.ok(r.success, `phase remove failed: ${r.error || r.output}`);

    // The peer-depth decimal (Phase 2.1) must still be queryable — its
    // unique goal proves the section body survived.
    const decimal = getPhase(tmpDir, '2.1');
    assert.strictEqual(decimal.found, true, 'Phase 2.1 deleted alongside Phase 2');
    assert.strictEqual(decimal.phase_name, 'Follow-up');
    assert.strictEqual(decimal.goal, 'PreserveDecimalGoal');

    // Phase 3 must have been renumbered to Phase 2.
    const renumbered = getPhase(tmpDir, '2');
    assert.strictEqual(renumbered.found, true);
    assert.strictEqual(renumbered.phase_name, 'Trailing');
    assert.strictEqual(
      renumbered.goal,
      'PreserveTrailingGoal',
      'Phase 3 → Phase 2 renumber did not carry the right section content',
    );

    // The removed Parent goal must not be retrievable from any current phase.
    const parentLookup = getPhase(tmpDir, '3');
    assert.notStrictEqual(
      parentLookup.goal,
      'RemoveMeGoal',
      'removed parent goal reappeared under a phase header',
    );
  });

  test('removing Phase 5 preserves Phase 5.1 and Phase 5.2 (multiple peer decimals)', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 5: Parent',
        '**Goal:** RemoveParent',
        '',
        '### Phase 5.1: First child',
        '**Goal:** ChildAGoal',
        '',
        '### Phase 5.2: Second child',
        '**Goal:** ChildBGoal',
        '',
        '### Phase 6: Tail',
        '**Goal:** TailGoal',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '05-parent');
    ensurePhaseDir(tmpDir, '05.1-first-child');
    ensurePhaseDir(tmpDir, '05.2-second-child');
    ensurePhaseDir(tmpDir, '06-tail');

    const r = runGsdTools(['phase', 'remove', '5'], tmpDir);
    assert.ok(r.success);

    const decimalA = getPhase(tmpDir, '5.1');
    assert.strictEqual(decimalA.found, true, 'Phase 5.1 deleted');
    assert.strictEqual(decimalA.goal, 'ChildAGoal');

    const decimalB = getPhase(tmpDir, '5.2');
    assert.strictEqual(decimalB.found, true, 'Phase 5.2 deleted');
    assert.strictEqual(decimalB.goal, 'ChildBGoal');

    const tail = getPhase(tmpDir, '5');
    assert.strictEqual(tail.found, true);
    assert.strictEqual(tail.goal, 'TailGoal', 'Phase 6 → Phase 5 renumber misfired');
  });
});
