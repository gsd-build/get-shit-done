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

  test('post-merge deletion audit uses merge-commit diff', () => {
    assert.match(
      content,
      /git diff --diff-filter=D --name-only HEAD~1 HEAD/,
      'execute-phase.md must diff HEAD~1..HEAD with --diff-filter=D for post-merge deletion audit'
    );
  });

  test('post-merge audit includes threshold gate + escape hatch + revert path', () => {
    assert.match(
      content,
      /\[\s*"\$MERGE_DEL_COUNT"\s*-gt\s*5\s*\]\s*&&\s*\[\s*"\$\{ALLOW_BULK_DELETE:-0\}"\s*!=\s*"1"\s*\]/,
      'execute-phase.md must gate on MERGE_DEL_COUNT threshold and ALLOW_BULK_DELETE override'
    );
    assert.match(
      content,
      /git reset --hard HEAD~1/,
      'execute-phase.md must revert the merge commit when bulk deletions are blocked'
    );
  });

  test('post-merge audit computes deletion count outside .planning/', () => {
    assert.match(
      content,
      /MERGE_DEL_COUNT=.*grep -vc '\^\\\.planning\//,
      'execute-phase.md must count non-.planning deletions for the bulk-delete guard'
    );
  });
});
