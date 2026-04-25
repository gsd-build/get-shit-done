'use strict';

/**
 * Regression tests for bug #2601
 *
 * `config-set-model-profile inherit` (and `config-set model_profile inherit`)
 * was rejected by the validator even though the runtime accepts 'inherit' as a
 * valid model_profile value meaning "inherit from parent configuration".
 *
 * Root cause: VALID_PROFILES in model-profiles.cjs is derived from
 * Object.keys(MODEL_PROFILES['gsd-planner']), which does not include 'inherit'.
 * cmdConfigSetModelProfile() rejects any value not in VALID_PROFILES.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('bug #2601: config-set-model-profile accepts inherit', () => {
  test('config-set-model-profile inherit succeeds', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));
    const result = runGsdTools(['config-set-model-profile', 'inherit'], tmpDir);
    assert.ok(result.success, `should accept inherit: ${result.error}`);
  });

  test('config-set model_profile inherit succeeds', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));
    const result = runGsdTools(['config-set', 'model_profile', 'inherit'], tmpDir);
    assert.ok(result.success, `config-set model_profile inherit should succeed: ${result.error}`);
  });

  test('config-set-model-profile inherit writes inherit to config', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));
    runGsdTools(['config-set-model-profile', 'inherit'], tmpDir);
    const getResult = runGsdTools(['config-get', 'model_profile'], tmpDir);
    assert.ok(getResult.success, `config-get should succeed: ${getResult.error}`);
    assert.strictEqual(JSON.parse(getResult.output), 'inherit');
  });

  test('config-set-model-profile still rejects truly invalid profiles', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));
    const result = runGsdTools(['config-set-model-profile', 'not-a-real-profile'], tmpDir);
    assert.ok(!result.success, 'should reject invalid profiles');
  });
});
