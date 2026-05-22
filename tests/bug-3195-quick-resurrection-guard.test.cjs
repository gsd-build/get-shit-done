/**
 * Drift-guard for bug #3195: quick.md and execute-phase.md must both use
 * the same resurrection-detection approach so they stay in sync.
 *
 * After #3797: both workflows delegate worktree cleanup to the SDK's
 * worktree.cleanup-wave command, which implements resurrection detection
 * (diff --diff-filter=D history checks) internally. The inline WAS_DELETED
 * shell variable form has been removed from both workflows — it was part of
 * the SDK-absence fallback which is now dead code since preflight exits if
 * neither local nor global SDK is available.
 *
 * This test ensures both workflows continue to use the same cleanup
 * mechanism (SDK delegation), not one inline and one delegated.
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

  test('quick.md delegates resurrection detection to SDK (worktree.cleanup-wave)', () => {
    if (!quickContent) quickContent = fs.readFileSync(QUICK_MD, 'utf-8');
    // After #3797: quick.md delegates to worktree.cleanup-wave, which handles
    // resurrection detection (diff --diff-filter=D) internally. The inline
    // WAS_DELETED form has been removed — it was part of the SDK-absence fallback.
    assert.ok(
      quickContent.includes('worktree.cleanup-wave'),
      'quick.md must delegate to worktree.cleanup-wave for resurrection detection (#3195/#3797)'
    );
  });

  test('execute-phase.md delegates resurrection detection to SDK (worktree.cleanup-wave)', () => {
    if (!executePhaseContent) executePhaseContent = fs.readFileSync(EXECUTE_PHASE_MD, 'utf-8');
    // After #3797: execute-phase.md delegates to worktree.cleanup-wave, which handles
    // resurrection detection (diff --diff-filter=D) internally.
    assert.ok(
      executePhaseContent.includes('worktree.cleanup-wave'),
      'execute-phase.md must delegate to worktree.cleanup-wave for resurrection detection (#3195/#3797)'
    );
  });

  test('both workflows use the same cleanup mechanism (SDK delegation parity)', () => {
    if (!quickContent) quickContent = fs.readFileSync(QUICK_MD, 'utf-8');
    if (!executePhaseContent) executePhaseContent = fs.readFileSync(EXECUTE_PHASE_MD, 'utf-8');
    const quickDelegates = quickContent.includes('worktree.cleanup-wave');
    const executeDelegates = executePhaseContent.includes('worktree.cleanup-wave');
    assert.strictEqual(
      quickDelegates,
      executeDelegates,
      'quick.md and execute-phase.md must both use the same cleanup mechanism (SDK delegation parity, #3195)'
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
