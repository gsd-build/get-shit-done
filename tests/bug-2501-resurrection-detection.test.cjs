/**
 * Tests for bug #2501: resurrection-detection block in execute-phase.md must
 * check git history before deleting new .planning/ files.
 *
 * Root cause: the original logic deleted ANY .planning/ file that was absent
 * from PRE_MERGE_FILES, which includes brand-new files (e.g. SUMMARY.md)
 * that the executor just created. A true "resurrection" is a file that was
 * previously tracked on main, deliberately deleted, and then re-introduced by
 * a worktree merge. Detecting that requires a git history check, not just a
 * pre-merge tree membership check.
 *
 * After #3797: execute-phase.md delegates worktree cleanup to the SDK's
 * worktree.cleanup-wave command. Resurrection detection is handled internally
 * by the SDK. The inline WAS_DELETED shell check has been removed from the
 * workflow — it was part of the SDK-absence fallback which is no longer needed
 * since the preflight block exits if neither local nor global SDK is available.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md'
);

describe('execute-phase.md — resurrection-detection guard (#2501)', () => {
  let content;

  // Load once; each test reads from the cached string.
  test('file is readable', () => {
    content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    assert.ok(content.length > 0, 'execute-phase.md must not be empty');
  });

  test('cleanup delegates to SDK (handles resurrection detection internally)', () => {
    if (!content) content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // After #3797: execute-phase.md delegates to worktree.cleanup-wave, which
    // handles pre-merge deletion checks internally. The SDK checks diff --diff-filter=D
    // before merging, blocking branches that contain file deletions (#2384/#2501).
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'execute-phase.md must delegate to worktree.cleanup-wave (#2501/#3797)',
    );
  });

  test('execute-phase does not use the buggy PRE_MERGE_FILES form', () => {
    if (!content) content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // The buggy pattern from before #2501 — deletion conditioned on absence
    // from PRE_MERGE_FILES snapshot. Must remain absent.
    const hasBuggyGuard =
      content.includes('PRE_MERGE_FILES') &&
      /if\s*!\s*echo\s*"\$PRE_MERGE_FILES"\s*\|\s*grep\s+-qxF\s*"\$RESURRECTED"/.test(content);
    assert.ok(
      !hasBuggyGuard,
      'execute-phase.md must NOT delete files based on the PRE_MERGE_FILES snapshot grep (inverted guard bug #2501)',
    );
  });
});
