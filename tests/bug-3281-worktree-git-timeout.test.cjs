/**
 * Regression tests for #3281:
 * Worktree health paths can hang indefinitely due to unbounded git subprocess calls.
 *
 * Acceptance criteria:
 *   AC1 — Worktree git subprocess calls use bounded execution (timeout + deterministic failure).
 *   AC2 — Timeout/failure outcomes produce structured non-fatal warning signals.
 *   AC3 — validate health and init progress remain non-crashing when git is unavailable/stalled,
 *          but report degraded worktree health-check status.
 *   AC4 — Regression tests cover timeout/degraded-git behavior for worktree safety checks.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// ─── Module paths ─────────────────────────────────────────────────────────────

const WORKTREE_SAFETY_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'bin', 'lib', 'worktree-safety.cjs'
);

// ─── Shared timeout stub ──────────────────────────────────────────────────────

/**
 * Returns an execGit stub that simulates what spawnSync returns when the
 * subprocess is killed by SIGTERM after exceeding its timeout option.
 * Per Node.js docs: result.status === null, result.signal === 'SIGTERM',
 * result.error?.code === 'ETIMEDOUT'.
 *
 * The production execGit implementation must detect this shape and:
 *   - return { ..., timedOut: true } so callers can distinguish timeout from auth failure
 *   - not throw
 */
function makeTimeoutStub() {
  return function stubTimedOutExecGit(_cwd, _args) {
    return {
      exitCode: null,
      stdout: '',
      stderr: '',
      timedOut: true,
      signal: 'SIGTERM',
      error: Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT' }),
    };
  };
}

// ─── AC1 / AC4: degraded health via exported functions ───────────────────────

