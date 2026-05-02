/**
 * Regression test for bug #2943
 *
 * `gsd-tools.cjs config-get context_window` (and the SDK equivalent) threw
 * "Key not found: context_window" when the key was absent from config.json,
 * even though context_window has a documented schema default of 200000.
 *
 * Fix: `cmdConfigGet` in bin/lib/config.cjs now consults a SCHEMA_DEFAULTS map
 * before emitting "Key not found", so schema-defaulted keys always return the
 * default value (exit 0) when not explicitly set in the project config.
 */

'use strict';

// Migrated to typed-IR (#2974): the previous shape grepped stderr/stdout for
// "Key not found"; now the test passes `--json-errors` to gsd-tools and
// asserts on the structured `reason` code (a frozen-enum value from
// `core.cjs::ERROR_REASON`). Exit code is also a typed signal — together
// they fully discriminate the failure class.

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const GSD_TOOLS = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');
const { ERROR_REASON } = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'core.cjs'));

describe('bug-2943: config-get returns schema default for context_window', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-2943-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * Run config-get with optional extra args. Returns { exitCode, stdout, stderr }.
   * Uses --raw so we get the plain scalar value, not JSON-wrapped.
   */
  function runConfigGet(keyPath, extraArgs = []) {
    const args = [GSD_TOOLS, 'config-get', keyPath, '--raw', '--cwd', tmpDir, ...extraArgs];
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    try {
      stdout = execFileSync(process.execPath, args, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
    } catch (err) {
      exitCode = err.status ?? 1;
      stdout = err.stdout?.toString() ?? '';
      stderr = err.stderr?.toString() ?? '';
    }
    return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
  }

  test('returns "200000" (exit 0) when context_window absent from config.json', () => {
    // Fixture A: config with unrelated keys, no context_window
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ workflow: { auto_advance: false } })
    );

    const result = runConfigGet('context_window');

    assert.strictEqual(result.exitCode, 0, 'should exit 0 (schema default applied)');
    assert.strictEqual(result.stdout, '200000', 'should return schema default of 200000');
  });

  test('returns configured value when context_window is explicitly set', () => {
    // Fixture B: config has context_window: 1000000
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ context_window: 1000000 })
    );

    const result = runConfigGet('context_window');

    assert.strictEqual(result.exitCode, 0, 'should exit 0 for found key');
    assert.strictEqual(result.stdout, '1000000', 'should return configured value not schema default');
  });

  test('--default flag overrides schema default', () => {
    // config has context_window but we pass --default with a different value —
    // when key IS present, real value wins over any default
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ workflow: { auto_advance: false } })
    );

    const result = runConfigGet('context_window', ['--default', '123456']);

    assert.strictEqual(result.exitCode, 0, 'should exit 0 when --default provided');
    assert.strictEqual(result.stdout, '123456', 'should return the --default value, not schema default');
  });

  test('errors with reason=CONFIG_KEY_NOT_FOUND (exit 1) for an unknown absent key — no regression', () => {
    // An unrecognised key with no schema default still errors as before.
    // Migrated #2974: assert on the structured reason code from --json-errors,
    // not on substring presence in stderr/stdout text.
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ workflow: { auto_advance: false } })
    );

    const result = runConfigGet('totally_unknown_key_xyz', ['--json-errors']);

    assert.strictEqual(result.exitCode, 1, 'should exit 1 for unknown absent key');
    let parsed;
    try {
      parsed = JSON.parse(result.stderr);
    } catch (err) {
      assert.fail(`expected JSON-shaped stderr from --json-errors; got: ${JSON.stringify(result.stderr)}`);
    }
    assert.strictEqual(parsed.ok, false);
    assert.strictEqual(parsed.reason, ERROR_REASON.CONFIG_KEY_NOT_FOUND,
      `expected reason=${ERROR_REASON.CONFIG_KEY_NOT_FOUND}, got=${parsed.reason}`);
  });

  test('--default flag still works for arbitrary absent keys', () => {
    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({})
    );

    const result = runConfigGet('some.missing.key', ['--default', '200000']);

    assert.strictEqual(result.exitCode, 0, 'should exit 0 when --default supplied');
    assert.strictEqual(result.stdout, '200000', 'should return the explicit --default value');
  });
});
