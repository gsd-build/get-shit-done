/**
 * Regression test for bug #2798
 *
 * `gsd-sdk query config-set context_window <n>` was rejected with
 * "Unknown config key: context_window" because context_window was missing
 * from VALID_CONFIG_KEYS in sdk/src/query/config-schema.ts.
 *
 * The fix added 'context_window' to the allowlist.
 * This test prevents future drift where the key gets accidentally removed.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createTempProject, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const SDK_CLI = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');

function runConfigSet(key, value, projectDir) {
  const argv = ['query', 'config-set', key, String(value), '--project-dir', projectDir];
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = execFileSync(process.execPath, [SDK_CLI, ...argv], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GSD_SESSION_KEY: '' },
    });
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = err.stdout?.toString() ?? '';
  }
  let json = null;
  try { json = JSON.parse(stdout.trim()); } catch { /* ok */ }
  return { exitCode, json };
}

describe('bug-2798: context_window is a valid config key', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-test-2798-');
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'balanced' })
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('config-set context_window succeeds (not rejected as unknown key)', () => {
    const result = runConfigSet('context_window', 1000000, tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0 (key is valid)');
    assert.ok(result.json !== null, 'should emit JSON');
    assert.strictEqual(result.json?.updated, true, 'updated should be true');
    assert.strictEqual(result.json?.key, 'context_window');
  });

  test('context_window value is written to config.json', () => {
    runConfigSet('context_window', 500000, tmpDir);

    const config = JSON.parse(
      fs.readFileSync(path.join(tmpDir, '.planning', 'config.json'), 'utf-8')
    );
    assert.strictEqual(config.context_window, 500000, 'context_window should be persisted');
  });

  test('config-schema CJS and SDK allowlists both include context_window', () => {
    const cjsSchema = require(path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'config-schema.cjs'));
    const sdkSchema = require(path.join(REPO_ROOT, 'sdk', 'dist', 'query', 'config-schema.js'));

    assert.ok(
      cjsSchema.VALID_CONFIG_KEYS.has('context_window'),
      'CJS VALID_CONFIG_KEYS must include context_window'
    );
    assert.ok(
      sdkSchema.VALID_CONFIG_KEYS.has('context_window'),
      'SDK VALID_CONFIG_KEYS must include context_window'
    );
  });
});
