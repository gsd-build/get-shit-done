'use strict';

/**
 * Regression test for bug #3227 — config-set rejects model_overrides.<agent-id>.
 *
 * `gsd-sdk query config-set model_overrides.gsd-plan-checker opus` was
 * rejected with "Unknown config key" because `model_overrides.<agent-id>` was
 * missing from DYNAMIC_KEY_PATTERNS in both the CJS schema and the SDK schema.
 *
 * The override mechanism itself worked correctly (resolve-model returned the
 * override after a direct file edit). Only the write path was gated wrong.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createTempProject, cleanup, runGsdTools } = require('./helpers.cjs');
const { DYNAMIC_KEY_PATTERNS, isValidConfigKey } = require('../get-shit-done/bin/lib/config-schema.cjs');

describe('#3227 — config-set accepts model_overrides.<agent-id>', () => {
  test('isValidConfigKey accepts model_overrides.gsd-plan-checker', () => {
    assert.ok(
      isValidConfigKey('model_overrides.gsd-plan-checker'),
      'model_overrides.gsd-plan-checker must be accepted by isValidConfigKey'
    );
  });

  test('isValidConfigKey accepts model_overrides with various agent-id formats', () => {
    const validKeys = [
      'model_overrides.gsd-executor',
      'model_overrides.gsd-planner',
      'model_overrides.gsd-codebase-mapper',
      'model_overrides.my_custom_agent',
      'model_overrides.agent123',
    ];
    for (const key of validKeys) {
      assert.ok(isValidConfigKey(key), `isValidConfigKey must accept ${key}`);
    }
  });

  test('isValidConfigKey rejects bare model_overrides (no agent-id)', () => {
    assert.ok(
      !isValidConfigKey('model_overrides'),
      'bare model_overrides must be rejected (use model_overrides.<agent-id>)'
    );
  });

  test('DYNAMIC_KEY_PATTERNS includes an entry for model_overrides', () => {
    const hasPattern = DYNAMIC_KEY_PATTERNS.some(
      (p) => p.description && p.description.includes('model_overrides')
    );
    assert.ok(hasPattern, 'DYNAMIC_KEY_PATTERNS must have an entry covering model_overrides.<agent-id>');
  });

  test('config-set model_overrides.gsd-plan-checker opus succeeds via gsd-tools.cjs', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    const result = runGsdTools(
      ['config-set', 'model_overrides.gsd-plan-checker', 'opus'],
      tmpDir
    );
    assert.ok(
      result.success,
      [
        'config-set model_overrides.gsd-plan-checker opus should succeed,',
        'got:',
        'stdout: ' + result.output,
        'stderr: ' + result.error,
      ].join('\n')
    );
  });

  test('config-set model_overrides.gsd-plan-checker opus writes to config.json', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    runGsdTools(['config-set', 'model_overrides.gsd-plan-checker', 'opus'], tmpDir);

    const configPath = path.join(tmpDir, '.planning', 'config.json');
    assert.ok(fs.existsSync(configPath), '.planning/config.json must exist after config-set');

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    assert.ok(
      config.model_overrides !== undefined &&
        config.model_overrides['gsd-plan-checker'] === 'opus',
      [
        'Expected model_overrides["gsd-plan-checker"]: "opus" in config.json,',
        'got: ' + JSON.stringify(config),
      ].join('\n')
    );
  });

  test('config-get model_overrides.gsd-plan-checker returns opus after config-set', (t) => {
    const tmpDir = createTempProject();
    t.after(() => cleanup(tmpDir));

    runGsdTools(['config-set', 'model_overrides.gsd-plan-checker', 'opus'], tmpDir);

    const getResult = runGsdTools(
      ['config-get', 'model_overrides.gsd-plan-checker'],
      tmpDir
    );
    assert.ok(
      getResult.success,
      [
        'config-get model_overrides.gsd-plan-checker should succeed,',
        'got:',
        'stdout: ' + getResult.output,
        'stderr: ' + getResult.error,
      ].join('\n')
    );
    assert.ok(
      getResult.output.includes('opus'),
      'config-get output should contain "opus", got: ' + getResult.output
    );
  });
});
