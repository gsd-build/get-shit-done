/**
 * Regression test for bug #2803
 *
 * `gsd-sdk query config-get <key> --default <value>` silently ignored the
 * --default flag. When the key was missing, the SDK threw "Error: Key not found"
 * and exited 1, identical to calling it without --default.
 *
 * The CJS path (gsd-tools.cjs config-get <key> --default <value>) honored
 * --default correctly since #1893. The SDK handler was never ported.
 *
 * Fix: configGet in sdk/src/query/config-query.ts now strips --default <value>
 * from args before key lookup and returns { data: defaultValue } instead of
 * throwing when the key is absent (config missing, key missing, or nested
 * object missing).
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

/**
 * Invoke `gsd-sdk query config-get <...args>` against a project dir.
 * Returns { exitCode, stdout, stderr }.
 */
function runConfigGet(args, projectDir) {
  const argv = ['query', 'config-get', ...args, '--project-dir', projectDir];
  let stdout = '';
  let stderr = '';
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
    stderr = err.stderr?.toString() ?? '';
  }
  let json = null;
  try { json = JSON.parse(stdout.trim()); } catch { /* ok */ }
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim(), json };
}

describe('bug-2803: config-get --default flag honored in SDK', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-test-2803-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('--default returns fallback value when key absent, exit 0', () => {
    // Write a config without the key
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'balanced' })
    );

    const result = runConfigGet(
      ['workflow.test_command', '--default', 'FALLBACK'],
      tmpDir
    );

    assert.strictEqual(result.exitCode, 0, 'should exit 0 when --default provided');
    assert.ok(result.json !== null, 'should emit JSON');
    assert.strictEqual(result.json, 'FALLBACK', 'data should be the default value');
  });

  test('--default not consumed as key path', () => {
    // The key path should still be the first positional, not --default
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'quality' })
    );

    const result = runConfigGet(['mode', '--default', 'balanced'], tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0 for found key');
    assert.strictEqual(result.json, 'quality', 'should return actual value when key exists');
  });

  test('--default with empty string value works', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({})
    );

    const result = runConfigGet(['missing.key', '--default', ''], tmpDir);

    assert.strictEqual(result.exitCode, 0, 'should exit 0 with empty default');
    assert.strictEqual(result.json, '', 'data should be empty string');
  });

  test('without --default: missing key still exits 1', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ mode: 'balanced' })
    );

    const result = runConfigGet(['workflow.missing_key'], tmpDir);

    assert.strictEqual(result.exitCode, 1, 'should exit 1 when key absent and no --default');
  });

  test('--default with nested missing path', () => {
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      JSON.stringify({ workflow: {} })
    );

    const result = runConfigGet(
      ['workflow.test_command', '--default', 'npm test'],
      tmpDir
    );

    assert.strictEqual(result.exitCode, 0, 'should exit 0 with default for nested missing key');
    assert.strictEqual(result.json, 'npm test', 'data should be the default value');
  });
});
