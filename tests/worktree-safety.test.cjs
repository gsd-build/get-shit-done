'use strict';

/**
 * Worktree Safety Policy Module — typed IR tests
 *
 * Seam: get-shit-done/bin/lib/worktree-safety.cjs
 * Interface: resolveWorktreeContext, parseWorktreePorcelain, planWorktreePrune,
 *            executeWorktreePrunePlan, listLinkedWorktreePaths, inspectWorktreeHealth,
 *            snapshotWorktreeInventory, planWorktreeWaveCleanup,
 *            executeWorktreeWaveCleanupPlan
 *
 * Consolidated from:
 *   - tests/worktree-safety-policy.test.cjs (policy module unit tests)
 *   - tests/bug-3281-worktree-git-timeout.test.cjs (AC1–AC4: timeout/degraded-git)
 *   - tests/bug-3384-worktree-cleanup-manifest.test.cjs (manifest-scoped cleanup module)
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const WORKTREE_SAFETY_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'bin', 'lib', 'worktree-safety.cjs'
);

const {
  resolveWorktreeContext,
  parseWorktreePorcelain,
  planWorktreePrune,
  executeWorktreePrunePlan,
  listLinkedWorktreePaths,
  inspectWorktreeHealth,
  snapshotWorktreeInventory,
  planWorktreeWaveCleanup,
  executeWorktreeWaveCleanupPlan,
} = require(WORKTREE_SAFETY_PATH);

const isWindows = process.platform === 'win32';

// ─── Shared stubs ─────────────────────────────────────────────────────────────

/**
 * Returns an execGit stub that simulates what spawnSync returns when the
 * subprocess is killed by SIGTERM after exceeding its timeout.
 * Per Node.js docs: result.status === null, result.signal === 'SIGTERM',
 * result.error?.code === 'ETIMEDOUT'.
 *
 * The production execGit implementation must detect this shape and:
 *   - return { ..., timedOut: true } so callers can distinguish timeout from auth failure
 *   - not throw
 */
