// allow-test-rule: testing untested exports from worktree-safety.cjs
// These public functions had zero test coverage despite being exported.
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  reapOrphanWorktrees,
  listLinkedWorktreePaths,
} = require('../get-shit-done/bin/lib/worktree-safety.cjs');

// Helper: build a valid porcelain string with proper double-newline separators
function makePorcelain(...worktrees) {
  return worktrees
    .map(({ path, head, branch }) => {
      const lines = [`worktree ${path}`, `HEAD ${head}`];
      if (branch) lines.push(`branch refs/heads/${branch}`);
      return lines.join('\n');
    })
    .join('\n\n') + '\n';
}

describe('reapOrphanWorktrees', () => {
  test('returns empty array when rev-parse fails (not a git repo)', () => {
    const results = reapOrphanWorktrees('/not-a-repo', {
      execGit: () => ({ exitCode: 128, stdout: '', stderr: 'not a git repo' }),
      readDirSafe: () => null,
      isPidAlive: () => false,
      readDirSafe2: () => [],
      mtimeSafe: () => 0,
    });
    assert.deepStrictEqual(results, []);
  });

  test('returns empty array when worktrees admin dir cannot be read', () => {
    const results = reapOrphanWorktrees('/repo', {
      execGit: () => ({ exitCode: 0, stdout: '.git', stderr: '' }),
      readDirSafe: () => null,
      isPidAlive: () => false,
      readDirSafe2: () => [],
      mtimeSafe: () => 0,
    });
    assert.deepStrictEqual(results, []);
  });

  test('returns empty when remote exists but origin/HEAD is not set (fail-closed)', () => {
    // When a remote is configured but origin/HEAD is absent, the fail-closed
    // policy means we cannot safely determine the default branch — bail out.
    const execGitMock = (args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') return { exitCode: 0, stdout: '.git', stderr: '' };
      if (args[0] === 'remote') return { exitCode: 0, stdout: 'origin\n', stderr: '' };
      if (args[1] === '--quiet' && args[2] === 'refs/remotes/origin/HEAD') {
        return { exitCode: 1, stdout: '', stderr: 'ref not found' };
      }
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const results = reapOrphanWorktrees('/repo', {
      execGit: execGitMock,
      readDirSafe: () => ['worktree1'],
      isPidAlive: () => false,
      readDirSafe2: () => [],
      mtimeSafe: () => 0,
    });
    assert.deepStrictEqual(results, []);
  });

  test('returns empty when no candidate default branch exists locally', () => {
    const execGitMock = (args) => {
      if (args[0] === 'rev-parse' && args[1] === '--git-dir') return { exitCode: 0, stdout: '.git', stderr: '' };
      if (args[0] === 'remote') return { exitCode: 0, stdout: '', stderr: '' };
      if (args[0] === 'config') return { exitCode: 1, stdout: '', stderr: '' };
      if (args[0] === 'symbolic-ref') return { exitCode: 1, stdout: '', stderr: '' };
      return { exitCode: 1, stdout: '', stderr: '' };
    };
    const results = reapOrphanWorktrees('/repo', {
      execGit: execGitMock,
      readDirSafe: () => ['wt1'],
      isPidAlive: () => false,
      readDirSafe2: () => [],
      mtimeSafe: () => 0,
    });
    assert.deepStrictEqual(results, []);
  });
});

describe('listLinkedWorktreePaths', () => {
  test('returns ok:false when git worktree list fails', () => {
    const result = listLinkedWorktreePaths('/repo', {
      execGit: () => ({ exitCode: 128, stdout: '', stderr: 'fatal' }),
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.reason, 'git_list_failed');
  });

  test('returns ok:true with empty paths when no worktrees exist', () => {
    const result = listLinkedWorktreePaths('/repo', {
      execGit: () => ({ exitCode: 0, stdout: '', stderr: '' }),
    });
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.paths, []);
  });

  test('skips main worktree and returns only linked worktrees', () => {
    // git worktree list always includes the main worktree first.
    // The slice(1) in listLinkedWorktreePaths skips it.
    const porcelain = makePorcelain(
      { path: '/repo/main', head: 'abc123', branch: 'main' },
      { path: '/repo/feature-a', head: 'def456', branch: 'feature-a' },
      { path: '/repo/feature-b', head: 'ghi789', branch: 'feature-b' },
    );
    const result = listLinkedWorktreePaths('/repo', {
      execGit: () => ({ exitCode: 0, stdout: porcelain, stderr: '' }),
    });
    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.paths, ['/repo/feature-a', '/repo/feature-b']);
  });

  test('includes worktrees without a branch ref (detached HEAD) — known gap in listLinkedWorktreePaths', () => {
    // parseWorktreePorcelain filters detached entries (no branch line).
    // But listLinkedWorktreePaths -> parseWorktreeListPaths -> parseWorktreeEntries
    // does NOT filter them, so detached worktrees leak through.
    // This test documents the current (buggy) behavior.
    const porcelain = [
      'worktree /repo/main',
      'HEAD abc123',
      'branch refs/heads/main',
      '',
      'worktree /repo/detached',
      'HEAD deadbeef',
      'detached',
      '',
    ].join('\n') + '\n';
    const result = listLinkedWorktreePaths('/repo', {
      execGit: () => ({ exitCode: 0, stdout: porcelain, stderr: '' }),
    });
    assert.strictEqual(result.ok, true);
    // Current behavior: detached worktree is included (this is the bug)
    assert.deepStrictEqual(result.paths, ['/repo/detached']);
  });
});