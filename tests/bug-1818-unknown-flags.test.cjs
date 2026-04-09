/**
 * Regression test for bug #1818
 *
 * gsd-tools must reject unknown/invalid flags (--help, -h, etc.) with a
 * non-zero exit and an error message instead of silently ignoring them and
 * proceeding with the command — which can cause destructive operations to run
 * when an AI agent hallucinates a flag like --help.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('unknown flag guard (bug #1818)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── --help flag ────────────────────────────────────────────────────────────

  test('phases clear --help is rejected with non-zero exit', () => {
    const result = runGsdTools(['phases', 'clear', '--help'], tmpDir);
    assert.strictEqual(result.success, false, 'should fail, not run destructive clear');
    assert.match(result.error, /--help/);
  });

  test('generate-slug hello --help is rejected', () => {
    // Non-destructive baseline: generate-slug hello succeeds without --help
    const ok = runGsdTools(['generate-slug', 'hello'], tmpDir);
    assert.strictEqual(ok.success, true, 'control: generate-slug without --help must succeed');

    const result = runGsdTools(['generate-slug', 'hello', '--help'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /--help/);
  });

  test('phase complete --help is rejected', () => {
    const result = runGsdTools(['phase', 'complete', '--help'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /--help/);
  });

  test('state load --help is rejected', () => {
    const result = runGsdTools(['state', 'load', '--help'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /--help/);
  });

  // ── -h shorthand ──────────────────────────────────────────────────────────

  test('phases clear -h is rejected', () => {
    const result = runGsdTools(['phases', 'clear', '-h'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /-h/);
  });

  test('generate-slug hello -h is rejected', () => {
    const result = runGsdTools(['generate-slug', 'hello', '-h'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /-h/);
  });

  // ── other common hallucinated flags ───────────────────────────────────────

  test('generate-slug hello --version is rejected', () => {
    const result = runGsdTools(['generate-slug', 'hello', '--version'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /--version/);
  });

  test('current-timestamp --help is rejected', () => {
    const result = runGsdTools(['current-timestamp', '--help'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.match(result.error, /--help/);
  });
});
