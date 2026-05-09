/**
 * Follow-up tests for #3310: every remaining `error()` call at a subcommand
 * boundary or usage check in `gsd-tools.cjs` carries a typed `ERROR_REASON`.
 *
 * #3304 wired four representative paths (unknown top-level command, unknown
 * intel subcommand, missing --pick value, --version flag). The rest fell
 * through to `ERROR_REASON.UNKNOWN`. This file locks the post-#3310 contract:
 *
 *   - Every "Unknown <subsystem> subcommand" emits reason: "sdk_unknown_command".
 *   - Every "Usage: ..." / missing-required-arg path emits reason: "usage".
 *
 * All assertions parse stderr via JSON.parse — never `.includes()` — per the
 * #2974 / CONTRIBUTING.md "Prohibited: Raw Text Matching" rule.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

// Run gsd-tools with GSD_JSON_ERRORS=1 (env-var activation, exercises the
// path #3304 added alongside the --json-errors flag) and parse the
// structured stderr. Returns the parsed object; throws if stderr is not JSON.
function runJsonErrors(args, tmpDir, env = {}) {
  const result = runGsdTools(args, tmpDir, { ...env, GSD_JSON_ERRORS: '1' });
  assert.strictEqual(result.success, false,
    `Expected failure with GSD_JSON_ERRORS=1 for args: ${args.join(' ')}\n` +
    `stdout: ${result.output}\nstderr: ${result.error}`);
  let parsed;
  try {
    parsed = JSON.parse(result.error);
  } catch (e) {
    throw new Error(
      `GSD_JSON_ERRORS=1 must emit valid JSON on stderr.\n` +
      `Args: ${args.join(' ')}\nstderr: ${result.error}\nparse error: ${e.message}`
    );
  }
  return parsed;
}

// Assert the typed-IR contract: object shape + reason. Keeps the per-test
// boilerplate minimal so each error-path test reads as a single fact.
function assertTypedError(parsed, expectedReason, label) {
  assert.strictEqual(parsed.ok, false,
    `${label}: error object must have ok: false`);
  assert.strictEqual(parsed.reason, expectedReason,
    `${label}: reason must be "${expectedReason}", got: ${parsed.reason}`);
  assert.ok(typeof parsed.message === 'string' && parsed.message.length > 0,
    `${label}: message must be a non-empty string`);
}

describe('feat #3310: typed ERROR_REASON codes on remaining error paths', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── Unknown <subsystem> subcommand → SDK_UNKNOWN_COMMAND ────────────────
  // Each of these used to fall through to reason: "unknown" before #3310.

  test('unknown template subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['template', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'template');
  });

  test('unknown frontmatter subcommand → sdk_unknown_command', () => {
    // frontmatter expects subcommand at args[1] and file at args[2]; pass a
    // bogus subcommand with a placeholder file so we definitely reach the
    // unknown-subcommand branch, not an earlier validation.
    const parsed = runJsonErrors(
      ['frontmatter', 'bogus-subcommand-xyzzy', 'placeholder.md'],
      tmpDir
    );
    assertTypedError(parsed, 'sdk_unknown_command', 'frontmatter');
  });

  test('unknown requirements subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['requirements', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'requirements');
  });

  test('unknown milestone subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['milestone', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'milestone');
  });

  test('unknown uat subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['uat', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'uat');
  });

  test('unknown todo subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['todo', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'todo');
  });

  test('unknown workstream subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['workstream', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'workstream');
  });

  test('unknown graphify subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['graphify', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'graphify');
  });

  test('unknown learnings subcommand → sdk_unknown_command', () => {
    const parsed = runJsonErrors(['learnings', 'bogus-subcommand-xyzzy'], tmpDir);
    assertTypedError(parsed, 'sdk_unknown_command', 'learnings');
  });

  // ── Missing required positional/flag values → USAGE ─────────────────────
  // These previously emitted reason: "unknown" because the second argument
  // to error() was absent.

  test('missing --cwd value → usage', () => {
    // The --cwd flag is consumed before the command dispatcher; passing it
    // bare with no following value triggers the usage error at L253/L258.
    const parsed = runJsonErrors(['--cwd'], tmpDir);
    assertTypedError(parsed, 'usage', '--cwd missing value');
  });

  test('invalid --cwd directory → usage', () => {
    // --cwd <nonexistent-path> hits the existsSync / isDirectory check at L264.
    const parsed = runJsonErrors(
      ['--cwd', '/this/path/should/not/exist/anywhere/xyzzy', 'state', 'load'],
      tmpDir
    );
    assertTypedError(parsed, 'usage', 'invalid --cwd directory');
  });

  test('intel query missing term → usage', () => {
    const parsed = runJsonErrors(['intel', 'query'], tmpDir);
    assertTypedError(parsed, 'usage', 'intel query missing term');
  });

  test('intel patch-meta missing file path → usage', () => {
    const parsed = runJsonErrors(['intel', 'patch-meta'], tmpDir);
    assertTypedError(parsed, 'usage', 'intel patch-meta missing file');
  });

  test('intel extract-exports missing file path → usage', () => {
    const parsed = runJsonErrors(['intel', 'extract-exports'], tmpDir);
    assertTypedError(parsed, 'usage', 'intel extract-exports missing file');
  });

  test('graphify query missing term → usage', () => {
    const parsed = runJsonErrors(['graphify', 'query'], tmpDir);
    assertTypedError(parsed, 'usage', 'graphify query missing term');
  });

  test('learnings query missing --tag → usage', () => {
    const parsed = runJsonErrors(['learnings', 'query'], tmpDir);
    assertTypedError(parsed, 'usage', 'learnings query missing --tag');
  });

  test('learnings prune missing --older-than → usage', () => {
    const parsed = runJsonErrors(['learnings', 'prune'], tmpDir);
    assertTypedError(parsed, 'usage', 'learnings prune missing --older-than');
  });

  test('learnings delete missing id → usage', () => {
    const parsed = runJsonErrors(['learnings', 'delete'], tmpDir);
    assertTypedError(parsed, 'usage', 'learnings delete missing id');
  });

  test('extract-messages missing project arg → usage', () => {
    // L877 — args[1] is undefined or starts with '--'.
    const parsed = runJsonErrors(['extract-messages'], tmpDir);
    assertTypedError(parsed, 'usage', 'extract-messages missing project');
  });

  test('write-profile missing --input → usage', () => {
    const parsed = runJsonErrors(['write-profile'], tmpDir);
    assertTypedError(parsed, 'usage', 'write-profile missing --input');
  });

  test('detect-custom-files missing --config-dir → usage', () => {
    const parsed = runJsonErrors(['detect-custom-files'], tmpDir);
    assertTypedError(parsed, 'usage', 'detect-custom-files missing --config-dir');
  });

  test('detect-custom-files invalid --config-dir → usage', () => {
    const parsed = runJsonErrors(
      ['detect-custom-files', '--config-dir', '/nonexistent/path/xyzzy'],
      tmpDir
    );
    assertTypedError(parsed, 'usage', 'detect-custom-files invalid --config-dir');
  });

  // ── Shape regression guard: every newly-typed path emits the canonical
  //    {ok, reason, message} object — no leakage of reason: "unknown". ────

  test('every remaining typed path emits the canonical {ok, reason, message} shape', () => {
    const probes = [
      ['template', 'bogus'],
      ['frontmatter', 'bogus', 'placeholder.md'],
      ['requirements', 'bogus'],
      ['milestone', 'bogus'],
      ['uat', 'bogus'],
      ['todo', 'bogus'],
      ['workstream', 'bogus'],
      ['graphify', 'bogus'],
      ['learnings', 'bogus'],
      ['intel', 'query'],
      ['extract-messages'],
      ['write-profile'],
      ['detect-custom-files'],
    ];
    for (const args of probes) {
      const parsed = runJsonErrors(args, tmpDir);
      const keys = Object.keys(parsed).sort();
      assert.deepStrictEqual(keys, ['message', 'ok', 'reason'],
        `args ${args.join(' ')}: keys must be exactly {ok,reason,message}, got ${keys.join(',')}`);
      assert.notStrictEqual(parsed.reason, 'unknown',
        `args ${args.join(' ')}: reason must be a typed code, not the fallback "unknown"`);
    }
  });
});
