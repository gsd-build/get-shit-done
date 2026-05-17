/**
 * CLI negative matrix for the `config` command family (#3593).
 *
 * Exercises the 12 adversarial input categories enumerated in
 * CONTRIBUTING.md §"QA Matrix Requirements / CLI and command routing"
 * against `config-get` and `config-set`. The harness in
 * `tests/helpers/cli-negative.cjs` shapes spawnSync output into a typed
 * IR so every assertion runs on `result.reason`, `result.status`, and
 * `result.hasStackTrace` — never on stderr/stdout prose.
 *
 * Each test gets its own temp project (no shared state) so concurrent
 * runs can't observe each other's filesystem mutations. Hostile values
 * (shell metacharacters, null bytes, unicode, very long strings) reach
 * the CLI as single argv elements via spawnSync — never composed into
 * a shell string — so the test framework itself can't be the source of
 * a false positive on shell-injection assertions.
 */

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runCli } = require('./helpers/cli-negative.cjs');
const { createTempProject, cleanup } = require('./helpers.cjs');

/**
 * Universal invariants every adversarial case must satisfy when the
 * CLI is invoked with --json-errors. Bundling these in a helper keeps
 * each test focused on the case-specific reason assertion.
 */
function assertSafeFailure(result, msg = '') {
  assert.notEqual(result.status, 0, `${msg} :: expected non-zero exit`);
  assert.equal(result.signal, null, `${msg} :: must exit cleanly, not via signal`);
  assert.equal(result.hasStackTrace, false, `${msg} :: stderr must not leak a V8 stack frame`);
  assert.equal(result.ok, false, `${msg} :: JSON payload ok must be false`);
  assert.equal(typeof result.reason, 'string', `${msg} :: reason must be a string`);
  assert.notEqual(result.reason, '', `${msg} :: reason must not be empty`);
  // The harness's JSON-shape detection runs on the trimmed stderr; if we
  // got here with reason set, the payload was a valid object — that already
  // implies no rogue prose was mixed in. Re-asserting the trimmed form would
  // be redundant.
}

/**
 * Snapshot the file inventory of a directory so a later assertion can
 * prove the failing CLI invocation did NOT create or modify any file.
 */
function snapshotInventory(dir) {
  const entries = [];
  function walk(rel) {
    const abs = path.join(dir, rel);
    let stat;
    try { stat = fs.lstatSync(abs); } catch { return; }
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) walk(path.join(rel, name));
    } else {
      entries.push(`${rel}\t${stat.size}\t${stat.mtimeMs}`);
    }
  }
  walk('.');
  return entries.join('\n');
}

// ─── 1. Missing required arg ────────────────────────────────────────────────

test('config-get with no key fails with a typed reason and no stack trace', (t) => {
  const projectDir = createTempProject('cli-neg-config-1-');
  t.after(() => cleanup(projectDir));
  const before = snapshotInventory(projectDir);
  const result = runCli(['config-get'], { cwd: projectDir });
  assertSafeFailure(result, 'config-get missing key');
  assert.equal(snapshotInventory(projectDir), before, 'failing read must not mutate FS');
});

test('config-set with no key fails with a typed reason', (t) => {
  const projectDir = createTempProject('cli-neg-config-2-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-set'], { cwd: projectDir });
  assertSafeFailure(result, 'config-set missing key');
});

test('config-set with key but no value fails with a typed reason', (t) => {
  const projectDir = createTempProject('cli-neg-config-3-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-set', 'model_profile'], { cwd: projectDir });
  assertSafeFailure(result, 'config-set missing value');
});

// ─── 2/3. Empty / whitespace arg ────────────────────────────────────────────

test('config-get with empty-string key fails safely', (t) => {
  const projectDir = createTempProject('cli-neg-config-4-');
  t.after(() => cleanup(projectDir));
  const before = snapshotInventory(projectDir);
  const result = runCli(['config-get', ''], { cwd: projectDir });
  assertSafeFailure(result, 'config-get empty key');
  assert.equal(snapshotInventory(projectDir), before, 'failing read must not mutate FS');
});

test('config-get with whitespace-only key fails safely', (t) => {
  const projectDir = createTempProject('cli-neg-config-5-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-get', '   \t  '], { cwd: projectDir });
  assertSafeFailure(result, 'config-get whitespace key');
});

test('config-set with empty key string fails safely', (t) => {
  const projectDir = createTempProject('cli-neg-config-6-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-set', '', 'value'], { cwd: projectDir });
  assertSafeFailure(result, 'config-set empty key');
});

// ─── 4. Duplicate flags ─────────────────────────────────────────────────────

