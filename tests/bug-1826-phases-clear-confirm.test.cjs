/**
 * Regression tests for bug #1826
 *
 * `phases clear` must require an explicit --confirm flag before deleting any
 * phase directories. Without it, any accidental or hallucinated invocation
 * wipes the entire .planning/phases/ tree with no warning.
 *
 * Rules:
 *   - Phase dirs present + no --confirm → non-zero exit, clear error message
 *   - Phase dirs present + --confirm    → deletes, exits 0, reports count
 *   - No phase dirs + no --confirm      → exits 0, cleared=0 (nothing to guard)
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('bug #1826: phases clear --confirm guard', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('phases clear without --confirm is rejected when phase dirs exist', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '02-api'), { recursive: true });

    const result = runGsdTools(['phases', 'clear'], tmpDir);

    assert.ok(!result.success, 'should exit non-zero when dirs exist and --confirm absent');
    assert.ok(
      result.error.includes('--confirm'),
      `error message must mention --confirm; got: ${result.error}`
    );

    // Dirs must be untouched
    assert.ok(fs.existsSync(path.join(phasesDir, '01-foundation')), 'dirs must not be deleted');
    assert.ok(fs.existsSync(path.join(phasesDir, '02-api')), 'dirs must not be deleted');
  });

  test('phases clear --confirm deletes dirs and reports count', () => {
    const phasesDir = path.join(tmpDir, '.planning', 'phases');
    fs.mkdirSync(path.join(phasesDir, '01-foundation'), { recursive: true });
    fs.mkdirSync(path.join(phasesDir, '02-api'), { recursive: true });

    const result = runGsdTools(['phases', 'clear', '--confirm'], tmpDir);

    assert.ok(result.success, `should succeed with --confirm: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.cleared, 2);
    assert.ok(!fs.existsSync(path.join(phasesDir, '01-foundation')), 'dirs should be removed');
  });

  test('phases clear without --confirm succeeds when no phase dirs exist', () => {
    // .planning/phases/ exists but is empty — nothing to guard
    const result = runGsdTools(['phases', 'clear'], tmpDir);

    assert.ok(result.success, `should succeed with empty phases dir: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.cleared, 0);
  });
});
