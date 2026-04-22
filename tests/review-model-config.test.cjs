/**
 * Review Model Config Tests (#1849)
 *
 * Verifies the review.models.<cli> dynamic config key pattern:
 *   - isValidConfigKey accepts review.models.<cli-name>
 *   - validateKnownConfigKeyPath suggests review.models.<cli-name> for review.model
 *   - End-to-end round-trip via config-set / config-get for both model IDs and null
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('review.models.<cli> config key', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    // Ensure config exists for set/get
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('isValidConfigKey accepts review.models.gemini', () => {
    // Exercised via config-set, which calls isValidConfigKey internally and
    // errors out if the key is not valid.
    const result = runGsdTools(
      ['config-set', 'review.models.gemini', 'gemini-3.1-pro-preview'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(result.success, `config-set should succeed for review.models.gemini: ${result.error}`);
  });

  test('isValidConfigKey accepts review.models.codex', () => {
    const result = runGsdTools(
      ['config-set', 'review.models.codex', 'gpt-5-codex'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(result.success, `config-set should succeed for review.models.codex: ${result.error}`);
  });

  test('review.model is rejected and suggests review.models.<cli-name>', () => {
    // The suggestion path goes through validateKnownConfigKeyPath, which is
    // called before isValidConfigKey in cmdConfigSet.
    const result = runGsdTools(
      ['config-set', 'review.model', 'gemini-3.1-pro-preview'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(!result.success, 'config-set should fail for review.model');
    assert.ok(
      result.error.includes('review.models.<cli-name>'),
      `error should suggest review.models.<cli-name>, got: ${result.error}`
    );
  });

  test('round-trip: config-set then config-get for a model ID', () => {
    const setResult = runGsdTools(
      ['config-set', 'review.models.gemini', 'gemini-3.1-pro-preview'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const getResult = runGsdTools(
      ['config-get', 'review.models.gemini', '--raw'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.strictEqual(
      getResult.output,
      'gemini-3.1-pro-preview',
      'config-get should return the value set via config-set'
    );
  });

  test('round-trip: config-set null then config-get returns "null"', () => {
    // The issue spec documents null as the "fall back to CLI default" sentinel.
    // cmdConfigSet does not parse 'null' as JSON null — it stores the literal
    // string 'null'. config-get --raw returns the string 'null', and the
    // workflow's `[ "$VAR" != "null" ]` guard handles this.
    const setResult = runGsdTools(
      ['config-set', 'review.models.gemini', 'null'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(setResult.success, `config-set null failed: ${setResult.error}`);

    const getResult = runGsdTools(
      ['config-get', 'review.models.gemini', '--raw'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.strictEqual(
      getResult.output,
      'null',
      'config-get should return the literal string "null" so the workflow guard can match it'
    );
  });
});
