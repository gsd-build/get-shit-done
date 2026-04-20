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

  test('post-merge deletion audit uses git diff HEAD~1 HEAD to check merge commit', () => {
    assert.ok(
      content.includes('HEAD~1') && content.includes('--diff-filter=D'),
      'execute-phase.md must include a post-merge check using git diff --diff-filter=D HEAD~1 HEAD ' +
      'to detect bulk deletions that made it into the merge commit'
    );
  });

  test('post-merge audit includes a revert path when bulk deletions are found', () => {
    assert.ok(
      content.includes('reset --hard HEAD~1') || content.includes('BULK_DELETIONS'),
      'execute-phase.md must include a git reset --hard HEAD~1 revert when bulk deletions ' +
      'are detected in the merge commit'
    );
  });

  test('post-merge audit uses a threshold to distinguish bulk from intentional deletions', () => {
    // The check must count deletions and only trigger above a threshold (5 or configurable)
    assert.ok(
      content.match(/MERGE_DEL_COUNT|del_count|DEL_COUNT|BULK_DEL/i),
      'execute-phase.md must count post-merge deletions and compare against a threshold'
    );
  });
});
