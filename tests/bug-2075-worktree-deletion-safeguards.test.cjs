// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression tests for #2075: gsd-executor worktree merge systematically
 * deletes prior-wave committed files.
 *
 * Three failure modes documented in issue #2075:
 *
 * Failure Mode B (PRIMARY — unaddressed before this fix):
 *   Executor agent runs `git clean` inside the worktree, removing files
 *   committed on the feature branch. git clean treats them as "untracked"
 *   from the worktree's perspective and deletes them. The executor then
 *   commits only its own deliverables; the subsequent merge brings the
 *   deletions onto the main branch.
 *
 * Failure Mode A (partially addressed in PR #1982):
 *   Worktree created from wrong branch base. Audit all worktree-spawning
 *   workflows for worktree_branch_check presence.
 *
 * Failure Mode C:
 *   Stale content from wrong base overwrites shared files. Covered by
 *   the --hard reset in the worktree_branch_check.
 *
 * Defense-in-depth (from #1977):
 *   Post-commit deletion check: already in gsd-executor.md (--diff-filter=D).
 *   Pre-merge deletion check: already in execute-phase.md (--diff-filter=D).
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTOR_AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-executor.md');
const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');
const DIAGNOSE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'diagnose-issues.md');

describe('bug-2075: worktree deletion safeguards', () => {

  describe('Failure Mode B: git clean prohibition in executor agent', () => {
    test('gsd-executor.md explicitly prohibits git clean in worktree context', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      // Must have an explicit prohibition section mentioning git clean
      const prohibitsGitClean = (
        content.includes('git clean') &&
        (
          /NEVER.*git clean/i.test(content) ||
          /git clean.*NEVER/i.test(content) ||
          /do not.*git clean/i.test(content) ||
          /git clean.*prohibited/i.test(content) ||
          /prohibited.*git clean/i.test(content) ||
          /forbidden.*git clean/i.test(content) ||
          /git clean.*forbidden/i.test(content) ||
          /must not.*git clean/i.test(content) ||
          /git clean.*must not/i.test(content)
        )
      );

      assert.ok(
        prohibitsGitClean,
        'gsd-executor.md must explicitly prohibit git clean — running it inside a worktree deletes files committed on the feature branch (#2075 Failure Mode B)'
      );
    });

    test('gsd-executor.md git clean prohibition explains the worktree data-loss risk', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      // The prohibition must be accompanied by a reason — not just a bare rule
      // Look for the word "worktree" near the git clean prohibition
      const gitCleanIdx = content.indexOf('git clean');
      assert.ok(gitCleanIdx > -1, 'gsd-executor.md must mention git clean (to prohibit it)');

      // Extract context around the git clean mention (500 chars either side)
      const contextStart = Math.max(0, gitCleanIdx - 500);
      const contextEnd = Math.min(content.length, gitCleanIdx + 500);
      const context = content.slice(contextStart, contextEnd);

      const hasWorktreeRationale = (
        /worktree/i.test(context) ||
        /delete/i.test(context) ||
        /untracked/i.test(context)
      );

      assert.ok(
        hasWorktreeRationale,
        'The git clean prohibition in gsd-executor.md must explain why: git clean in a worktree deletes files that appear untracked but are committed on the feature branch'
      );
    });
  });

  describe('Failure Mode A: worktree_branch_check audit across all worktree-spawning workflows', () => {
    test('execute-phase.md has worktree_branch_check block with --hard reset', () => {
      const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

      const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
      assert.ok(
        blockMatch,
        'execute-phase.md must contain a <worktree_branch_check> block'
      );

      const block = blockMatch[1];
      assert.ok(
        block.includes('reset --hard'),
        'execute-phase.md worktree_branch_check must use git reset --hard (not --soft)'
      );
      assert.ok(
        !block.includes('reset --soft'),
        'execute-phase.md worktree_branch_check must not use git reset --soft'
      );
    });

    test('quick.md has worktree_branch_check block with --hard reset', () => {
      const content = fs.readFileSync(QUICK_PATH, 'utf-8');

      const blockMatch = content.match(/<worktree_branch_check>([\s\S]*?)<\/worktree_branch_check>/);
      assert.ok(
        blockMatch,
        'quick.md must contain a <worktree_branch_check> block'
      );

      const block = blockMatch[1];
      assert.ok(
        block.includes('reset --hard'),
        'quick.md worktree_branch_check must use git reset --hard (not --soft)'
      );
      assert.ok(
        !block.includes('reset --soft'),
        'quick.md worktree_branch_check must not use git reset --soft'
      );
    });

    test('diagnose-issues.md has worktree_branch_check instruction for spawned agents', () => {
      const content = fs.readFileSync(DIAGNOSE_PATH, 'utf-8');

      assert.ok(
        content.includes('worktree_branch_check'),
        'diagnose-issues.md must include worktree_branch_check instruction for spawned debug agents'
      );

      assert.ok(
        content.includes('reset --hard'),
        'diagnose-issues.md worktree_branch_check must instruct agents to use git reset --hard'
      );
    });
  });

  describe('Defense-in-depth: post-commit deletion check (from #1977)', () => {
    test('gsd-executor.md task_commit_protocol has post-commit deletion verification', () => {
      const content = fs.readFileSync(EXECUTOR_AGENT_PATH, 'utf-8');

      assert.ok(
        content.includes('--diff-filter=D'),
        'gsd-executor.md must include --diff-filter=D to detect accidental file deletions after each commit'
      );

      // Must have a warning about unexpected deletions
      assert.ok(
        content.includes('DELETIONS') || content.includes('WARNING'),
        'gsd-executor.md must emit a warning when a commit includes unexpected file deletions'
      );
    });
  });

  describe('Defense-in-depth: pre-merge deletion check (from #1977)', () => {
    test('execute-phase.md worktree merge section has pre-merge deletion check', () => {
      const content = fs.readFileSync(EXECUTE_PHASE_PATH, 'utf-8');

      const worktreeCleanupStart = content.indexOf('Worktree cleanup');
      assert.ok(
        worktreeCleanupStart > -1,
        'execute-phase.md must have a worktree cleanup section'
      );

      const cleanupSection = content.slice(worktreeCleanupStart);

      assert.ok(
        cleanupSection.includes('--diff-filter=D'),
        'execute-phase.md worktree cleanup must use --diff-filter=D to block deletion-introducing merges'
      );

      // Deletion check must appear before git merge
      const deletionCheckIdx = cleanupSection.indexOf('--diff-filter=D');
      const gitMergeIdx = cleanupSection.indexOf('git merge');
      assert.ok(
        deletionCheckIdx < gitMergeIdx,
        '--diff-filter=D deletion check must appear before git merge in the worktree cleanup section'
      );

      assert.ok(
        cleanupSection.includes('BLOCKED') || cleanupSection.includes('deletion'),
        'execute-phase.md must block or warn when the worktree branch contains file deletions'
      );
    });

    test('quick.md worktree merge section has pre-merge deletion check', () => {
      const content = fs.readFileSync(QUICK_PATH, 'utf-8');

      const mergeIdx = content.indexOf('git merge');
      assert.ok(mergeIdx > -1, 'quick.md must contain a git merge operation');

      // Find the worktree cleanup block (starts after "Worktree cleanup")
      const worktreeCleanupStart = content.indexOf('Worktree cleanup');
      assert.ok(
        worktreeCleanupStart > -1,
        'quick.md must have a worktree cleanup section'
      );

      const cleanupSection = content.slice(worktreeCleanupStart);

      assert.ok(
        cleanupSection.includes('--diff-filter=D') || cleanupSection.includes('diff-filter'),
        'quick.md worktree cleanup must check for file deletions before merging'
      );
    });
  });

});