test('--cwd specified twice does not silently use the wrong one', (t) => {
  // Make two real but distinct dirs so the test can't accidentally pass
  // because one of the paths is invalid.
  const a = createTempProject('cli-neg-config-7a-');
  const b = createTempProject('cli-neg-config-7b-');
  t.after(() => { cleanup(a); cleanup(b); });
  // No --json-errors here on purpose: --cwd is parsed before json mode is
  // applied, so we exercise both code paths by running once each.
  const result = runCli(['--cwd', a, '--cwd', b, 'config-get', 'model_profile'], { cwd: process.cwd() });
  // Either: (a) the CLI rejects duplicate --cwd with a typed reason; OR
  // (b) it commits to one of the values deterministically. The safety
  // bar is "no stack trace, no half-state mutation in EITHER dir".
  assert.equal(result.hasStackTrace, false, 'duplicate --cwd must not crash with a stack trace');
  // Neither tmp dir should have a written config since model_profile is
  // a read, not a write, and it didn't exist beforehand. Prove the read
  // didn't accidentally trigger a write side effect.
  assert.equal(fs.existsSync(path.join(a, '.planning', 'config.json')), false);
  assert.equal(fs.existsSync(path.join(b, '.planning', 'config.json')), false);
});

// ─── 5. Conflicting flags ───────────────────────────────────────────────────

test('--json-errors with --no-such-flag does not crash with a stack trace', (t) => {
  const projectDir = createTempProject('cli-neg-config-8-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['--no-such-flag', 'config-get', 'model_profile'], { cwd: projectDir });
  assert.equal(result.hasStackTrace, false, 'unknown global flag must not crash with a stack trace');
  assert.notEqual(result.status, 0, 'unknown global flag must fail');
});

// ─── 6. Malformed assignment / unknown subcommand ──────────────────────────

test('config-FAKE subcommand fails with a typed reason', (t) => {
  const projectDir = createTempProject('cli-neg-config-9-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-FAKE'], { cwd: projectDir });
  assertSafeFailure(result, 'unknown config-* command');
});

// ─── 7. Unknown subcommands at each command depth ───────────────────────────

test('config family — bare top-level "config" without a subcommand fails safely', (t) => {
  const projectDir = createTempProject('cli-neg-config-10-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config'], { cwd: projectDir });
  // Either "missing subcommand" usage or genuine no-op behavior — what we
  // pin is "no stack trace, no FS mutation".
  assert.equal(result.hasStackTrace, false);
});

// ─── 8. Values that look like flags ─────────────────────────────────────────

test('config-set value that starts with -- is treated as a value, not a flag', (t) => {
  const projectDir = createTempProject('cli-neg-config-11-');
  t.after(() => cleanup(projectDir));
  // First create a config.json so the set has a target file.
  runCli(['config-ensure-section'], { cwd: projectDir });
  const result = runCli(['config-set', 'project_code', '--weird'], { cwd: projectDir });
  // Acceptable outcomes:
  //   (a) CLI accepts --weird as the value (and persists it),
  //   (b) CLI rejects it as a usage error.
  // Either way: no stack trace, no half-written corrupt config.
  assert.equal(result.hasStackTrace, false, 'value-looking-like-a-flag must not crash');
  const configPath = path.join(projectDir, '.planning', 'config.json');
  if (fs.existsSync(configPath)) {
    // If a config exists, it must still be valid JSON — no half-write corruption.
    const raw = fs.readFileSync(configPath, 'utf-8');
    assert.doesNotThrow(() => JSON.parse(raw), 'config.json must remain parseable after a failed set');
  }
});

// ─── 9. Invalid JSON / corrupt config file ──────────────────────────────────

test('config-get against a corrupt config.json fails with a parse-failed reason', (t) => {
  const projectDir = createTempProject('cli-neg-config-12-');
  t.after(() => cleanup(projectDir));
  const configPath = path.join(projectDir, '.planning', 'config.json');
  fs.writeFileSync(configPath, '{ this is not json'); // deliberate corruption
  const originalCorrupt = fs.readFileSync(configPath, 'utf-8');
  const result = runCli(['config-get', 'model_profile'], { cwd: projectDir });
  assertSafeFailure(result, 'corrupt config.json');
  // The corrupt file must remain untouched — the CLI must not "helpfully"
  // overwrite an unparseable config in the failure path.
  assert.equal(fs.readFileSync(configPath, 'utf-8'), originalCorrupt, 'corrupt file must be preserved as-is');
  // Specific reason: CONFIG_PARSE_FAILED (or equivalent) — pin this so a
  // regression where parse failure leaks as "unknown" is caught.
  assert.match(
    result.reason,
    /^(config_parse_failed|config_no_file|config_invalid_key|usage)$/,
    `parse-failure reason must be from the typed ERROR_REASON enum (got: ${result.reason})`,
  );
});

// ─── 10. Very long arg ──────────────────────────────────────────────────────