function makeTimeoutStub() {
  return function stubTimedOutExecGit(_args, _opts) {
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

// ─── resolveWorktreeContext ───────────────────────────────────────────────────

describe('resolveWorktreeContext', () => {
  test('prefers current directory when .planning exists', () => {
    const context = resolveWorktreeContext('/repo/wt', {
      existsSync: () => true,
      execGit: () => ({ exitCode: 1, stdout: '', stderr: '' }),
    });
    assert.strictEqual(context.effectiveRoot, '/repo/wt');
    assert.strictEqual(context.reason, 'has_local_planning');
    assert.strictEqual(context.mode, 'current_directory');
  });

  test('maps linked worktree to common-dir parent',
    { skip: isWindows ? 'POSIX-rooted fixture paths cannot be expressed on Windows path.resolve' : false },
    () => {
    const context = resolveWorktreeContext('/repo/wt', {
      existsSync: () => false,
      execGit: (args) => {
        if (args[1] === '--git-dir') return { exitCode: 0, stdout: '.git/worktrees/wt', stderr: '' };
        if (args[1] === '--git-common-dir') return { exitCode: 0, stdout: '../.git', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: '' };
      },
    });
    assert.strictEqual(context.effectiveRoot, '/repo');
    assert.strictEqual(context.reason, 'linked_worktree');
    assert.strictEqual(context.mode, 'linked_worktree_root');
  });

  test('falls back when git metadata is unavailable', () => {
    const context = resolveWorktreeContext('/repo/wt', {
      existsSync: () => false,
      execGit: () => ({ exitCode: 1, stdout: '', stderr: '' }),
    });
    assert.strictEqual(context.effectiveRoot, '/repo/wt');
    assert.strictEqual(context.reason, 'not_git_repo');
  });

  test('keeps cwd for main worktree checkout', () => {
    const context = resolveWorktreeContext('/repo/main', {
      existsSync: () => false,
      execGit: (args) => {
        if (args[1] === '--git-dir') return { exitCode: 0, stdout: '.git', stderr: '' };
        if (args[1] === '--git-common-dir') return { exitCode: 0, stdout: '.git', stderr: '' };
        return { exitCode: 1, stdout: '', stderr: '' };
      },
    });
    assert.strictEqual(context.effectiveRoot, '/repo/main');
    assert.strictEqual(context.reason, 'main_worktree');
    assert.strictEqual(context.mode, 'current_directory');
  });

  // Counter-test: timeout returns object with effectiveRoot (Contract 6)
  test('returns valid result on timeout, not throw', () => {
    let threw = false;
    let result;
    try {
      result = resolveWorktreeContext('/tmp', { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.ok(
      typeof result.effectiveRoot === 'string',
      'must return effectiveRoot string even on timeout'
    );
  });
});

// ─── parseWorktreePorcelain ───────────────────────────────────────────────────

describe('parseWorktreePorcelain', () => {
  test('skips detached HEAD entries', () => {
    const porcelain = [
      'worktree /repo/main',
      'HEAD deadbeef',
      'branch refs/heads/main',
      '',
      'worktree /repo/wt-detached',
      'HEAD cafe1234',
      'detached',
      '',
      'worktree /repo/wt-feature',
      'HEAD f00dbabe',
      'branch refs/heads/feature-x',
      '',
    ].join('\n');
    const parsed = parseWorktreePorcelain(porcelain);
    assert.deepStrictEqual(parsed, [
      { path: '/repo/main', branch: 'main' },
      { path: '/repo/wt-feature', branch: 'feature-x' },
    ]);
  });
});

// ─── planWorktreePrune ────────────────────────────────────────────────────────

describe('planWorktreePrune', () => {
  test('is non-destructive by default', () => {
    const plan = planWorktreePrune('/repo/main', {}, {
      execGit: () => ({ exitCode: 0, stdout: 'worktree /repo/main\nbranch refs/heads/main\n', stderr: '' }),
      parseWorktreePorcelain: () => [{ path: '/repo/main', branch: 'main' }],
    });
    assert.strictEqual(plan.action, 'metadata_prune_only');
    assert.strictEqual(plan.reason, 'worktrees_present');
    assert.strictEqual(plan.destructiveModeRequested, false);
  });

  test('keeps metadata-prune action when destructive mode is requested (scaffold)', () => {
    const plan = planWorktreePrune('/repo/main', { allowDestructive: true }, {
      execGit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
      parseWorktreePorcelain: () => [],
    });
    assert.strictEqual(plan.action, 'metadata_prune_only');
    assert.strictEqual(plan.reason, 'no_worktrees');
    assert.strictEqual(plan.destructiveModeRequested, true);
  });

  test('skips when git worktree list fails', () => {
    const plan = planWorktreePrune('/repo/main', {}, {
      execGit: () => ({ exitCode: 2, stdout: '', stderr: 'fatal' }),
    });
    assert.strictEqual(plan.action, 'skip');
    assert.strictEqual(plan.reason, 'git_list_failed');
  });

  test('still metadata-prunes when porcelain parser throws', () => {
    const plan = planWorktreePrune('/repo/main', {}, {
      execGit: () => ({ exitCode: 0, stdout: 'not-porcelain', stderr: '' }),
      parseWorktreePorcelain: () => {
        throw new Error('parse failed');
      },
    });
    assert.strictEqual(plan.action, 'metadata_prune_only');
    assert.strictEqual(plan.reason, 'no_worktrees');
  });

  // Counter-test: timeout path (Contract 6)
  test('returns action=skip when execGit times out', () => {
    let threw = false;
    let result;
    try {
      result = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.action, 'skip');
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'must return a non-empty reason when git times out'
    );
  });

  // AC4 strict: must use specific reason string 'git_timed_out'
  test('reason is git_timed_out (not generic git_list_failed) on timeout', () => {
    const result = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
    assert.strictEqual(
      result.reason,
      'git_timed_out',
      'must use reason=git_timed_out when execGit returns timedOut:true — not the generic git_list_failed'
    );
  });
});

// ─── executeWorktreePrunePlan ─────────────────────────────────────────────────

describe('executeWorktreePrunePlan', () => {
  test('runs git worktree prune for metadata plan', () => {
    const calls = [];
    const result = executeWorktreePrunePlan(
      { repoRoot: '/repo/main', action: 'metadata_prune_only', reason: 'worktrees_present' },
      {
        execGit: (args, opts) => {
          calls.push({ cwd: opts.cwd, args });
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }
    );
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(calls, [{ cwd: '/repo/main', args: ['worktree', 'prune'] }]);
  });

  test('returns skip for missing plan', () => {
    const result = executeWorktreePrunePlan(null, {
      execGit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.action, 'skip');
    assert.strictEqual(result.reason, 'missing_plan');
  });

  test('returns skip plan unchanged without git call', () => {
    let called = false;
    const result = executeWorktreePrunePlan(
      { repoRoot: '/repo/main', action: 'skip', reason: 'git_list_failed' },
      {
        execGit: () => {
          called = true;
          return { exitCode: 0, stdout: '', stderr: '' };
        },
      }
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.action, 'skip');
    assert.strictEqual(result.reason, 'git_list_failed');
    assert.strictEqual(called, false);
  });

  test('rejects unsupported actions', () => {
    const result = executeWorktreePrunePlan(
      { repoRoot: '/repo/main', action: 'remove_missing_paths', reason: 'explicit' },
      {
        execGit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
      }
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.action, 'remove_missing_paths');
    assert.strictEqual(result.reason, 'unsupported_action');
  });

  // Counter-test: timeout path (Contract 6)
  test('returns ok:false when plan is skip (timeout path)', () => {
    const plan = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
    const result = executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.ok, false, 'must return ok:false on timeout');
  });

  // AC4 strict: timedOut must be surfaced as a first-class field
  test('result.timedOut is true when prune git call times out', () => {
    const plan = {
      repoRoot: '/tmp',
      action: 'metadata_prune_only',
      reason: 'no_worktrees',
      destructiveModeRequested: false,
    };
    const result = executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(
      result.timedOut,
      true,
      'must include timedOut:true in result when the execGit call returns timedOut:true'
    );
  });
});

// ─── listLinkedWorktreePaths ──────────────────────────────────────────────────

describe('listLinkedWorktreePaths', () => {
  test('parses porcelain and skips first/main path', () => {
    const listed = listLinkedWorktreePaths('/repo/main', {
      execGit: () => ({
        exitCode: 0,
        stdout: [
          'worktree /repo/main',
          'HEAD aaa',
          'branch refs/heads/main',
          '',
          'worktree /repo/wt-a',
          'HEAD bbb',
          'branch refs/heads/feat-a',
          '',
          'worktree /repo/wt-b',
          'HEAD ccc',
          'detached',
          '',
        ].join('\n'),
        stderr: '',
      }),
    });
    assert.strictEqual(listed.ok, true);
    assert.deepStrictEqual(listed.paths, ['/repo/wt-a', '/repo/wt-b']);
  });

  // Counter-test: failure path (Contract 6)
  test('returns ok:false on timeout, not throw', () => {
    let threw = false;
    let result;
    try {
      result = listLinkedWorktreePaths('/tmp', { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'must not throw on timeout');
    assert.strictEqual(result.ok, false);
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'must return non-empty reason on timeout'
    );
  });

  test('reason is git_timed_out on timeout', () => {
    const result = listLinkedWorktreePaths('/tmp', { execGit: makeTimeoutStub() });
    assert.strictEqual(
      result.reason,
      'git_timed_out',
      'must use reason=git_timed_out when execGit returns timedOut:true'
    );
  });
});

// ─── inspectWorktreeHealth ────────────────────────────────────────────────────

describe('inspectWorktreeHealth', () => {
  test('reports orphan and stale findings', () => {
    const health = inspectWorktreeHealth(
      '/repo/main',
      { staleAfterMs: 60 * 60 * 1000, nowMs: 2 * 60 * 60 * 1000 },
      {
        execGit: () => ({
          exitCode: 0,
          stdout: [
            'worktree /repo/main',
            'HEAD aaa',
            'branch refs/heads/main',
            '',
            'worktree /repo/wt-orphan',
            'HEAD bbb',
            'branch refs/heads/feat-a',
            '',
            'worktree /repo/wt-stale',
            'HEAD ccc',
            'branch refs/heads/feat-b',
            '',
          ].join('\n'),
          stderr: '',
        }),
        existsSync: p => p !== '/repo/wt-orphan',
        statSync: () => ({ mtimeMs: 0 }),
      }
    );
    assert.strictEqual(health.ok, true);
    assert.deepStrictEqual(health.findings, [
      { kind: 'orphan', path: '/repo/wt-orphan' },
      { kind: 'stale', path: '/repo/wt-stale', ageMinutes: 120 },
    ]);
  });

  // Counter-test: timeout path (Contract 6)
  test('returns ok:false when git times out', () => {
    let threw = false;
    let result;
    try {
      result = inspectWorktreeHealth('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.ok, false);
  });

  test('findings is empty array (not undefined) on timeout', () => {
    const result = inspectWorktreeHealth('/tmp', {}, { execGit: makeTimeoutStub() });
    assert.strictEqual(Array.isArray(result.findings), true, 'findings must be an array even when ok:false');
  });
});

// ─── snapshotWorktreeInventory ────────────────────────────────────────────────

describe('snapshotWorktreeInventory', () => {
  test('returns typed linked-worktree entries', () => {
    const inventory = snapshotWorktreeInventory(
      '/repo/main',
      { staleAfterMs: 60 * 60 * 1000, nowMs: 2 * 60 * 60 * 1000 },
      {
        execGit: () => ({
          exitCode: 0,
          stdout: [
            'worktree /repo/main',
            'HEAD aaa',
            'branch refs/heads/main',
            '',
            'worktree /repo/wt-a',
            'HEAD bbb',
            'branch refs/heads/feat-a',
            '',
            'worktree /repo/wt-b',
            'HEAD ccc',
            'branch refs/heads/feat-b',
            '',
          ].join('\n'),
          stderr: '',
        }),
        existsSync: p => p !== '/repo/wt-b',
        statSync: () => ({ mtimeMs: 0 }),
      }
    );
    assert.strictEqual(inventory.ok, true);
    assert.deepStrictEqual(inventory.entries, [
      { path: '/repo/wt-a', exists: true, isStale: true, ageMinutes: 120 },
      { path: '/repo/wt-b', exists: false, isStale: false, ageMinutes: null },
    ]);
  });

  // Counter-test: timeout path (Contract 6)
  test('returns ok:false with reason on timeout, not throw', () => {
    let threw = false;
    let result;
    try {
      result = snapshotWorktreeInventory('/tmp', {}, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'must not throw on timeout');
    assert.strictEqual(typeof result, 'object');
    assert.strictEqual(result.ok, false);
    assert.ok(
      typeof result.reason === 'string' && result.reason.length > 0,
      'must return non-empty reason on timeout'
    );
  });

  test('reason is git_timed_out on timeout', () => {
    const result = snapshotWorktreeInventory('/tmp', {}, { execGit: makeTimeoutStub() });
    assert.strictEqual(
      result.reason,
      'git_timed_out',
      'must use reason=git_timed_out when execGit returns timedOut:true'
    );
  });
});

// ─── Degraded-git prune flow (AC3) ───────────────────────────────────────────

describe('prune flow under degraded git', () => {
  test('full prune flow (plan -> execute) completes without throwing on timeout', () => {
    let threw = false;
    try {
      const plan = planWorktreePrune('/tmp', {}, { execGit: makeTimeoutStub() });
      executeWorktreePrunePlan(plan, { execGit: makeTimeoutStub() });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, false, 'full prune flow must not throw on timeout — must degrade gracefully');
  });
});

// ─── planWorktreeWaveCleanup ──────────────────────────────────────────────────

describe('planWorktreeWaveCleanup', () => {
  test('includes only manifest entries and never discovers global agent worktrees', () => {
    const plan = planWorktreeWaveCleanup('/repo/main', {
      worktrees: [
        {
          agent_id: 'a1',
          worktree_path: '/repo/.claude/worktrees/agent-a1',
          branch: 'worktree-agent-a1',
          expected_base: 'abc123',
        },
      ],
    });
    assert.equal(plan.ok, true);
    assert.deepEqual(plan.entries.map((entry) => ({
      agent_id: entry.agent_id,
      worktree_path: entry.worktree_path,
      branch: entry.branch,
      expected_base: entry.expected_base,
    })), [{
      agent_id: 'a1',
      worktree_path: '/repo/.claude/worktrees/agent-a1',
      branch: 'worktree-agent-a1',
      expected_base: 'abc123',
    }]);
    assert.equal(plan.discovery, 'manifest');
  });

  // Counter-test: invalid entries rejected (Contract 6)
  test('rejects entries without expected base or disposable branch namespace', () => {
    const plan = planWorktreeWaveCleanup('/repo/main', {
      worktrees: [
        {
          agent_id: 'missing-base',
          worktree_path: '/repo/.claude/worktrees/agent-missing-base',
          branch: 'worktree-agent-missing-base',
        },
        {
          agent_id: 'feature-branch',
          worktree_path: '/repo/.claude/worktrees/agent-feature',
          branch: 'feature/user-work',
          expected_base: 'abc123',
        },
      ],
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.reason, 'empty_manifest');
    assert.deepEqual(plan.entries, []);
  });
});

// ─── executeWorktreeWaveCleanupPlan ───────────────────────────────────────────

describe('executeWorktreeWaveCleanupPlan', () => {
  test('does not delete a branch when worktree removal fails', () => {
    const calls = [];
    const plan = {
      ok: true,
      repoRoot: '/repo/main',
      action: 'cleanup_wave',
      discovery: 'manifest',
      entries: [{
        agent_id: 'a1',
        worktree_path: '/repo/.claude/worktrees/agent-a1',
        branch: 'worktree-agent-a1',
        expected_base: 'abc123',
      }],
    };
    const result = executeWorktreeWaveCleanupPlan(plan, {
      execGit: (args, opts) => {
        calls.push({ cwd: opts && opts.cwd, args });
        const key = args.join(' ');
        if (key === '-C /repo/.claude/worktrees/agent-a1 rev-parse --abbrev-ref HEAD') {
          return { exitCode: 0, stdout: 'worktree-agent-a1', stderr: '' };
        }
        if (key === 'merge-base HEAD worktree-agent-a1') {
          return { exitCode: 0, stdout: 'abc123', stderr: '' };
        }
        if (key === 'diff --diff-filter=D --name-only HEAD...worktree-agent-a1') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (key.startsWith('merge worktree-agent-a1')) {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (key === 'worktree remove /repo/.claude/worktrees/agent-a1 --force') {
          return { exitCode: 1, stdout: '', stderr: 'locked' };
        }
        if (key === 'branch -D worktree-agent-a1') {
          throw new Error('branch deletion must not run after remove failure');
        }
        return { exitCode: 0, stdout: '', stderr: '' };
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.entries[0].status, 'blocked');
    assert.equal(result.entries[0].reason, 'worktree_remove_failed');
    assert.equal(calls.some((call) => call.args.join(' ') === 'branch -D worktree-agent-a1'), false);
  });

  test('stops on merge conflict and records remaining manifest entries', () => {
    const plan = {
      ok: true,
      repoRoot: '/repo/main',
      action: 'cleanup_wave',
      discovery: 'manifest',
      entries: [
        {
          agent_id: 'a1',
          worktree_path: '/repo/.claude/worktrees/agent-a1',
          branch: 'worktree-agent-a1',
          expected_base: 'abc123',
        },
        {
          agent_id: 'a2',
          worktree_path: '/repo/.claude/worktrees/agent-a2',
          branch: 'worktree-agent-a2',
          expected_base: 'abc123',
        },
      ],
    };
    const result = executeWorktreeWaveCleanupPlan(plan, {
      execGit: (args) => {
        const key = args.join(' ');
        if (key === '-C /repo/.claude/worktrees/agent-a1 rev-parse --abbrev-ref HEAD') {
          return { exitCode: 0, stdout: 'worktree-agent-a1', stderr: '' };
        }
        if (key === 'merge-base HEAD worktree-agent-a1') {
          return { exitCode: 0, stdout: 'abc123', stderr: '' };
        }
        if (key === 'diff --diff-filter=D --name-only HEAD...worktree-agent-a1') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (key === '-C /repo/.claude/worktrees/agent-a1 status --porcelain --untracked-files=all') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (key.startsWith('merge worktree-agent-a1')) {
          return { exitCode: 1, stdout: '', stderr: 'CONFLICT' };
        }
        throw new Error(`unexpected git call after conflict: ${key}`);
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.entries[0].status, 'blocked');
    assert.equal(result.entries[0].reason, 'merge_failed');
    assert.deepEqual(result.pending.map((entry) => entry.branch), ['worktree-agent-a2']);
  });

  test('blocks dirty worktrees before merge/remove/delete', () => {
    const calls = [];
    const plan = {
      ok: true,
      repoRoot: '/repo/main',
      action: 'cleanup_wave',
      discovery: 'manifest',
      entries: [{
        agent_id: 'a1',
        worktree_path: '/repo/.claude/worktrees/agent-a1',
        branch: 'worktree-agent-a1',
        expected_base: 'abc123',
      }],
    };
    const result = executeWorktreeWaveCleanupPlan(plan, {
      execGit: (args) => {
        calls.push(args.join(' '));
        const key = args.join(' ');
        if (key === '-C /repo/.claude/worktrees/agent-a1 rev-parse --abbrev-ref HEAD') {
          return { exitCode: 0, stdout: 'worktree-agent-a1', stderr: '' };
        }
        if (key === 'merge-base HEAD worktree-agent-a1') {
          return { exitCode: 0, stdout: 'abc123', stderr: '' };
        }
        if (key === 'diff --diff-filter=D --name-only HEAD...worktree-agent-a1') {
          return { exitCode: 0, stdout: '', stderr: '' };
        }
        if (key === '-C /repo/.claude/worktrees/agent-a1 status --porcelain --untracked-files=all') {
          return { exitCode: 0, stdout: '?? scratch.txt', stderr: '' };
        }
        throw new Error(`unexpected git call after dirty check: ${key}`);
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.entries[0].reason, 'worktree_dirty');
    assert.equal(calls.some((call) => call.startsWith('merge worktree-agent-a1')), false);
    assert.equal(calls.some((call) => call === 'worktree remove /repo/.claude/worktrees/agent-a1 --force'), false);
    assert.equal(calls.some((call) => call === 'branch -D worktree-agent-a1'), false);
  });
});
