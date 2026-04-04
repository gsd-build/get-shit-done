/**
 * GSD Tools Tests - worktree cleanup after executor completes
 *
 * Validates that execute-phase.md and quick.md include post-execution
 * worktree cleanup logic (merge branch, remove worktree, delete branch).
 *
 * Closes: #1496
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('worktree cleanup after executor completes (#1496)', () => {
  const executePhasePath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
  const quickPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

  test('execute-phase.md includes worktree cleanup step', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('Worktree cleanup'),
      'execute-phase should have a worktree cleanup step');
    assert.ok(content.includes('git worktree remove'),
      'cleanup should remove worktrees');
    assert.ok(content.includes('git branch -D'),
      'cleanup should delete temporary branches');
  });

  test('execute-phase.md merges worktree branch before removing', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('git merge'),
      'cleanup should merge worktree branch into current branch');
  });

  test('execute-phase.md handles merge conflicts gracefully', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(
      content.includes('Merge conflict') || content.includes('merge conflict'),
      'cleanup should handle merge conflicts gracefully'
    );
  });

  test('execute-phase.md skips cleanup when use_worktrees is false', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('use_worktrees'),
      'cleanup should respect workflow.use_worktrees config');
  });

  test('quick.md includes worktree cleanup after executor returns', () => {
    const content = fs.readFileSync(quickPath, 'utf8');
    assert.ok(content.includes('Worktree cleanup') || content.includes('worktree cleanup'),
      'quick should have worktree cleanup');
    assert.ok(content.includes('git worktree remove'),
      'quick cleanup should remove worktrees');
    assert.ok(content.includes('git branch -D'),
      'quick cleanup should delete temporary branches');
  });

  test('quick.md merges worktree branch before removing', () => {
    const content = fs.readFileSync(quickPath, 'utf8');
    assert.ok(content.includes('git merge'),
      'quick cleanup should merge worktree branch');
  });

  test('cleanup uses git worktree list to discover orphans', () => {
    const content = fs.readFileSync(executePhasePath, 'utf8');
    assert.ok(content.includes('git worktree list'),
      'cleanup should discover worktrees via git worktree list');
  });
});
