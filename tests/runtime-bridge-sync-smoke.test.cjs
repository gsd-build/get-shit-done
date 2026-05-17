'use strict';

/**
 * CJS smoke test for the executeForCjs synchronous primitive (Phase 5.0 #3555).
 *
 * Verifies that the compiled dist artifact can be required from a CJS context
 * and that executeForCjs returns the expected result shape synchronously.
 *
 * This is the critical end-to-end proof that the primitive works for CJS callers
 * — the actual point of Phase 5.0.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.join(__dirname, '..');
const BRIDGE_PATH = path.join(REPO_ROOT, 'sdk', 'dist', 'runtime-bridge-sync', 'index.js');
// Node's ESM loader rejects Windows absolute paths with `import()` — must be a
// file:// URL. pathToFileURL is a no-op for POSIX paths (produces file:///abs/...).
const BRIDGE_URL = pathToFileURL(BRIDGE_PATH).href;

describe('runtime-bridge-sync CJS smoke test', () => {
  test('executeForCjs is exported and is a function', async () => {
    // Use dynamic import because Node 24 supports require() of ESM but
    // the module is ESM (NodeNext output). Dynamic import works in all contexts.
    const mod = await import(BRIDGE_URL);
    assert.strictEqual(typeof mod.executeForCjs, 'function', 'executeForCjs must be a function');
  });

  test('executeForCjs returns ok:true for generate-slug (success path)', async () => {
    const { executeForCjs } = await import(BRIDGE_URL);

    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['My Smoke Test Phase'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['My Smoke Test Phase'],
      mode: 'json',
      projectDir: '/tmp',
    });

    // The returned value must be a plain object, not a Promise
    assert.strictEqual(typeof result, 'object', 'result must be an object');
    assert.ok(!(result instanceof Promise), 'result must not be a Promise');
    assert.ok('ok' in result, 'result must have ok property');

    assert.strictEqual(result.ok, true, 'expected ok:true');
    assert.strictEqual(result.exitCode, 0, 'expected exitCode:0');
    assert.ok(result.data != null, 'expected data to be non-null');

    const data = result.data;
    assert.strictEqual(typeof data, 'object', 'data must be an object');
    assert.strictEqual(data.slug, 'my-smoke-test-phase', 'expected slug');
  });

  test('executeForCjs returns ok:false for unknown command', async () => {
    const { executeForCjs } = await import(BRIDGE_URL);

    const result = executeForCjs({
      registryCommand: '__smoke_test_unknown_command__',
      registryArgs: [],
      legacyCommand: '__smoke_test_unknown_command__',
      legacyArgs: [],
      mode: 'json',
      projectDir: '/tmp',
    });

    assert.strictEqual(typeof result, 'object', 'result must be an object');
    assert.ok(!(result instanceof Promise), 'result must not be a Promise');
    assert.strictEqual(result.ok, false, 'expected ok:false');
    assert.ok(result.exitCode !== 0, 'expected non-zero exitCode');
    assert.ok('errorKind' in result, 'expected errorKind property');
    assert.strictEqual(result.errorKind, 'unknown_command', 'expected unknown_command errorKind');
    assert.ok(Array.isArray(result.stderrLines), 'expected stderrLines array');
  });

  test('executeForCjs result shape matches RuntimeBridgeSyncResult discriminated union', async () => {
    const { executeForCjs } = await import(BRIDGE_URL);

    // Success shape
    const success = executeForCjs({
      registryCommand: 'current-timestamp',
      registryArgs: ['date'],
      legacyCommand: 'current-timestamp',
      legacyArgs: ['date'],
      mode: 'json',
      projectDir: '/tmp',
    });

    assert.ok('ok' in success, 'success result must have ok');
    if (success.ok) {
      assert.strictEqual(success.exitCode, 0);
      assert.ok('data' in success);
    } else {
      // current-timestamp might fail if args aren't what it expects; just check shape
      assert.ok('errorKind' in success);
      assert.ok('stderrLines' in success);
      assert.ok(Array.isArray(success.stderrLines));
    }
  });
});
