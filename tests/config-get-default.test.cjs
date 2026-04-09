/**
 * Tests for config-get --default flag (#1893)
 *
 * When --default <value> is passed, config-get should return the default
 * value (exit 0) instead of erroring (exit 1) when the key is absent.
 * When the key IS present, --default should be ignored and the real value
 * returned.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');

const GSD_TOOLS = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('config-get --default flag (#1893)', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-config-default-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function run(...args) {
    return execFileSync('node', [GSD_TOOLS, ...args, '--cwd', tmpDir], {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
  }

  function runRaw(...args) {
    return run(...args, '--raw');
  }

  function runExpectError(...args) {
    try {
      execFileSync('node', [GSD_TOOLS, ...args, '--cwd', tmpDir], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      assert.fail('Expected command to exit non-zero');
    } catch (err) {
      assert.ok(err.status !== 0, 'Expected non-zero exit code');
      return err;
    }
  }

  test('absent key without --default errors', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');
    runExpectError('config-get', 'nonexistent.key', '--raw');
  });

  test('absent key with --default returns default value', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');
    const result = runRaw('config-get', 'nonexistent.key', '--default', 'fallback');
    assert.equal(result, 'fallback');
  });

  test('absent key with --default "" returns empty string', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');
    const result = runRaw('config-get', 'nonexistent.key', '--default', '');
    assert.equal(result, '');
  });

  test('present key with --default returns real value (ignores default)', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({
      workflow: { discuss_mode: 'adaptive' }
    }));
    const result = runRaw('config-get', 'workflow.discuss_mode', '--default', 'ignored');
    assert.equal(result, 'adaptive');
  });

  test('nested absent key with --default returns default', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), JSON.stringify({
      workflow: {}
    }));
    const result = runRaw('config-get', 'workflow.deep.missing.key', '--default', 'safe');
    assert.equal(result, 'safe');
  });

  test('missing config.json with --default returns default', () => {
    // No config.json written
    const result = runRaw('config-get', 'any.key', '--default', 'no-config');
    assert.equal(result, 'no-config');
  });

  test('missing config.json without --default errors', () => {
    // No config.json written
    runExpectError('config-get', 'any.key', '--raw');
  });

  test('--default works with JSON output (no --raw)', () => {
    fs.writeFileSync(path.join(planningDir, 'config.json'), '{}');
    const result = run('config-get', 'missing.key', '--default', 'json-test');
    const parsed = JSON.parse(result);
    assert.equal(parsed, 'json-test');
  });
});
