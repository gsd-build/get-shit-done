/**
 * Regression test for bug #3019.
 *
 * `gsd-sdk query <subcommand> --help` returned the top-level SDK USAGE
 * instead of contextual help for the subcommand. The query argv parser
 * harvested --help as a global flag and main() short-circuited dispatch
 * before the registry handler / gsd-tools.cjs fallback could render
 * useful help.
 *
 * Two-layer fix:
 *   1. sdk/src/cli.ts  — leave --help in queryArgv so it travels to the
 *      handler/fallback. Only honor the global help flag when there is
 *      no subcommand to dispatch to.
 *   2. get-shit-done/bin/gsd-tools.cjs — render the top-level usage on
 *      --help instead of erroring. Anti-hallucination invariant from
 *      #1818 is preserved (the destructive command never executes).
 *
 * Tests the integration: invoke gsd-tools.cjs the same way the SDK
 * dispatcher does and assert structured-IR (success flag + usage shape)
 * rather than raw substring matches.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, isUsageOutput } = require('./helpers.cjs');

// #3026 CR (Major outside-diff): the SDK fallback wraps gsd-tools.cjs.
// When gsd-tools emits plain-text help (exit 0), the SDK previously
// JSON.parsed stdout and threw "Unexpected token 'U'". Verify the fix
// by invoking the built SDK end-to-end and asserting:
//   - exit 0
//   - stdout contains the gsd-tools usage
//   - stderr does NOT contain a JSON parse error
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');
const fs = require('node:fs');

describe('bug #3026 (CR Major outside-diff): SDK forwards plain-text help from gsd-tools fallback', () => {
  test('gsd-sdk query phase --help (fallback path) returns usage, not a JSON parse error', (t) => {
    if (!fs.existsSync(SDK_CLI)) {
      // CR feedback (#3026): a bare `return` here silent-passes the test
      // when sdk/dist/cli.js is absent (CI checkouts that haven't run
      // `npm run build`), giving no signal that the integration check
      // was skipped. Use t.skip() so the omission is visible in the
      // test report. The unit-level fix is covered by vitest on
      // sdk/src/cli.ts; this integration test only runs when the
      // built SDK is on disk.
      t.skip('sdk/dist/cli.js not built — run `npm run build` in sdk/ to enable this integration test');
      return;
    }
    // `query phase --help` (no further subcommand) is NOT in the native
    // registry, so it routes through the gsd-tools.cjs fallback. That is
    // the path that JSON.parsed the help text and threw before this fix.
    const result = spawnSync(process.execPath, [SDK_CLI, 'query', 'phase', '--help'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    // The fallback gsd-tools.cjs emits exit 0 with usage on stdout.
    assert.strictEqual(result.status, 0,
      `must exit 0 — got ${result.status}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    // Negative: must NOT see the JSON parse error that was the regression.
    assert.ok(!/Unexpected token|not valid JSON/i.test(result.stderr),
      `must NOT JSON.parse the help text (stderr): ${result.stderr}`);
    // Positive: the usage should reach the user via stdout.
    assert.ok(/Usage:\s*gsd-tools/.test(result.stdout) && /Commands:/.test(result.stdout),
      `usage must reach stdout: ${result.stdout}`);
  });
});

describe('bug #3019: gsd-tools renders usage on --help instead of erroring', () => {
  test('bare gsd-tools (no args) renders usage', () => {
    const result = runGsdTools([]);
    // No args path: error() helper emits to stderr and exits non-zero,
    // but the message body is the usage.
    assert.strictEqual(result.success, false);
    assert.ok(/Usage:\s*gsd-tools/.test(result.error));
    assert.ok(/Commands:/.test(result.error));
  });

  test('gsd-tools --help renders usage on stdout, exits 0', () => {
    const result = runGsdTools(['--help']);
    assert.strictEqual(result.success, true, '--help should not be an error');
    assert.ok(isUsageOutput(result.output), `expected usage on stdout, got: ${result.output}`);
  });

  test('gsd-tools -h renders usage on stdout, exits 0', () => {
    const result = runGsdTools(['-h']);
    assert.strictEqual(result.success, true);
    assert.ok(isUsageOutput(result.output));
  });

  test('gsd-tools <subcommand> --help renders usage (does not run subcommand)', () => {
    // The classic #3019 surface: the user types a subcommand expecting
    // contextual help. We render the top-level usage — strictly better
    // than the previous unhelpful "Unknown flag --help" error.
    const result = runGsdTools(['phase', 'add', '--help']);
    assert.strictEqual(result.success, true);
    assert.ok(isUsageOutput(result.output));
  });

  test('usage hint mentions how to discover argument requirements', () => {
    // The usage now points users at the discovery method that actually works
    // (run without args → error message names required arguments). Asserting
    // on the parsed shape of the usage rather than substring-matching prose:
    const result = runGsdTools(['--help']);
    assert.strictEqual(result.success, true);
    // Structural check: split into sections.
    const lines = result.output.split('\n');
    const hasUsageLine = lines.some((l) => l.startsWith('Usage:'));
    const hasCommandsLine = lines.some((l) => l.startsWith('Commands:'));
    const hasDiscoveryHint = lines.some((l) => /argument requirements|without args|invoke the command/i.test(l));
    assert.ok(hasUsageLine, 'first section: Usage');
    assert.ok(hasCommandsLine, 'second section: Commands');
    assert.ok(hasDiscoveryHint, 'third section: how to discover per-command args');
  });
});
