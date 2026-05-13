'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');
const {
  VALID_CONFIG_KEYS,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

describe('review.default_reviewers config key (#3079)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    runGsdTools('config-ensure-section', tmpDir, { HOME: tmpDir, USERPROFILE: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('schema key is registered', () => {
    assert.ok(
      VALID_CONFIG_KEYS.has('review.default_reviewers'),
      'review.default_reviewers must be in VALID_CONFIG_KEYS'
    );
  });

  test('round-trip set/get supports string array and normalizes to lowercase unique slugs', () => {
    const setResult = runGsdTools(
      ['config-set', 'review.default_reviewers', '["Gemini","CODEX","codex"]'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const getResult = runGsdTools(
      ['config-get', 'review.default_reviewers'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(getResult.success, `config-get failed: ${getResult.error}`);
    assert.deepStrictEqual(JSON.parse(getResult.output), ['gemini', 'codex']);
  });

  test('empty array is rejected with schema error', () => {
    const result = runGsdTools(
      ['config-set', 'review.default_reviewers', '[]'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(!result.success, 'config-set should reject empty arrays');
    assert.ok(
      result.error.includes('cannot be empty'),
      `expected empty-array error, got: ${result.error}`
    );
  });

  test('non-array value is rejected', () => {
    const result = runGsdTools(
      ['config-set', 'review.default_reviewers', 'gemini'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(!result.success, 'config-set should reject non-array values');
    assert.ok(
      result.error.includes('must be a JSON array'),
      `expected type error, got: ${result.error}`
    );
  });

  test('invalid slug is rejected', () => {
    const result = runGsdTools(
      ['config-set', 'review.default_reviewers', '["gemini","bad/slug"]'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(!result.success, 'config-set should reject invalid slugs');
    assert.ok(
      result.error.includes('invalid reviewer slug'),
      `expected slug error, got: ${result.error}`
    );
  });

  test('value is persisted in nested review object', () => {
    const setResult = runGsdTools(
      ['config-set', 'review.default_reviewers', '["gemini","codex"]'],
      tmpDir,
      { HOME: tmpDir, USERPROFILE: tmpDir }
    );
    assert.ok(setResult.success, `config-set failed: ${setResult.error}`);

    const cfg = JSON.parse(fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    assert.deepStrictEqual(cfg.review?.default_reviewers, ['gemini', 'codex']);
  });
});

