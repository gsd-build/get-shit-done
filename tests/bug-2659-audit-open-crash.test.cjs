'use strict';

/**
 * Regression test for #2659.
 *
 * The `audit-open` dispatch case in bin/gsd-tools.cjs previously called bare
 * `output(...)` on both the --json and text branches. `output` is never in
 * local scope — the entire core module is imported as `const core`, so every
 * other case uses `core.output(...)`. The bare calls therefore crashed with
 * `ReferenceError: output is not defined` the moment `audit-open` ran.
 *
 * This test runs both invocations against a minimal temp project and asserts
 * they exit successfully with non-empty stdout. It fails with the
 * ReferenceError on any revision that still has the bare `output(...)` calls.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('audit-open — does not crash with ReferenceError (#2659)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-bug-2659-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('audit-open (text output) succeeds and produces stdout', () => {
    const result = runGsdTools('audit-open', tmpDir);
    assert.ok(
      result.success,
      `audit-open must not crash. stderr: ${result.error}`
    );
    assert.ok(
      !/ReferenceError.*output is not defined/.test(result.error || ''),
      `audit-open must not throw ReferenceError. stderr: ${result.error}`
    );
    assert.ok(
      result.output && result.output.length > 0,
      'audit-open must write a non-empty report to stdout'
    );
  });

  test('audit-open --json succeeds and produces stdout', () => {
    const result = runGsdTools(['audit-open', '--json'], tmpDir);
    assert.ok(
      result.success,
      `audit-open --json must not crash. stderr: ${result.error}`
    );
    assert.ok(
      !/ReferenceError.*output is not defined/.test(result.error || ''),
      `audit-open --json must not throw ReferenceError. stderr: ${result.error}`
    );
    assert.ok(
      result.output && result.output.length > 0,
      'audit-open --json must write output to stdout'
    );
    let parsed;
    assert.doesNotThrow(
      () => { parsed = JSON.parse(result.output); },
      'audit-open --json must emit valid JSON'
    );
    assert.ok(
      parsed !== null && typeof parsed === 'object',
      'audit-open --json must emit a JSON object or array'
    );
  });
});
