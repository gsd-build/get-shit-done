/**
 * CLI negative-matrix harness (#3593).
 *
 * Wraps spawnSync of get-shit-done/bin/gsd-tools.cjs so test files can
 * assert on structured outputs (exit code, typed reason, stack-trace
 * absence) without each test re-implementing the JSON-errors parsing
 * dance. Hostile values are passed as argv elements — never composed
 * into a shell string — so shell metacharacters in test inputs (;, &&,
 * $(), backticks, quotes, newlines, null bytes) reach the CLI as
 * opaque data, not as shell syntax.
 *
 * Designed against CONTRIBUTING.md §"Testing Standards" and
 * TEST-EXAMPLES.md §"CLI Negative Matrix":
 *
 *   - spawnSync (no shell) per the "no shell strings" rule.
 *   - Returns a typed IR { status, ok, reason, message, ... } so tests
 *     assert on `.reason === REASON_CODE`, never on prose.
 *   - Detects stack-trace leakage in stderr; tests can fail when the
 *     CLI surfaces an unexpected exception under hostile input.
 *   - --json-errors is on by default; pass jsonErrors:false to verify
 *     human-formatted stderr paths.
 *
 * The harness does NOT decide what the test asserts — it just shapes
 * the data so the assertion is mechanical and prose-free.
 */

'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TOOLS_PATH = path.resolve(__dirname, '..', '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

/**
 * Run gsd-tools with the given argv against a project directory.
 *
 * @param {string[]} argv - argument vector passed to gsd-tools.cjs. Each
 *   element reaches the child as a single argv element regardless of
 *   shell metacharacters in its value.
 * @param {object} options
 * @param {string} options.cwd - working directory for the child (REQUIRED).
 * @param {object} [options.env] - env vars merged on top of process.env.
 * @param {boolean} [options.jsonErrors=true] - prepend --json-errors so
 *   the CLI emits a structured `{ ok, reason, message }` payload to
 *   stderr. Set false to exercise the human-formatted path.
 * @param {number} [options.timeoutMs=10000] - kill child if it runs longer.
 * @returns {object} typed IR — see field docs below.
 */
function runCli(argv, options) {
  if (!options || typeof options.cwd !== 'string' || options.cwd.length === 0) {
    throw new TypeError('runCli: options.cwd (string) is required');
  }
  if (!Array.isArray(argv)) {
    throw new TypeError('runCli: argv must be an array (no shell strings)');
  }
  const jsonErrors = options.jsonErrors !== false;
  const finalArgs = jsonErrors ? ['--json-errors', ...argv] : argv.slice();
  const env = { ...process.env, ...(options.env || {}) };
  const spawnResult = spawnSync(process.execPath, [TOOLS_PATH, ...finalArgs], {
    cwd: options.cwd,
    encoding: 'utf-8',
    timeout: typeof options.timeoutMs === 'number' ? options.timeoutMs : 10000,
    env,
  });
  return parseSpawnResult(spawnResult, { jsonErrorsRequested: jsonErrors });
}

/**
 * Shape a raw spawnSync result into the harness IR.
 *
 * Returned fields:
 *   - status   {number|null}  child exit code (null if killed by signal)
 *   - signal   {string|null}  terminating signal name when killed
 *   - stdout   {string}       captured stdout
 *   - stderr   {string}       captured stderr
 *   - ok       {boolean|null} parsed from JSON-errors payload; null when
 *                             stderr is not JSON-shaped
 *   - reason   {string|null}  ERROR_REASON code from JSON-errors payload
 *   - message  {string|null}  human message from JSON-errors payload
 *   - hasStackTrace {boolean} stderr contains a `\n    at ` frame line.
 *                             Tests use this to assert the CLI didn't
 *                             leak an unexpected exception.
 *   - jsonErrorsRequested {boolean} true when --json-errors was added by
 *                             the harness; tests use this to decide
 *                             whether the missing-reason case is a bug
 *                             vs. expected (jsonErrors:false path).
 *   - spawnError {Error|null} spawnSync's `error` field (e.g. ENOENT
 *                             on process.execPath, timeout signal).
 */
function parseSpawnResult(spawnResult, meta) {
  const stderr = typeof spawnResult.stderr === 'string' ? spawnResult.stderr : '';
  const stdout = typeof spawnResult.stdout === 'string' ? spawnResult.stdout : '';
  // Stack-trace leak detection: V8 prints "    at Function (path:line:col)"
  // frames into stderr when an uncaught throw escapes. Any such line means
  // the CLI hit a code path that wasn't wrapped in error()/typed reason.
  // \n is required so we don't match the word "at" appearing in prose.
  const hasStackTrace = /\n\s{2,}at\s+/.test(stderr);

  let ok = null;
  let reason = null;
  let message = null;
  // JSON-errors mode emits a single-line JSON document to stderr followed by
  // a newline. Parse defensively — any non-JSON stderr leaves the fields null
  // and lets the test surface the discrepancy.
  const trimmed = stderr.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (typeof parsed.ok === 'boolean') ok = parsed.ok;
        if (typeof parsed.reason === 'string') reason = parsed.reason;
        if (typeof parsed.message === 'string') message = parsed.message;
      }
    } catch {
      // Not JSON after all — leave parsed fields null.
    }
  }

  return {
    status: spawnResult.status,
    signal: spawnResult.signal,
    stdout,
    stderr,
    ok,
    reason,
    message,
    hasStackTrace,
    jsonErrorsRequested: meta && meta.jsonErrorsRequested === true,
    spawnError: spawnResult.error || null,
  };
}

module.exports = { runCli, parseSpawnResult, TOOLS_PATH };
