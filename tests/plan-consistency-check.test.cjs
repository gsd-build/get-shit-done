// allow-test-rule: integration-roundtrip
//
// Locks that `gsd-sdk query plan.consistency-check` is dispatchable through
// the same CLI surface that the resume-work workflow calls. Closes #3212
// (Stage B — registration round-trip; classification correctness lives in
// the SDK Vitest suite at sdk/src/query/plan-consistency-check.test.ts).
//
// These tests do NOT re-test every classification branch — that would
// duplicate the SDK suite. They confirm:
//   1. The handler is registered (CLI can dispatch it).
//   2. The CLI returns valid JSON shaped like PlanConsistencyResult.
//   3. argv validation surfaces a non-zero exit / structured error.

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createTempGitProject, cleanup } = require('./helpers.cjs');

const GSD_SDK_BIN = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

function runSdk(args, cwd) {
  try {
    const result = execFileSync(process.execPath, [GSD_SDK_BIN, 'query', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GSD_QUERY_FALLBACK: 'off' },  // strict — must be native
    });
    return { success: true, output: result.trim() };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString().trim() || '',
      error: err.stderr?.toString().trim() || err.message,
      exitCode: err.status,
    };
  }
}

describe('plan.consistency-check is registered (#3212)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '04-feature'), { recursive: true });
  });

  afterEach(() => cleanup(tmpDir));

  test('CLI dispatches plan.consistency-check via dotted form', () => {
    const result = runSdk(['plan.consistency-check', '--phase', '4', '--plan', '03'], tmpDir);
    assert.ok(result.success, `dispatch failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '4', 'phase echoed');
    assert.strictEqual(parsed.plan, '03', 'plan echoed');
    assert.ok(typeof parsed.state === 'string', 'state is a string');
    assert.ok(typeof parsed.advice === 'string', 'advice is a string');
  });

  test('CLI dispatches plan.consistency-check via spaced form', () => {
    // The space-form alias is registered alongside the dotted form for
    // workflows that expand `gsd-sdk query plan consistency-check`.
    const result = runSdk(['plan', 'consistency-check', '--phase', '4', '--plan', '03'], tmpDir);
    assert.ok(result.success, `dispatch failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.phase, '4');
  });

  test('result shape carries all eight contract fields', () => {
    const result = runSdk(['plan.consistency-check', '--phase', '4', '--plan', '03'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    for (const field of [
      'phase', 'plan', 'state',
      'production_commits', 'summary_exists', 'state_advanced', 'roadmap_updated',
      'advice',
    ]) {
      assert.ok(field in parsed, `result must include field ${field}`);
    }
  });

  test('fresh project reports consistent_not_started', () => {
    const result = runSdk(['plan.consistency-check', '--phase', '99', '--plan', '99'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.state, 'consistent_not_started');
    assert.strictEqual(parsed.production_commits, 0);
    assert.strictEqual(parsed.summary_exists, false);
  });
});

describe('plan.consistency-check argv validation (#3212)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
  });

  afterEach(() => cleanup(tmpDir));

  test('missing --phase is rejected', () => {
    const result = runSdk(['plan.consistency-check', '--plan', '03'], tmpDir);
    assert.ok(!result.success, 'missing --phase must produce non-zero exit');
  });

  test('missing --plan is rejected', () => {
    const result = runSdk(['plan.consistency-check', '--phase', '4'], tmpDir);
    assert.ok(!result.success, 'missing --plan must produce non-zero exit');
  });
});