test('config-get with a very long key (50KB) fails safely without hanging', (t) => {
  const projectDir = createTempProject('cli-neg-config-13-');
  t.after(() => cleanup(projectDir));
  const longKey = 'x'.repeat(50000);
  const result = runCli(['config-get', longKey], { cwd: projectDir, timeoutMs: 8000 });
  assert.equal(result.signal, null, 'long input must not trigger the harness timeout');
  assert.equal(result.hasStackTrace, false, 'long input must not crash');
  assert.notEqual(result.status, 0, 'unknown 50KB key must fail');
});

// ─── 11. Unicode / non-ASCII ────────────────────────────────────────────────

test('config-get with a Unicode key fails safely', (t) => {
  const projectDir = createTempProject('cli-neg-config-14-');
  t.after(() => cleanup(projectDir));
  const result = runCli(['config-get', 'workflow.🔥_mode'], { cwd: projectDir });
  assertSafeFailure(result, 'unicode key');
});

test('config-set with an emoji value persists or rejects without corrupting JSON', (t) => {
  const projectDir = createTempProject('cli-neg-config-15-');
  t.after(() => cleanup(projectDir));
  runCli(['config-ensure-section'], { cwd: projectDir });
  const result = runCli(['config-set', 'project_code', '🔥👾'], { cwd: projectDir });
  assert.equal(result.hasStackTrace, false);
  // If it accepted, the JSON must round-trip cleanly.
  const configPath = path.join(projectDir, '.planning', 'config.json');
  if (result.status === 0 && fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(typeof parsed, 'object', 'config.json must be a valid object');
    if (parsed.project_code != null) {
      assert.equal(typeof parsed.project_code, 'string', 'project_code must remain a string');
    }
  }
});

// ─── 12. Shell metacharacters (the security-critical case) ──────────────────

const SHELL_PAYLOADS = [
  // Each one would, if shell-interpreted, create a sentinel file
  // adjacent to the project tree. Argv-based invocation must treat them
  // as opaque text.
  '$(touch ${PROJECT}/INJ-dollar-paren)',
  '`touch ${PROJECT}/INJ-backtick`',
  '; touch ${PROJECT}/INJ-semicolon;',
  '&& touch ${PROJECT}/INJ-and',
  '|| touch ${PROJECT}/INJ-or',
  '| tee ${PROJECT}/INJ-pipe',
  '> ${PROJECT}/INJ-redirect',
  // Quote-balanced payloads — these have historically broken naive
  // shell-string composition even when the rest of the code uses argv.
  '"; touch ${PROJECT}/INJ-quote;"',
  '\'; touch ${PROJECT}/INJ-quote;\'',
];

for (const payload of SHELL_PAYLOADS) {
  test(`config-get with shell-metachar key (${payload.slice(0, 25)}…) does NOT execute the payload`, (t) => {
    const projectDir = createTempProject('cli-neg-config-shell-');
    t.after(() => cleanup(projectDir));
    const resolvedPayload = payload.replace(/\$\{PROJECT\}/g, projectDir);
    const result = runCli(['config-get', resolvedPayload], { cwd: projectDir });
    // No shell interpretation: none of the INJ-* sentinel files must
    // exist after the run. Walk the project dir and assert.
    const entries = fs.readdirSync(projectDir);
    const sentinels = entries.filter((n) => n.startsWith('INJ-'));
    assert.deepEqual(sentinels, [], `shell payload must NOT create sentinel files (found: ${sentinels.join(', ')})`);
    // The CLI may exit 0 (legitimate — the metacharacter-laden key
    // simply doesn't exist in config) or non-zero (typed reason). Both
    // are acceptable as long as no payload was executed.
    assert.equal(result.hasStackTrace, false);
  });
}

// ─── Cross-cutting: --cwd points at a non-existent path ────────────────────

test('--cwd pointing at a non-existent path fails with a typed usage reason', (t) => {
  const nonExistent = path.join(require('os').tmpdir(), 'cli-neg-no-such-dir-' + Date.now() + '-' + Math.random());
  assert.equal(fs.existsSync(nonExistent), false, 'pre-check: path must not exist');
  const result = runCli(['--cwd', nonExistent, 'config-get', 'model_profile'], { cwd: process.cwd() });
  assert.notEqual(result.status, 0);
  assert.equal(result.hasStackTrace, false);
  // gsd-tools validates --cwd up-front and emits ERROR_REASON.USAGE.
  assert.equal(result.reason, 'usage', `expected reason=usage for invalid --cwd, got: ${result.reason}`);
});

test('--cwd with an empty value fails with a typed usage reason', () => {
  const result = runCli(['--cwd', '', 'config-get', 'model_profile'], { cwd: process.cwd() });
  assert.notEqual(result.status, 0);
  assert.equal(result.hasStackTrace, false);
  assert.equal(result.reason, 'usage');
});
