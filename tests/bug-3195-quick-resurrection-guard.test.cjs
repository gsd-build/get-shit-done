/**
 * Drift-guard for bug #3195: quick.md and execute-phase.md must both use
 * the git-history-based resurrection guard (WAS_DELETED check), not the
 * inverted PRE_MERGE_FILES grep form that deletes brand-new files.
 *
 * The PRE_MERGE_FILES form was fixed in execute-phase.md by PR #2510 but
 * the same bug remained in quick.md. This test ensures both workflows stay
 * in sync going forward.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const QUICK_MD = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'quick.md'
);
const EXECUTE_PHASE_MD = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md'
);

describe('resurrection guard drift check — quick.md vs execute-phase.md (#3195)', () => {
  let quickContent;
  let executePhaseContent;

  test('both workflow files are readable', () => {
    quickContent = fs.readFileSync(QUICK_MD, 'utf-8');
    executePhaseContent = fs.readFileSync(EXECUTE_PHASE_MD, 'utf-8');
    assert.ok(quickContent.length > 0, 'quick.md must not be empty');
    assert.ok(executePhaseContent.length > 0, 'execute-phase.md must not be empty');
  });

  test('quick.md uses WAS_DELETED (history-check form) in the resurrection block', () => {
    if (!quickContent) quickContent = fs.readFileSync(QUICK_MD, 'utf-8');
    assert.ok(
      quickContent.includes('WAS_DELETED'),
      'quick.md must use WAS_DELETED (git log --diff-filter=D history check) in the resurrection guard'
    );
  });

  test('execute-phase.md uses WAS_DELETED (history-check form) in the resurrection block', () => {
    if (!executePhaseContent) executePhaseContent = fs.readFileSync(EXECUTE_PHASE_MD, 'utf-8');
    assert.ok(
      executePhaseContent.includes('WAS_DELETED'),
      'execute-phase.md must use WAS_DELETED (git log --diff-filter=D history check) in the resurrection guard'
    );
  });

  test('quick.md does not use the buggy PRE_MERGE_FILES grep form', () => {
    if (!quickContent) quickContent = fs.readFileSync(QUICK_MD, 'utf-8');
    // The buggy pattern: deletion conditioned on absence from PRE_MERGE_FILES snapshot
    const hasBuggyGuard =
      quickContent.includes('PRE_MERGE_FILES') &&
      /if\s*!\s*echo\s*"\$PRE_MERGE_FILES"\s*\|\s*grep\s+-qxF\s*"\$RESURRECTED"/.test(quickContent);
    assert.ok(
      !hasBuggyGuard,
      'quick.md must NOT delete files based on the PRE_MERGE_FILES snapshot grep (inverted guard bug #3195)'
    );
  });

  test('execute-phase.md does not use the buggy PRE_MERGE_FILES grep form', () => {
    if (!executePhaseContent) executePhaseContent = fs.readFileSync(EXECUTE_PHASE_MD, 'utf-8');
    const hasBuggyGuard =
      executePhaseContent.includes('PRE_MERGE_FILES') &&
      /if\s*!\s*echo\s*"\$PRE_MERGE_FILES"\s*\|\s*grep\s+-qxF\s*"\$RESURRECTED"/.test(executePhaseContent);
    assert.ok(
      !hasBuggyGuard,
      'execute-phase.md must NOT delete files based on the PRE_MERGE_FILES snapshot grep (inverted guard bug)'
    );
  });
});
