// allow-test-rule: integration-roundtrip
//
// Locks that `gsd-sdk query dispatch.commit-since` is dispatchable through
// the same CLI surface that orchestrator workflows would call. Closes #3212
// (Stage C — registration round-trip). Probe correctness lives in the SDK
// Vitest suite at sdk/src/query/dispatch-surveillance.test.ts.

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
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

describe('dispatch.commit-since is registered (#3212)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
  });

  afterEach(() => cleanup(tmpDir));

  test('CLI dispatches dispatch.commit-since via dotted form', () => {
    const result = runSdk(['dispatch.commit-since', '--since', '0'], tmpDir);
    assert.ok(result.success, `dispatch failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.ok('count' in parsed, 'result must include count');
    assert.ok('latest_hash' in parsed, 'result must include latest_hash');
    assert.ok('since_unix' in parsed, 'result must include since_unix');
    assert.strictEqual(parsed.since_unix, 0);
  });

  test('CLI dispatches dispatch.commit-since via spaced form', () => {
    const result = runSdk(['dispatch', 'commit-since', '--since', '0'], tmpDir);
    assert.ok(result.success, `dispatch failed: ${result.error}`);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.since_unix, 0);
  });

  test('result shape carries all six contract fields', () => {
    const result = runSdk(['dispatch.commit-since', '--since', '0'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    for (const field of [
      'count', 'latest_hash', 'latest_subject', 'latest_timestamp_unix',
      'since_unix', 'plan_filter',
    ]) {
      assert.ok(field in parsed, `result must include field ${field}`);
    }
  });

  test('plan_filter is echoed when provided', () => {
    const result = runSdk(['dispatch.commit-since', '--since', '0', '--plan', '4-03'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    assert.strictEqual(parsed.plan_filter, '4-03');
  });

  test('count >= 1 in temp git project (which has the helper-init commit)', () => {
    const result = runSdk(['dispatch.commit-since', '--since', '0'], tmpDir);
    assert.ok(result.success, result.error);
    const parsed = JSON.parse(result.output);
    // createTempGitProject() always lands one initial commit, so any
    // --since value low enough to include 'now' (e.g. 0) must see ≥ 1
    // commit. This locks the round-trip end-to-end.
    assert.ok(parsed.count >= 1,
      `expected at least 1 commit since epoch 0 in tmp project, got count=${parsed.count}`);
  });
});

describe('dispatch.commit-since argv validation (#3212)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempGitProject();
  });

  afterEach(() => cleanup(tmpDir));

  test('missing --since is rejected', () => {
    const result = runSdk(['dispatch.commit-since'], tmpDir);
    assert.ok(!result.success, 'missing --since must produce non-zero exit');
  });

  test('non-numeric --since is rejected', () => {
    const result = runSdk(['dispatch.commit-since', '--since', 'yesterday'], tmpDir);
    assert.ok(!result.success, 'non-numeric --since must produce non-zero exit');
  });
});
