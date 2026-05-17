/**
 * Bug #3600: `init.new-milestone` reports `phase_dir_count: 0` for
 * project-code-prefixed phase directories (e.g. `.planning/phases/CK-01-name`)
 * against a ROADMAP that uses numeric `Phase 1:` headings.
 *
 * Root cause: `getMilestonePhaseFilter` builds an `isDirInMilestone(dirName)`
 * predicate that tries two paths:
 *   1) Numeric match — requires the directory name to START with a digit;
 *      `CK-01-name` starts with `C`, so this path skips.
 *   2) Custom-ID match — captures the leading token (`CK-01-name` as a
 *      whole) and compares it to the normalised milestone phase IDs
 *      (`1`). No match.
 *
 * The predicate has no path that strips a project-code prefix before the
 * numeric match. This fix adds that third path: when both existing
 * matches fail, strip an optional `^[A-Z]{1,6}-(?=\d)` prefix (the same
 * shape `normalizePhaseName` already strips) and retry the numeric match.
 *
 * The fix is shared between the CJS impl in `core.cjs` and the SDK twin
 * in `sdk/src/query/state.ts`. The behavioural test exercises the CJS
 * surface (the active runtime).
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
function writeConfig(tmpDir, configObj) {
  fs.writeFileSync(
    path.join(tmpDir, '.planning', 'config.json'),
    JSON.stringify(configObj, null, 2),
  );
}
function ensurePhaseDir(tmpDir, name) {
  fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', name), { recursive: true });
}

describe('bug #3600: milestone phase filter understands project-code-prefixed directories', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempProject('bug-3600-');
  });
  afterEach(() => {
    cleanup(tmpDir);
  });

  test('init.new-milestone counts CK-NN-name dirs against numeric `Phase N:` headings', () => {
    writeConfig(tmpDir, { project_code: 'CK' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 1: Discovery',
        '**Goal:** GoalOne',
        '',
        '### Phase 2: Build',
        '**Goal:** GoalTwo',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, 'CK-01-discovery');
    ensurePhaseDir(tmpDir, 'CK-02-build');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success, `init new-milestone failed: ${r.error || r.output}`);
    const payload = JSON.parse(r.output);
    assert.strictEqual(
      payload.phase_dir_count,
      2,
      `expected phase_dir_count=2 for two CK-NN-name dirs against Phase 1/Phase 2 headings, got ${payload.phase_dir_count}`,
    );
  });

  test('unprefixed directories continue to count (#3537 / existing contract)', () => {
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 1: First',
        '**Goal:** g',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, '01-first');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    const payload = JSON.parse(r.output);
    assert.strictEqual(payload.phase_dir_count, 1);
  });

  test('custom-ID match for PROJ-42 directory + Phase PROJ-42: heading still works', () => {
    // Existing custom-ID path: directory name exactly equals the custom
    // phase ID (no slug suffix). The PROJ-42 → Phase PROJ-42: match must
    // continue to fire via the second branch of `isDirInMilestone`, not
    // get pre-empted by the new strip-and-retry branch.
    writeConfig(tmpDir, { project_code: 'PROJ' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase PROJ-42: Custom',
        '**Goal:** g',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, 'PROJ-42');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    const payload = JSON.parse(r.output);
    assert.strictEqual(
      payload.phase_dir_count,
      1,
      'PROJ-42 directory must still match Phase PROJ-42: via the custom-ID path',
    );
  });

  test('directories that do not match the milestone do NOT count', () => {
    // Counter-test: a 999-backlog directory or a totally-unrelated phase
    // must NOT be counted in the milestone tally.
    writeConfig(tmpDir, { project_code: 'CK' });
    writeState(tmpDir, 'v1.0.0');
    writeRoadmap(
      tmpDir,
      [
        '# Roadmap',
        '',
        '## Current Milestone: v1.0.0 - Test',
        '',
        '### Phase 1: First',
        '**Goal:** g',
        '',
      ].join('\n'),
    );
    ensurePhaseDir(tmpDir, 'CK-01-first');
    // Future / backlog phases that should not be counted in this milestone.
    ensurePhaseDir(tmpDir, 'CK-99-backlog');
    ensurePhaseDir(tmpDir, 'CK-100-future');

    const r = runGsdTools(['init', 'new-milestone', '--json'], tmpDir);
    assert.ok(r.success);
    const payload = JSON.parse(r.output);
    assert.strictEqual(
      payload.phase_dir_count,
      1,
      'only CK-01-first should match Phase 1; CK-99 and CK-100 must be excluded',
    );
  });
});
