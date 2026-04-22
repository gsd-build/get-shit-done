/**
 * Tests for pruneOrphanedWorktrees()
 *
 * Uses real temporary git repos (no mocks).
 * All 4 tests must fail (RED) before implementation is added.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { createTempDir, cleanup } = require('./helpers.cjs');

// Lazy-loaded so tests can fail clearly when the export doesn't exist yet.
function getPruneOrphanedWorktrees() {
  const { pruneOrphanedWorktrees } = require('../get-shit-done/bin/lib/core.cjs');
  return pruneOrphanedWorktrees;
}

// Create a minimal git repo with an initial commit on main.
function createGitRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Test\n');
  execSync('git add -A', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "initial commit"', { cwd: dir, stdio: 'pipe' });
  // Rename to main if it isn't already (handles older git defaults)
  try {
    execSync('git branch -m master main', { cwd: dir, stdio: 'pipe' });
  } catch { /* already named main */ }
}

// --- Test suite ---------------------------------------------------------------

describe('pruneOrphanedWorktrees', () => {
  let tmpBase;

  beforeEach(() => {
    tmpBase = createTempDir('prune-wt-test-');
  });

  afterEach(() => {
    cleanup(tmpBase);
  });

  // Test 1: removes a worktree whose branch is merged into main
  test('removes a worktree whose branch is merged into main', () => {
    const repoDir = path.join(tmpBase, 'repo');
    const worktreeDir = path.join(tmpBase, 'wt-merged');

    createGitRepo(repoDir);

    // Create worktree on a new branch (main is checked out in repoDir)
    execSync('git worktree add "' + worktreeDir + '" -b fix/old-work', { cwd: repoDir, stdio: 'pipe' });
    assert.ok(fs.existsSync(worktreeDir), 'worktree dir should exist before prune');

    // Add a commit in the worktree
    fs.writeFileSync(path.join(worktreeDir, 'feature.txt'), 'work\n');
    execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });
    execSync('git commit -m "old work"', { cwd: worktreeDir, stdio: 'pipe' });

    // Merge the branch into main from repoDir
    execSync('git merge fix/old-work --no-ff -m "merge old-work"', { cwd: repoDir, stdio: 'pipe' });

    // Act
    const pruneOrphanedWorktrees = getPruneOrphanedWorktrees();
    pruneOrphanedWorktrees(repoDir);

    // Assert: worktree directory no longer exists
    assert.ok(
      !fs.existsSync(worktreeDir),
      'worktree directory should have been removed but still exists: ' + worktreeDir
    );

    // Assert: git worktree list no longer shows it
    const listOut = execSync('git worktree list', { cwd: repoDir, encoding: 'utf8' });
    assert.ok(
      !listOut.includes(worktreeDir),
      'git worktree list still references removed worktree:\n' + listOut
    );
  });

  // Test 2: keeps a worktree whose branch has unmerged commits
  test('keeps a worktree whose branch has unmerged commits', () => {
    const repoDir = path.join(tmpBase, 'repo2');
    const worktreeDir = path.join(tmpBase, 'wt-active');

    createGitRepo(repoDir);

    // Create the worktree on a new branch (main is checked out in repoDir)
    execSync('git worktree add "' + worktreeDir + '" -b fix/active-work', { cwd: repoDir, stdio: 'pipe' });

    // Add a commit in the worktree (NOT merged into main)
    fs.writeFileSync(path.join(worktreeDir, 'active.txt'), 'active\n');
    execSync('git add -A', { cwd: worktreeDir, stdio: 'pipe' });
    execSync('git commit -m "active work"', { cwd: worktreeDir, stdio: 'pipe' });
    // main stays at its original commit — no merge

    // Act
    const pruneOrphanedWorktrees = getPruneOrphanedWorktrees();
    pruneOrphanedWorktrees(repoDir);

    // Assert: worktree directory still exists
    assert.ok(
      fs.existsSync(worktreeDir),
      'worktree directory should NOT have been removed: ' + worktreeDir
    );
  });

  // Test 3: never removes the worktree at process.cwd()
  test('never removes the worktree at process.cwd()', () => {
    const repoDir = path.join(tmpBase, 'repo3');
    const wtDir = path.join(tmpBase, 'wt-cwd-test');

    createGitRepo(repoDir);

    // Create a worktree, add a commit, merge it into main
    execSync('git worktree add "' + wtDir + '" -b fix/another-merged', { cwd: repoDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(wtDir, 'more.txt'), 'more\n');
    execSync('git add -A', { cwd: wtDir, stdio: 'pipe' });
    execSync('git commit -m "another merged"', { cwd: wtDir, stdio: 'pipe' });
    execSync('git checkout main', { cwd: repoDir, stdio: 'pipe' });
    execSync('git merge fix/another-merged --no-ff -m "merge another"', { cwd: repoDir, stdio: 'pipe' });

    // Run pruning
    const pruneOrphanedWorktrees = getPruneOrphanedWorktrees();
    const pruned = pruneOrphanedWorktrees(repoDir);

    // process.cwd() must not appear in pruned paths
    assert.ok(
      !pruned.includes(process.cwd()),
      'process.cwd() should never be pruned, but found in: ' + JSON.stringify(pruned)
    );

    // The main worktree (repoDir) itself must still exist
    assert.ok(
      fs.existsSync(repoDir),
      'main repo dir should still exist: ' + repoDir
    );
  });

  // Test 4: runs git worktree prune to clear stale references
  test('runs git worktree prune to clear stale references', () => {
    const repoDir = path.join(tmpBase, 'repo4');
    const worktreeDir = path.join(tmpBase, 'wt-stale');

    createGitRepo(repoDir);

    // Create a worktree
    execSync('git worktree add "' + worktreeDir + '" -b fix/stale-ref', { cwd: repoDir, stdio: 'pipe' });
    assert.ok(fs.existsSync(worktreeDir), 'worktree dir should exist before manual deletion');

    // Verify it appears in git worktree list
    const beforeList = execSync('git worktree list --porcelain', { cwd: repoDir, encoding: 'utf8' });
    assert.ok(beforeList.includes(worktreeDir), 'worktree should appear in list before deletion');

    // Manually delete the worktree directory (simulate orphan)
    fs.rmSync(worktreeDir, { recursive: true, force: true });

    // Act
    const pruneOrphanedWorktrees = getPruneOrphanedWorktrees();
    pruneOrphanedWorktrees(repoDir);

    // Assert: git worktree list no longer shows the stale entry
    const afterList = execSync('git worktree list --porcelain', { cwd: repoDir, encoding: 'utf8' });
    assert.ok(
      !afterList.includes(worktreeDir),
      'git worktree list still shows stale entry after prune:\n' + afterList
    );
  });
});
