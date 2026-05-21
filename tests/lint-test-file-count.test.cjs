'use strict';

/**
 * Tests for scripts/lint-test-file-count.cjs
 *
 * Uses node --test + the exported evaluateLint() pure function.
 * Also exercises the CLI via --json mode to verify end-to-end wiring.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const LINT_SCRIPT = path.join(ROOT, 'scripts', 'lint-test-file-count.cjs');

const {
  Verdict,
  evaluateLint,
  testEffectivePrefix,
} = require(LINT_SCRIPT);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFiles(prefix, names) {
  return names.map(n => `/fake/tests/${n}`);
}

function runCliJson(extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [LINT_SCRIPT, '--json', ...extraArgs],
    { encoding: 'utf8' }
  );
  const parsed = JSON.parse(result.stdout);
  return { status: result.status, data: parsed };
}

// ---------------------------------------------------------------------------
// evaluateLint — core verdict logic
// ---------------------------------------------------------------------------

describe('evaluateLint — OK_UNDER_LIMIT', () => {
  test('1-file module passes', () => {
    const result = evaluateLint({
      prefix: 'my-module',
      testFiles: makeFiles('my-module', ['my-module.test.cjs']),
      allowlist: {},
    });
    assert.strictEqual(result.verdict, Verdict.OK_UNDER_LIMIT);
    assert.strictEqual(result.count, 1);
    assert.strictEqual(result.ceiling, null);
  });

  test('2-file module passes (primary + integration)', () => {
    const result = evaluateLint({
      prefix: 'my-module',
      testFiles: makeFiles('my-module', [
        'my-module.test.cjs',
        'my-module.integration.test.ts',
      ]),
      allowlist: {},
    });
    assert.strictEqual(result.verdict, Verdict.OK_UNDER_LIMIT);
    assert.strictEqual(result.count, 2);
  });
});

describe('evaluateLint — FAIL_EXCEEDS_LIMIT', () => {
  test('3-file module fails when not in allowlist', () => {
    const result = evaluateLint({
      prefix: 'my-module',
      testFiles: makeFiles('my-module', [
        'my-module.test.cjs',
        'my-module-edge-case.test.cjs',
        'my-module-regression.test.cjs',
      ]),
      allowlist: {},
    });
    assert.strictEqual(result.verdict, Verdict.FAIL_EXCEEDS_LIMIT);
    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.ceiling, null);
  });
});

describe('evaluateLint — allowlist behaviour', () => {
  test('3-file module allowlisted at 3 passes (OK_IN_ALLOWLIST)', () => {
    const result = evaluateLint({
      prefix: 'phase',
      testFiles: makeFiles('phase', [
        'phase.test.cjs',
        'phase-edge.test.cjs',
        'phase-regression.test.cjs',
      ]),
      allowlist: { phase: { current: 3, issue: 'TBD' } },
    });
    assert.strictEqual(result.verdict, Verdict.OK_IN_ALLOWLIST);
    assert.strictEqual(result.count, 3);
    assert.strictEqual(result.ceiling, 3);
  });

  test('2-file module allowlisted at 3 emits HINT_CAN_REMOVE_FROM_ALLOWLIST', () => {
    const result = evaluateLint({
      prefix: 'phase',
      testFiles: makeFiles('phase', [
        'phase.test.cjs',
        'phase-edge.test.cjs',
      ]),
      allowlist: { phase: { current: 3, issue: 'TBD' } },
    });
    assert.strictEqual(result.verdict, Verdict.HINT_CAN_REMOVE_FROM_ALLOWLIST);
    assert.strictEqual(result.count, 2);
    assert.strictEqual(result.ceiling, 3);
  });

  test('4-file module allowlisted at 3 fails (FAIL_EXCEEDS_ALLOWLIST)', () => {
    const result = evaluateLint({
      prefix: 'phase',
      testFiles: makeFiles('phase', [
        'phase.test.cjs',
        'phase-a.test.cjs',
        'phase-b.test.cjs',
        'phase-c.test.cjs',
      ]),
      allowlist: { phase: { current: 3, issue: 'TBD' } },
    });
    assert.strictEqual(result.verdict, Verdict.FAIL_EXCEEDS_ALLOWLIST);
    assert.strictEqual(result.count, 4);
    assert.strictEqual(result.ceiling, 3);
  });

  test('ratchet: count equal to ceiling passes', () => {
    const result = evaluateLint({
      prefix: 'init',
      testFiles: makeFiles('init', [
        'init.test.cjs',
        'init-manager.test.cjs',
        'init-manager-deps.test.cjs',
      ]),
      allowlist: { init: { current: 3, issue: 'TBD' } },
    });
    assert.strictEqual(result.verdict, Verdict.OK_IN_ALLOWLIST);
  });
});

// ---------------------------------------------------------------------------
// testEffectivePrefix — issue-stamp stripping
// ---------------------------------------------------------------------------

describe('testEffectivePrefix', () => {
  test('normal test file returns bare prefix', () => {
    assert.strictEqual(testEffectivePrefix('query-dispatch.test.cjs'), 'query-dispatch');
  });

  test('integration test file returns bare prefix', () => {
    assert.strictEqual(testEffectivePrefix('init.integration.test.ts'), 'init');
  });

  test('bug-stamped file strips stamp', () => {
    assert.strictEqual(testEffectivePrefix('bug-1736-local-install-commands.test.cjs'), 'local-install-commands');
  });

  test('feat-stamped file strips stamp', () => {
    assert.strictEqual(testEffectivePrefix('feat-3347-graphify-auto-update-config.test.cjs'), 'graphify-auto-update-config');
  });

  test('enh-stamped file strips stamp', () => {
    assert.strictEqual(testEffectivePrefix('enh-100-phase-runner-edge.test.cjs'), 'phase-runner-edge');
  });

  test('fix-stamped file strips stamp', () => {
    assert.strictEqual(testEffectivePrefix('fix-200-config-merge.test.cjs'), 'config-merge');
  });

  test('double-numbered stamp is stripped correctly', () => {
    assert.strictEqual(testEffectivePrefix('bug-2550-2552-discuss-phase-context.test.cjs'), 'discuss-phase-context');
  });
});

// ---------------------------------------------------------------------------
// CLI — JSON mode end-to-end
// ---------------------------------------------------------------------------

describe('CLI --json', () => {
  test('script parses without syntax errors', () => {
    const result = spawnSync(process.execPath, ['--check', LINT_SCRIPT], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  });

  test('exits 0 against real repo (allowlist covers all current violations)', () => {
    const { status, data } = runCliJson();
    assert.strictEqual(status, 0, `Expected clean run; failures: ${JSON.stringify(data.failures)}`);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.failures.length, 0);
  });

  test('--json output has required fields', () => {
    const { data } = runCliJson();
    assert.ok(Array.isArray(data.results), 'results must be array');
    assert.ok(Array.isArray(data.failures), 'failures must be array');
    assert.ok(Array.isArray(data.hints), 'hints must be array');
    assert.ok(typeof data.ok === 'boolean', 'ok must be boolean');
  });

  test('each result has verdict, prefix, count, ceiling, files', () => {
    const { data } = runCliJson();
    for (const r of data.results) {
      assert.ok(typeof r.verdict === 'string', `verdict missing on ${r.prefix}`);
      assert.ok(typeof r.prefix === 'string', 'prefix must be string');
      assert.ok(typeof r.count === 'number', 'count must be number');
      assert.ok(Array.isArray(r.files), 'files must be array');
    }
  });

  test('all verdicts are valid enum values', () => {
    const valid = new Set(Object.values(Verdict));
    const { data } = runCliJson();
    for (const r of data.results) {
      assert.ok(valid.has(r.verdict), `Unknown verdict "${r.verdict}" on prefix "${r.prefix}"`);
    }
  });
});
