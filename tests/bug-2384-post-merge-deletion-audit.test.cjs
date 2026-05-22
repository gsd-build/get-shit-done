'use strict';

/**
 * Regression test for #2384.
 *
 * During execute-phase, the orchestrator merges per-plan worktree branches into
 * main. The pre-merge deletion check (git diff --diff-filter=D HEAD...WT_BRANCH)
 * only catches files deleted on the worktree branch. A post-merge audit is also
 * required to catch deletions that made it into the merge commit (e.g., files
 * that were in the common ancestor but deleted by the merged worktree) and to
 * provide a revert safety net.
 *
 * After #3797: execute-phase.md delegates worktree cleanup to the SDK's
 * worktree.cleanup-wave command, which implements pre-merge deletion checks
 * (diff --diff-filter=D) internally via executeWorktreeWaveCleanupPlan.
 * The manual post-merge shell audit (MERGE_DEL_COUNT, git reset --hard) has
 * been removed from the workflow — it was part of the SDK-absence fallback.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md'
);

describe('execute-phase.md — post-merge deletion audit (#2384)', () => {
  const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');

  test('execute-phase delegates to worktree.cleanup-wave (which handles deletion audit)', () => {
    // After #3797: worktree.cleanup-wave in worktree-safety.cjs performs
    // diff --diff-filter=D checks (blocks branches with deletions) before merge.
    // The workflow delegates to the SDK rather than duplicating the check inline.
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'execute-phase.md must delegate to $GSD_SDK query worktree.cleanup-wave (#2384/#3797)',
    );
  });

  test('execute-phase cleanup-wave uses || exit 1 (fail-closed for blocked deletions)', () => {
    // If worktree.cleanup-wave detects deletions, it exits 1 (blocked).
    // The || exit 1 in the workflow propagates that refusal rather than swallowing it.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave.*\|\| exit 1/,
      'execute-phase.md must use || exit 1 so deletion-blocked cleanups surface to the orchestrator',
    );
  });

  test('execute-phase still has pre-merge deletion check (via guard before worktree.cleanup-wave)', () => {
    // The primary deletion guard is now in worktree-safety.cjs (SDK).
    // The workflow must still enforce WAVE_WORKTREE_MANIFEST so the SDK
    // has the info it needs to validate branches.
    assert.ok(
      content.includes('WAVE_WORKTREE_MANIFEST'),
      'execute-phase.md must pass WAVE_WORKTREE_MANIFEST to worktree.cleanup-wave',
    );
  });
});
