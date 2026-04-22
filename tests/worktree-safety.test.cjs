/**
 * Worktree commit safety hardening tests (#1977)
 *
 * Three checks:
 * 1. worktree_branch_check in execute-plan.md is NOT labeled as Windows-only
 *    (the bug affects all platforms — no platform qualifier should narrow the fix)
 * 2. gsd-executor.md task_commit_protocol includes post-commit deletion verification
 *    (using --diff-filter=D to catch accidental file deletions per task)
 * 3. execute-phase.md worktree merge section includes pre-merge deletion check
 *    (using --diff-filter=D to block merges that would delete tracked files)
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PLAN_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-plan.md');
const EXECUTOR_AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-executor.md');
const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

describe('worktree commit safety hardening (#1977)', () => {
  test('execute-plan worktree_branch_check has no Windows-only platform qualifier', () => {
    const content = fs.readFileSync(EXECUTE_PLAN_PATH, 'utf-8');

    // The worktree_branch_check block must exist
    assert.ok(
      content.includes('worktree_branch_check'),
      'execute-plan.md must contain a worktree_branch_check block'
    );

    // Search the whole file for any Windows-only qualifier near worktree_branch_check
    // Must NOT say "Windows-only" or restrict the check to Windows
    const hasWindowsOnlyQualifier = (
      /Windows.only/i.test(content) ||
      /affects Windows only/i.test(content) ||
      /only on Windows/i.test(content) ||
      /Windows-specific/i.test(content)
    );
    assert.ok(
      !hasWindowsOnlyQualifier,
      'worktree_branch_check must not be labeled as Windows-only — the bug affects all platforms'
    );

    // Must indicate the fix is universal (affects all platforms or similar)
    // The description must exist somewhere in the file
    const isUniversal = (
      /affects all platforms/i.test(content) ||
      /all platforms/i.test(content) ||
      /cross.platform/i.test(content)
    );
    assert.ok(
      isUniversal,
      'worktree_branch_check description must indicate the fix applies to all platforms'
    );
  });

  test('gsd-executor.md task_commit_protocol includes post-commit deletion verification', () => {
    const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

    // Must contain --diff-filter=D deletion check
    assert.ok(
      content.includes('--diff-filter=D'),
      'gsd-executor.md must include --diff-filter=D deletion verification after each task commit'
    );

    // Must include a WARNING or notice about deletions
    assert.ok(
      content.includes('WARNING') || content.includes('DELETIONS'),
      'gsd-executor.md must warn when a commit includes file deletions'
    );
  });

  test('execute-phase.md worktree merge section includes pre-merge deletion check', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

    // The merge section must exist
    const mergeIdx = content.indexOf('git merge');
    assert.ok(mergeIdx > -1, 'execute-phase.md must contain a git merge operation');

    // Find the window before the merge command to check for pre-merge deletion detection
    // Look broadly for --diff-filter=D in the worktree cleanup section
    const worktreeCleanupStart = content.indexOf('Worktree cleanup');
    assert.ok(
      worktreeCleanupStart > -1,
      'execute-phase.md must have a worktree cleanup section'
    );

    const cleanupSection = content.slice(worktreeCleanupStart);

    // Must include --diff-filter=D for deletion detection
    assert.ok(
      cleanupSection.includes('--diff-filter=D'),
      'execute-phase.md worktree merge section must include --diff-filter=D to check for deletions before merge'
    );

    // The deletion check must appear BEFORE the git merge call within the cleanup section
    const deletionCheckIdx = cleanupSection.indexOf('--diff-filter=D');
    const gitMergeIdx = cleanupSection.indexOf('git merge');
    assert.ok(
      deletionCheckIdx < gitMergeIdx,
      'deletion check (--diff-filter=D) must appear before git merge in the worktree cleanup section'
    );

    // Must have a BLOCKED or warning message for when deletions are found
    assert.ok(
      cleanupSection.includes('BLOCKED') || cleanupSection.includes('DELETIONS') || cleanupSection.includes('deletion'),
      'execute-phase.md must warn or block when the worktree branch contains file deletions'
    );
  });
});
