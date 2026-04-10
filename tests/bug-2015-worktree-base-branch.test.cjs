/**
 * Regression test for #2015: worktree executor creates branch from master
 * instead of the current feature branch HEAD.
 *
 * The worktree_branch_check in execute-phase.md and quick.md used
 * `git reset --soft {EXPECTED_BASE}` as the recovery action when the
 * worktree was created from the wrong base. `reset --soft` moves the HEAD
 * pointer but leaves the working tree files from main/master unchanged —
 * the executor then works against stale code and its commits contain an
 * enormous diff (the entire feature branch) as deletions.
 *
 * Fix: use `git reset --hard {EXPECTED_BASE}` in the worktree_branch_check.
 * In a fresh worktree with no user changes, --hard is safe and correct.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

describe('worktree_branch_check must use reset --hard not reset --soft (#2015)', () => {

  test('execute-phase.md worktree_branch_check does not use reset --soft', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // Extract the worktree_branch_check block
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'execute-phase.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      !block.includes('reset --soft'),
      'worktree_branch_check must not use reset --soft (leaves working tree files unchanged). Use reset --hard instead.'
    );
  });

  test('execute-phase.md worktree_branch_check uses reset --hard for base correction', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'execute-phase.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      block.includes('reset --hard'),
      'worktree_branch_check must use reset --hard to correctly reset both HEAD and working tree to the expected base'
    );
  });

  test('quick.md worktree_branch_check does not use reset --soft', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'quick.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      !block.includes('reset --soft'),
      'quick.md worktree_branch_check must not use reset --soft. Use reset --hard instead.'
    );
  });

  test('quick.md worktree_branch_check uses reset --hard for base correction', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
    assert.ok(blockMatch, 'quick.md must contain a <worktree_branch_check> block');

    const block = blockMatch[1];
    assert.ok(
      block.includes('reset --hard'),
      'quick.md worktree_branch_check must use reset --hard to correctly reset both HEAD and working tree'
    );
  });
});
