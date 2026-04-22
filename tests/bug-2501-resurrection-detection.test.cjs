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

  test('resurrection block checks git history for a prior deletion event', () => {
    if (!content) content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // Scope check to the resurrection block only (up to 1200 chars from its heading).
    const resurrectionStart = content.indexOf('# Detect files deleted on main');
    assert.ok(resurrectionStart !== -1, 'resurrection comment must exist');
    const window = content.slice(resurrectionStart, resurrectionStart + 1200);

    // The fix must add a git log --diff-filter=D check inside this block so that
    // only files with a deletion event in the main branch ancestry are removed.
    const hasHistoryCheck =
      window.includes('--diff-filter=D') &&
      window.includes('git log');
    assert.ok(
      hasHistoryCheck,
      'execute-phase.md resurrection block must use "git log ... --diff-filter=D" to verify a file was previously deleted before removing it'
    );
  });

  test('resurrection block does not delete files solely because they are absent from PRE_MERGE_FILES', () => {
    if (!content) content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // Extract the resurrection section (between the "Detect files deleted on main"
    // comment and the next empty line / next major comment block).
    const resurrectionStart = content.indexOf('# Detect files deleted on main');
    assert.ok(
      resurrectionStart !== -1,
      'execute-phase.md must contain the resurrection-detection comment block'
    );

    // Grab a window of text around the resurrection block (up to 1200 chars).
    const window = content.slice(resurrectionStart, resurrectionStart + 1200);

    // The ONLY deletion guard should be the history check.
    // The buggy pattern: `if ! echo "$PRE_MERGE_FILES" | grep -qxF "$RESURRECTED"`
    // with NO accompanying history check. After the fix the sole condition
    // determining deletion must involve a git-log history lookup.
    const hasBuggyStandaloneGuard =
      /if\s*!\s*echo\s*"\$PRE_MERGE_FILES"\s*\|\s*grep\s+-qxF\s*"\$RESURRECTED"/.test(window) &&
      !/git log/.test(window);

    assert.ok(
      !hasBuggyStandaloneGuard,
      'resurrection block must NOT delete files based solely on absence from PRE_MERGE_FILES without a git-history check'
    );
  });

  test('resurrection block still removes files that have a deletion history on main', () => {
    if (!content) content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    // The fix must still call `git rm` for genuine resurrections.
    const resurrectionStart = content.indexOf('# Detect files deleted on main');
    assert.ok(resurrectionStart !== -1, 'resurrection comment must exist');

    const window = content.slice(resurrectionStart, resurrectionStart + 1200);
    assert.ok(
      window.includes('git rm'),
      'resurrection block must still call git rm to remove genuinely resurrected files'
    );
  });
});