describe('bug-3281 AC1: worktree functions return degraded-ok on timeout, not throw', () => {
  test('planWorktreePrune returns action=skip when execGit times out', () => {
    const { planWorktreePrune } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    let result;
    try {
      result = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'planWorktreePrune must not throw on timeout');
    assert.strictEqual(typeof result, 'object', 'planWorktreePrune must return an object');
    assert.strictEqual(result.action, 'skip', 'planWorktreePrune must return action=skip when git times out');
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'planWorktreePrune must return a non-empty reason when git times out'
    );
  });

  test('executeWorktreePrunePlan returns ok:false when plan is skip (timeout path)', () => {
    const { planWorktreePrune, executeWorktreePrunePlan } = require(WORKTREE_SAFETY_PATH);

    const plan = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
    const result = executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });

    assert.strictEqual(typeof result, 'object', 'executeWorktreePrunePlan must return an object');
    assert.strictEqual(result.ok, false, 'executeWorktreePrunePlan must return ok:false on timeout');
  });

  test('inspectWorktreeHealth returns ok:false when git times out', () => {
    const { inspectWorktreeHealth } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    let result;
    try {
      result = inspectWorktreeHealth('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'inspectWorktreeHealth must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.ok, false, 'inspectWorktreeHealth must return ok:false on timeout');
  });

  test('listLinkedWorktreePaths returns ok:false on timeout, not throw', () => {
    const { listLinkedWorktreePaths } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    let result;
    try {
      result = listLinkedWorktreePaths('/tmp', { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'listLinkedWorktreePaths must not throw on timeout');
    assert.strictEqual(result.ok, false, 'listLinkedWorktreePaths must return ok:false on timeout');
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'listLinkedWorktreePaths must return non-empty reason on timeout'
    );
  });

  test('snapshotWorktreeInventory returns ok:false with reason on timeout, not throw', () => {
    const { snapshotWorktreeInventory } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    let result;
    try {
      result = snapshotWorktreeInventory('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'snapshotWorktreeInventory must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.ok, false, 'snapshotWorktreeInventory must return ok:false on timeout');
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'snapshotWorktreeInventory must return non-empty reason on timeout'
    );
  });

  test('resolveWorktreeContext returns a valid result on timeout, not throw', () => {
    const { resolveWorktreeContext } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    let result;
    try {
      result = resolveWorktreeContext('/tmp', { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'resolveWorktreeContext must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.ok(
      typeof result.effectiveRoot === 'string',
      'resolveWorktreeContext must return effectiveRoot string even on timeout'
    );
  });
});

// ─── AC2 / AC4: timedOut is a first-class field in results ───────────────────

describe('bug-3281 AC2+AC4: timedOut is a first-class field in results', () => {
  test('planWorktreePrune reason is git_timed_out when execGit returns timedOut:true', () => {
    const { planWorktreePrune } = require(WORKTREE_SAFETY_PATH);

    const result = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });

    // AC4 strict: must use the specific reason string 'git_timed_out'
    // (not the generic 'git_list_failed') to distinguish timeout from auth failure
    assert.strictEqual(
      result.reason,
      'git_timed_out',
      [
        'AC4 (strict): planWorktreePrune must use reason=git_timed_out',
        'when execGit returns timedOut:true — not the generic git_list_failed',
      ].join(' ')
    );
  });

  test('listLinkedWorktreePaths reason is git_timed_out when execGit returns timedOut:true', () => {
    const { listLinkedWorktreePaths } = require(WORKTREE_SAFETY_PATH);

    const result = listLinkedWorktreePaths('/tmp', { execGit: makeTimeoutStub() });

    assert.strictEqual(
      result.reason,
      'git_timed_out',
      [
        'AC4 (strict): listLinkedWorktreePaths must use reason=git_timed_out',
        'when execGit returns timedOut:true',
      ].join(' ')
    );
  });

  test('executeWorktreePrunePlan result.timedOut is true when prune git call times out', () => {
    const { executeWorktreePrunePlan } = require(WORKTREE_SAFETY_PATH);

    // Use a plan that bypasses readWorktreeList (action=metadata_prune_only)
    // so the prune execGit call itself can time out
    const plan = {
      repoRoot: '/tmp',
      action: 'metadata_prune_only',
      reason: 'no_worktrees',
      destructiveModeRequested: false,
    };

    const result = executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });

    assert.strictEqual(result.ok, false, 'executeWorktreePrunePlan must return ok:false when prune times out');

    // AC4 strict: timedOut must be surfaced as a first-class field
    assert.strictEqual(
      result.timedOut,
      true,
      [
        'AC4 (strict): executeWorktreePrunePlan must include timedOut:true in result',
        'when the execGit call returns timedOut:true',
      ].join(' ')
    );
  });

  test('snapshotWorktreeInventory reason is git_timed_out on timeout', () => {
    const { snapshotWorktreeInventory } = require(WORKTREE_SAFETY_PATH);

    const result = snapshotWorktreeInventory('/tmp', {}, { execGit: makeTimeoutStub() });

    assert.strictEqual(
      result.reason,
      'git_timed_out',
      [
        'AC4 (strict): snapshotWorktreeInventory must use reason=git_timed_out',
        'when execGit returns timedOut:true',
      ].join(' ')
    );
  });
});

// ─── AC3: non-crashing under degraded git — worktree prune flow ───────────────

describe('bug-3281 AC3: worktree prune flow is non-crashing under degraded git', () => {
  test('full prune flow (plan -> execute) completes without throwing on timeout', () => {
    const { planWorktreePrune, executeWorktreePrunePlan } = require(WORKTREE_SAFETY_PATH);

    let threw = false;
    try {
      const plan = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
      executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'full prune flow must not throw on timeout — must degrade gracefully');
  });

  test('inspectWorktreeHealth findings is empty array (not undefined) on timeout', () => {
    const { inspectWorktreeHealth } = require(WORKTREE_SAFETY_PATH);

    const result = inspectWorktreeHealth('/tmp', {}, { execGit: makeTimeoutStub() });

    // ok:false is expected — but findings must still be an array (not undefined)
    // so callers that iterate findings do not crash
    assert.strictEqual(Array.isArray(result.findings), true, 'findings must be an array even when ok:false');
  });
});
