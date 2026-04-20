/**
 * Regression test for #2431: quick.md and execute-phase.md worktree teardown
 * silently accumulates locked worktrees via `2>/dev/null || true`.
 *
 * Fix: replace the silent-fail pattern with a lock-aware block that surfaces
 * the error and provides a user-visible recovery message.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

function assertNoSilentWorktreeRemove(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // The old pattern: git worktree remove "$WT" --force 2>/dev/null || true
  const silentRemovePattern = /git worktree remove[^\n]*--force\s+2>\/dev\/null\s*\|\|\s*true/;
  assert.ok(
    !silentRemovePattern.test(content),
    `${label}: must not contain "git worktree remove --force 2>/dev/null || true" (silently swallows errors)`
  );
}

function assertHasLockAwareBlock(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Fix must include: lock-aware detection (checking .git/worktrees/*/locked)
  const hasLockCheck = content.includes('.git/worktrees/') && content.includes('locked');
  assert.ok(
    hasLockCheck,
    `${label}: must include lock-aware detection (.git/worktrees/.../locked check)`
  );
}

function assertHasWorktreeUnlock(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Fix must include a git worktree unlock attempt
  assert.ok(
    content.includes('git worktree unlock'),
    `${label}: must include "git worktree unlock" retry attempt`
  );
}

function assertHasUserVisibleWarning(filePath, label) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Fix must print a user-visible warning on residual worktree failure
  const hasWarning = content.includes('Residual worktree') || content.includes('manual cleanup');
  assert.ok(
    hasWarning,
    `${label}: must include user-visible warning when worktree removal fails`
  );
}

describe('bug-2431: worktree teardown must surface locked-worktree errors', () => {
  test('quick.md exists', () => {
    assert.ok(fs.existsSync(QUICK_PATH), 'quick.md should exist');
  });

  test('execute-phase.md exists', () => {
    assert.ok(fs.existsSync(EXECUTE_PHASE_PATH), 'execute-phase.md should exist');
  });

  test('quick.md: no silent worktree remove pattern', () => {
    assertNoSilentWorktreeRemove(QUICK_PATH, 'quick.md');
  });

  test('execute-phase.md: no silent worktree remove pattern', () => {
    assertNoSilentWorktreeRemove(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });

  test('quick.md: has lock-aware detection block', () => {
    assertHasLockAwareBlock(QUICK_PATH, 'quick.md');
  });

  test('execute-phase.md: has lock-aware detection block', () => {
    assertHasLockAwareBlock(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });

  test('quick.md: has git worktree unlock retry', () => {
    assertHasWorktreeUnlock(QUICK_PATH, 'quick.md');
  });

  test('execute-phase.md: has git worktree unlock retry', () => {
    assertHasWorktreeUnlock(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });

  test('quick.md: has user-visible warning on residual worktree', () => {
    assertHasUserVisibleWarning(QUICK_PATH, 'quick.md');
  });

  test('execute-phase.md: has user-visible warning on residual worktree', () => {
    assertHasUserVisibleWarning(EXECUTE_PHASE_PATH, 'execute-phase.md');
  });
});
