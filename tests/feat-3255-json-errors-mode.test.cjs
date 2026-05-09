/**
 * Tests for the --json-errors mode added in #3255.
 *
 * When gsd-tools is invoked with --json-errors, all error() calls emit a
 * structured JSON object to stderr:
 *
 *   { ok: false, reason: "<error_code>", message: "<human text>" }
 *
 * This lets tests assert on typed reason codes instead of grepping free-form
 * stderr text.  All assertions below parse the captured stderr via JSON.parse
 * and inspect typed fields — never result.error.includes() (#2974 / k001).
 *
 * Covered error paths (representative set, each exercises a different branch):
 *   1. Unknown top-level command   → reason: "sdk_unknown_command"
 *   2. Unknown dotted command      → reason: "sdk_unknown_command"
 *   3. Missing required argument   → reason: "usage"  (--pick without value)
 *   4. Config key not found        → reason: "config_key_not_found"
 *   5. Unknown subcommand          → reason: "sdk_unknown_command"
 *   6. GSD_JSON_ERRORS=1 env var   → same structured output without --flag
 *   7. Successful command unaffected
 *   8. Error object shape is stable ({ok, reason, message})
 *   9. Single error line per invocation
 *  10. Unknown flag                → reason: "usage"
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// Helper: run gsd-tools with --json-errors and parse the structured stderr.
// Returns the parsed object, or throws if stderr is not valid JSON.
function runJsonErrors(args, tmpDir, env = {}) {
  const allArgs = ['--json-errors', ...args];
  const result = runGsdTools(allArgs, tmpDir, env);
  // Must have failed
  assert.strictEqual(result.success, false,
    `Expected failure with --json-errors for args: ${args.join(' ')}\nstdout: ${result.output}\nstderr: ${result.error}`);
  let parsed;
  try {
    parsed = JSON.parse(result.error);
  } catch (e) {
    throw new Error(
      `--json-errors must emit valid JSON on stderr.\n` +
      `Args: ${args.join(' ')}\n` +
      `stderr: ${result.error}\n` +
      `parse error: ${e.message}`
    );
  }
  return parsed;
}

describe('feat #3255: --json-errors mode emits structured error objects', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── 1. Unknown top-level command ─────────────────────────────────────────

  test('unknown top-level command emits { ok: false, reason: "sdk_unknown_command" }', () => {
    const parsed = runJsonErrors(['totally-unknown-command-xyzzy'], tmpDir);

    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'sdk_unknown_command',
      `reason must be "sdk_unknown_command", got: ${parsed.reason}`);
    assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
      'message must be a non-empty string');
  });

  // ── 2. Unknown dotted command ────────────────────────────────────────────

  test('unknown dotted command (foo.bar) emits { ok: false, reason: "sdk_unknown_command" }', () => {
    const parsed = runJsonErrors(['foo.bar'], tmpDir);

    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'sdk_unknown_command',
      `dotted unknown command reason must be "sdk_unknown_command", got: ${parsed.reason}`);
    assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
      'message must be a non-empty string');
  });

  // ── 3. Missing --pick value ───────────────────────────────────────────────

  test('--pick without value emits { ok: false, reason: "usage" }', () => {
    const parsed = runJsonErrors(['generate-slug', 'test-text', '--pick'], tmpDir);

    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'usage',
      `missing --pick value reason must be "usage", got: ${parsed.reason}`);
    assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
      'message must be a non-empty string');
  });

  // ── 4. Config key not found ───────────────────────────────────────────────

  test('config-get for absent key emits { ok: false, reason: "config_key_not_found" }', () => {
    // Initialise config.json first so we reach the "key not found" branch
    // rather than the "no config.json" branch.
    runGsdTools(['config-ensure-section'], tmpDir);

    const parsed = runJsonErrors(['config-get', 'nonexistent_config_key_xyzzy'], tmpDir);

    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'config_key_not_found',
      `reason must be "config_key_not_found", got: ${parsed.reason}`);
    assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
      'message must be a non-empty string');
  });

  // ── 5. Unknown subcommand within a domain ────────────────────────────────

  test('unknown intel subcommand emits { ok: false, reason: "sdk_unknown_command" }', () => {
    const parsed = runJsonErrors(['intel', 'bogus-subcommand-xyzzy'], tmpDir);

    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'sdk_unknown_command',
      `unknown subcommand reason must be "sdk_unknown_command", got: ${parsed.reason}`);
    assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
      'message must be a non-empty string');
  });

  // ── 6. GSD_JSON_ERRORS=1 env var activates structured mode ───────────────

  test('GSD_JSON_ERRORS=1 env var produces same structured error as --json-errors flag', () => {
    // Run with env var instead of --json-errors flag
    const result = runGsdTools(
      ['totally-unknown-command-xyzzy'],
      tmpDir,
      { GSD_JSON_ERRORS: '1' }
    );
    assert.strictEqual(result.success, false,
      'command must fail');
    let parsed;
    try {
      parsed = JSON.parse(result.error);
    } catch (e) {
      throw new Error(
        `GSD_JSON_ERRORS=1 must emit valid JSON on stderr.\n` +
        `stderr: ${result.error}\n` +
        `parse error: ${e.message}`
      );
    }
    assert.strictEqual(parsed.ok, false,
      'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'sdk_unknown_command',
      `reason must be "sdk_unknown_command", got: ${parsed.reason}`);
  });

  // ── 7. Successful commands are unaffected by --json-errors ───────────────

  test('successful command with --json-errors flag still succeeds normally', () => {
    const result = runGsdTools(
      ['--json-errors', 'generate-slug', 'hello-world'],
      tmpDir
    );
    assert.strictEqual(result.success, true,
      `Successful command must not be broken by --json-errors flag.\nstderr: ${result.error}`);
    assert.ok(result.output.length > 0,
      'stdout must be non-empty for successful generate-slug');
  });

  // ── 8. Error object shape is stable (no extra top-level keys) ────────────

  test('error object contains exactly {ok, reason, message} — no extra keys', () => {
    const parsed = runJsonErrors(['totally-unknown-command-xyzzy'], tmpDir);

    const keys = Object.keys(parsed).sort();
    assert.deepStrictEqual(keys, ['message', 'ok', 'reason'],
      `error object must have exactly {ok, reason, message}. Got keys: ${keys.join(', ')}`);
  });

  // ── 9. Multiple errors in one session: only the first error is emitted ───

  test('only one error JSON line is emitted per invocation (process exits on first error)', () => {
    const result = runGsdTools(
      ['--json-errors', 'totally-unknown-command-xyzzy'],
      tmpDir
    );
    assert.strictEqual(result.success, false, 'must fail');
    const lines = result.error.trim().split('\n').filter(l => l.length > 0);
    assert.strictEqual(lines.length, 1,
      `stderr must contain exactly one JSON line, got ${lines.length}:\n${result.error}`);
    // Also verify the single line is valid JSON
    const parsed = JSON.parse(lines[0]);
    assert.strictEqual(parsed.ok, false);
  });

  // ── 10. Unknown flag emits { ok: false, reason: "usage" } ────────────────

  test('unknown version flag emits { ok: false, reason: "usage" }', () => {
    const parsed = runJsonErrors(['--version', 'generate-slug', 'x'], tmpDir);

    assert.strictEqual(parsed.ok, false, 'error object must have ok: false');
    assert.strictEqual(parsed.reason, 'usage',
      `--version flag reason must be "usage", got: ${parsed.reason}`);
  });
});
