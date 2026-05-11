// allow-test-rule: source-text-is-the-product
// Workflow markdown is the installed orchestration contract, and the CJS policy
// module is the callable safety seam for worktree cleanup.

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  planWorktreeWaveCleanup,
  executeWorktreeWaveCleanupPlan,
} = require('../get-shit-done/bin/lib/worktree-safety.cjs');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

function readWorkflow(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('bug #3384: worktree cleanup is manifest-scoped and fail-closed', () => {
  test('cleanup plan includes only manifest entries and never discovers global agent worktrees', () => {
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

  test('cleanup plan rejects entries without expected base or disposable branch namespace', () => {
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

  test('cleanup executor does not delete a branch when worktree removal fails', () => {
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
      execGit: (cwd, args) => {
        calls.push({ cwd, args });
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

  test('cleanup executor stops on merge conflict and records remaining manifest entries', () => {
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
      execGit: (_cwd, args) => {
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

  test('cleanup executor blocks dirty worktrees before merge/remove/delete', () => {
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
      execGit: (_cwd, args) => {
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

  test('execute-phase contract requires a cleanup manifest instead of global worktree discovery', () => {
    const content = readWorkflow(EXECUTE_PHASE_PATH);
    assert.match(content, /WAVE_WORKTREE_MANIFEST/);
    assert.match(content, /worktree\.cleanup-wave/);
    assert.match(content, /atomically append `\{agent_id, worktree_path, branch, expected_base\}`/);
    assert.match(content, /try\{if\(!p\)throw new Error\("WAVE_WORKTREE_MANIFEST is unset"\)/);
    assert.match(content, /WT_PATHS_FILE=.*gsd-worktree-paths-/);
    assert.doesNotMatch(content, /done < <\(node -e 'const fs=require\("fs"\);const p=process\.env\.WAVE_WORKTREE_MANIFEST/);
    assert.doesNotMatch(content, /done < <\(git worktree list --porcelain \| grep "\^worktree " \| grep "\\\.claude\/worktrees\/agent-"/);
  });

  test('quick contract requires a cleanup manifest instead of global worktree discovery', () => {
    const content = readWorkflow(QUICK_PATH);
    assert.match(content, /WAVE_WORKTREE_MANIFEST|QUICK_WORKTREE_MANIFEST/);
    assert.match(content, /worktree\.cleanup-wave/);
    assert.match(content, /mktemp "\$\{TMPDIR:-\/tmp\}\/gsd-quick-worktree-/);
    assert.match(content, /append its returned `\{agent_id, worktree_path, branch, expected_base\}`/);
    assert.match(content, /try\{if\(!p\)throw new Error\("QUICK_WORKTREE_MANIFEST is unset"\)/);
    assert.match(content, /WT_PATHS_FILE=.*gsd-worktree-paths-/);
    assert.doesNotMatch(content, /done < <\(node -e 'const fs=require\("fs"\);const p=process\.env\.QUICK_WORKTREE_MANIFEST/);
    assert.doesNotMatch(content, /done < <\(git worktree list --porcelain \| grep "\^worktree " \| grep "\\\.claude\/worktrees\/agent-"/);
  });
});
