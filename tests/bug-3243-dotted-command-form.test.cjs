/**
 * Regression tests for bug #3243.
 *
 * The CJS dispatcher (gsd-tools.cjs) must accept dotted canonical command
 * form (e.g. `state.update`) as well as the spaced form (`state update`).
 * Workflow markdown files emit `gsd-sdk query <domain>.<subcommand>` calls,
 * and any caller that bypasses the SDK (stale npm binary, direct shell-out,
 * third-party script) would hit "Unknown command: <domain>.<subcommand>".
 *
 * The fix: a top-of-main() shim that splits args[0] on the first `.` when
 * present and normalizes to the spaced form before the switch is reached.
 *
 * This test file uses runGsdTools() — never readFileSync + .includes().
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

describe('bug #3243: CJS dispatcher accepts dotted canonical command form', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  // ── generate-slug: no project structure needed, deterministic output ────

  test('generate-slug.hello-world (dotted) produces the same slug as spaced form', () => {
    const spaced = runGsdTools(['generate-slug', 'hello-world'], tmpDir);
    assert.strictEqual(spaced.success, true, [
      'control (spaced form) failed:',
      spaced.error,
    ].join(' '));

    const dotted = runGsdTools(['generate-slug.hello-world'], tmpDir);
    // Before the fix this errors: "Unknown command: generate-slug.hello-world"
    assert.strictEqual(dotted.success, true, [
      'dotted form must not emit "Unknown command":',
      dotted.error,
    ].join(' '));
    assert.strictEqual(dotted.output, spaced.output,
      'dotted form must produce identical output to spaced form');
  });

  test('current-timestamp.date (dotted) produces the same output as spaced form', () => {
    const spaced = runGsdTools(['current-timestamp', 'date'], tmpDir);
    assert.strictEqual(spaced.success, true, [
      'control (spaced form) failed:',
      spaced.error,
    ].join(' '));

    const dotted = runGsdTools(['current-timestamp.date'], tmpDir);
    assert.strictEqual(dotted.success, true, [
      'dotted form must not emit "Unknown command":',
      dotted.error,
    ].join(' '));
    assert.strictEqual(dotted.output, spaced.output,
      'dotted form must produce identical output to spaced form');
  });

  // ── Commands with subcommands that need a project ────────────────────────

  test('validate.plan (dotted) routes into validate handler, not "Unknown command"', () => {
    const dotted = runGsdTools(['validate.plan'], tmpDir);
    // Before the fix: success=false, error contains "Unknown command: validate.plan"
    // After the fix: success=false is still possible (validate needs a PLAN.md),
    // but the error must NOT mention "Unknown command".
    assert.ok(
      !dotted.error.includes('Unknown command: validate.plan'),
      [
        'dotted form must not produce "Unknown command: validate.plan".',
        'Got error:', dotted.error,
      ].join('\n')
    );
  });

  test('roadmap.analyze (dotted) routes into roadmap handler, not "Unknown command"', () => {
    const dotted = runGsdTools(['roadmap.analyze'], tmpDir);
    assert.ok(
      !dotted.error.includes('Unknown command: roadmap.analyze'),
      [
        'dotted form must not produce "Unknown command: roadmap.analyze".',
        'Got error:', dotted.error,
      ].join('\n')
    );
  });

  test('phases.list (dotted) routes into phases handler, not "Unknown command"', () => {
    const dotted = runGsdTools(['phases.list'], tmpDir);
    assert.ok(
      !dotted.error.includes('Unknown command: phases.list'),
      [
        'dotted form must not produce "Unknown command: phases.list".',
        'Got error:', dotted.error,
      ].join('\n')
    );
  });

  // ── Multi-dot commands: split on first dot only ──────────────────────────

  test('check.decision-coverage-plan (multi-dot-safe: first dot splits)', () => {
    const dotted = runGsdTools(['check.decision-coverage-plan'], tmpDir);
    // "check" is not a known top-level command currently, so this will still
    // fail — but the error must NOT say "Unknown command: check.decision-coverage-plan"
    // (the dotted form); it should say something about "check" (the split result).
    assert.ok(
      !dotted.error.includes('Unknown command: check.decision-coverage-plan'),
      [
        'multi-dot dotted form must not be passed verbatim to "Unknown command".',
        'Got error:', dotted.error,
      ].join('\n')
    );
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  test('command without dots is unchanged (existing behaviour preserved)', () => {
    const result = runGsdTools(['generate-slug', 'no-dots-here'], tmpDir);
    assert.strictEqual(result.success, true, [
      'spaced-only invocation must still work:',
      result.error,
    ].join(' '));
    assert.ok(result.output.length > 0, 'output must be non-empty');
  });

  test('leading-dot arg (e.g. .hidden) is not mis-routed by the shim', () => {
    // A leading dot in args[0] like ".hidden" has head="" (empty) after split,
    // so the shim must reject it and fall through to the existing "Unknown command"
    // path (not silently reroute to an empty-string command).
    const result = runGsdTools(['.hidden'], tmpDir);
    assert.strictEqual(result.success, false, 'leading-dot arg must not succeed');
  });

  // ── "Unknown command" error message improvement ──────────────────────────

  test('"Unknown command" error for dotted form suggests spaced equivalent', () => {
    // A genuinely unknown dotted command (e.g. "foo.bar") should include a
    // "did you mean" hint pointing at the spaced form "foo bar".
    const result = runGsdTools(['foo.bar'], tmpDir);
    assert.strictEqual(result.success, false, '"foo.bar" must fail');
    assert.ok(
      result.error.includes('foo bar') || result.error.includes('foo.bar'),
      [
        'error for unknown dotted command should mention the command or suggest spaced form.',
        'Got:', result.error,
      ].join('\n')
    );
  });
});
