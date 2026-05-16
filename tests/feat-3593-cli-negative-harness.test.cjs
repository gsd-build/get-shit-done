/**
 * Meta-test for the CLI negative-matrix harness (#3593).
 *
 * The harness in `tests/helpers/cli-negative.cjs` shapes spawnSync
 * results into a typed IR that adversarial-input tests consume. This
 * file pins the IR contract by exercising the harness against
 * deliberate scenarios — not as a placeholder for the real matrix tests
 * (those live in sibling feat-3593-* files) but to surface harness
 * regressions before they cascade through every matrix test.
 *
 * Tests deliberately avoid prose-matching: they assert on numeric exit
 * codes, boolean flags, and reason codes pulled from the parsed JSON
 * payload.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runCli, parseSpawnResult } = require('./helpers/cli-negative.cjs');
const { createTempProject, cleanup } = require('./helpers.cjs');

test('runCli rejects non-array argv with TypeError', () => {
  assert.throws(
    () => runCli('config-get', { cwd: '/tmp' }),
    (err) => err instanceof TypeError && /argv/.test(err.message),
  );
});

test('runCli rejects missing cwd with TypeError', () => {
  assert.throws(
    () => runCli(['config-get'], {}),
    (err) => err instanceof TypeError && /cwd/.test(err.message),
  );
});

test('runCli surfaces typed reason from a known failure path', (t) => {
  const projectDir = createTempProject('cli-neg-harness-');
  t.after(() => cleanup(projectDir));
  // Unknown command — gsd-tools emits ERROR_REASON.SDK_UNKNOWN_COMMAND or
  // USAGE depending on dispatch depth. Either is a real reason string;
  // the contract we pin here is just "the IR carries a reason from the
  // ERROR_REASON enum, never null".
  const result = runCli(['this-command-does-not-exist'], { cwd: projectDir });
  assert.notEqual(result.status, 0, 'unknown command must exit non-zero');
  assert.equal(result.ok, false, 'JSON payload must report ok=false');
  assert.equal(typeof result.reason, 'string', 'reason must be a string from ERROR_REASON');
  assert.notEqual(result.reason, null);
  assert.notEqual(result.reason, '');
  assert.equal(result.hasStackTrace, false, 'a typed failure must NOT print a V8 stack trace');
});

test('parseSpawnResult detects stack-trace leakage in stderr', () => {
  const fakeSpawn = {
    status: 1,
    signal: null,
    stdout: '',
    stderr: 'Error: boom\n    at Object.<anonymous> (/some/file.js:10:5)\n    at Module._compile\n',
    error: null,
  };
  const ir = parseSpawnResult(fakeSpawn, { jsonErrorsRequested: false });
  assert.equal(ir.hasStackTrace, true, 'stack frames in stderr must be flagged');
  assert.equal(ir.reason, null, 'non-JSON stderr leaves reason null');
});

test('parseSpawnResult does NOT match the literal word "at" in prose', () => {
  // Guard against a regex regression that would catch sentences like
  // "command failed at startup" as stack frames.
  const fakeSpawn = {
    status: 1,
    signal: null,
    stdout: '',
    stderr: 'Error: command failed at startup\nbecause no project was found.\n',
    error: null,
  };
  const ir = parseSpawnResult(fakeSpawn, { jsonErrorsRequested: false });
  assert.equal(ir.hasStackTrace, false, 'prose containing the word "at" is not a stack frame');
});

test('parseSpawnResult extracts ok/reason/message from a json-errors payload', () => {
  const payload = { ok: false, reason: 'config_invalid_key', message: 'no such key: foo' };
  const fakeSpawn = {
    status: 1,
    signal: null,
    stdout: '',
    stderr: JSON.stringify(payload) + '\n',
    error: null,
  };
  const ir = parseSpawnResult(fakeSpawn, { jsonErrorsRequested: true });
  assert.equal(ir.ok, false);
  assert.equal(ir.reason, 'config_invalid_key');
  assert.equal(ir.message, 'no such key: foo');
  assert.equal(ir.hasStackTrace, false);
});

test('parseSpawnResult ignores malformed JSON in stderr without throwing', () => {
  const fakeSpawn = {
    status: 1,
    signal: null,
    stdout: '',
    stderr: '{ ok: false, reason }', // missing quotes — invalid JSON
    error: null,
  };
  const ir = parseSpawnResult(fakeSpawn, { jsonErrorsRequested: true });
  assert.equal(ir.ok, null, 'malformed JSON must NOT promote partial data into ok');
  assert.equal(ir.reason, null);
  assert.equal(ir.message, null);
});

test('parseSpawnResult ignores JSON arrays and primitives, only accepts objects', () => {
  const cases = [
    '["ok", false]',     // array
    '"just a string"',   // primitive
    'null',              // null literal
    '42',                // number
  ];
  for (const stderr of cases) {
    const ir = parseSpawnResult(
      { status: 1, signal: null, stdout: '', stderr, error: null },
      { jsonErrorsRequested: true },
    );
    assert.equal(ir.ok, null, `non-object JSON (${stderr}) must not set ok`);
    assert.equal(ir.reason, null);
  }
});

test('runCli treats jsonErrors=false as an explicit human-formatter path', (t) => {
  const projectDir = createTempProject('cli-neg-harness-text-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['this-command-does-not-exist'], { cwd: projectDir, jsonErrors: false });
  assert.notEqual(result.status, 0);
  assert.equal(result.jsonErrorsRequested, false);
  // Reason fields stay null in human-mode because stderr is prose, not JSON.
  assert.equal(result.ok, null);
  assert.equal(result.reason, null);
  // But the prose still must not include a V8 stack trace.
  assert.equal(result.hasStackTrace, false);
});
