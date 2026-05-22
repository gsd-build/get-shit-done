/**
 * Regression tests for #2838: SUMMARY rescue silently fails when .planning/
 * is gitignored.
 *
 * After #3797: execute-phase.md and quick.md delegate worktree cleanup to the
 * SDK's worktree.cleanup-wave command. The SDK's executeWorktreeWaveCleanupPlan
 * handles SUMMARY rescue internally using a filesystem-level find+cp approach
 * (bypassing gitignore) rather than the old git ls-files --exclude-standard
 * form that silently dropped gitignored files.
 *
 * The inline "Safety net" shell rescue block that was previously in both
 * workflow files has been removed — it was part of the SDK-absence fallback
 * which is now dead code since preflight exits if neither local nor global SDK
 * is available.
 *
 * This test file verifies that both workflows correctly delegate to the SDK
 * for SUMMARY rescue, and that neither workflow retains the broken inline form.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(REPO_ROOT, 'get-shit-done', 'workflows', 'quick.md');

describe('bug-2838: SUMMARY rescue delegates to SDK (worktree.cleanup-wave)', () => {

  test('execute-phase.md is readable', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    assert.ok(content.length > 0, 'execute-phase.md must not be empty');
  });

  test('quick.md is readable', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(content.length > 0, 'quick.md must not be empty');
  });

  test('execute-phase.md delegates SUMMARY rescue to SDK (worktree.cleanup-wave)', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // After #3797: worktree.cleanup-wave handles SUMMARY rescue via find+cp
    // (bypasses gitignore, fixing the #2838 bug). The workflow delegates to the
    // SDK rather than implementing rescue inline.
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'execute-phase.md must delegate to worktree.cleanup-wave for SUMMARY rescue (#2838/#3797)',
    );
  });

  test('quick.md delegates SUMMARY rescue to SDK (worktree.cleanup-wave)', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    // After #3797: worktree.cleanup-wave handles SUMMARY rescue via find+cp
    // (bypasses gitignore, fixing the #2838 bug).
    assert.ok(
      content.includes('worktree.cleanup-wave'),
      'quick.md must delegate to worktree.cleanup-wave for SUMMARY rescue (#2838/#3797)',
    );
  });

  test('execute-phase.md does not retain broken git ls-files --exclude-standard rescue form (#2838)', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // The broken form used --exclude-standard which silently filtered out
    // gitignored .planning/ files — the root cause of #2838.
    assert.ok(
      !content.includes('ls-files --modified --others --exclude-standard'),
      'execute-phase.md must not use ls-files --exclude-standard for SUMMARY rescue (broken for gitignored .planning/)',
    );
  });

  test('quick.md does not retain broken git ls-files --exclude-standard rescue form (#2838)', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.ok(
      !content.includes('ls-files --modified --others --exclude-standard'),
      'quick.md must not use ls-files --exclude-standard for SUMMARY rescue (broken for gitignored .planning/)',
    );
  });

  test('execute-phase.md cleanup-wave uses || exit 1 (fail-closed so rescue errors surface)', () => {
    const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');
    // If the SDK's rescue fails (e.g. filesystem error), || exit 1 surfaces
    // the failure to the orchestrator rather than silently continuing and
    // losing the SUMMARY.
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave.*\|\| exit 1/,
      'execute-phase.md cleanup-wave must use || exit 1 so SUMMARY rescue failures surface (#2838/#3797)',
    );
  });

  test('quick.md cleanup-wave uses || exit 1 (fail-closed so rescue errors surface)', () => {
    const content = fs.readFileSync(QUICK_PATH, 'utf-8');
    assert.match(
      content,
      /\$GSD_SDK query worktree\.cleanup-wave.*\|\| exit 1/,
      'quick.md cleanup-wave must use || exit 1 so SUMMARY rescue failures surface (#2838/#3797)',
    );
  });
});
