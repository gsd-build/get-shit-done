'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2990: gsd-code-fixer worktree setup fails when current branch
 * is already checked out in the main repo.
 *
 * The original agent definition called `git worktree add "$wt" "$branch"`,
 * where `$branch` was the user's currently-checked-out branch. Git refuses
 * to check out the same branch in two worktrees by default, so the setup
 * failed before the agent could do any work.
 *
 * Fix: create a NEW branch `gsd-reviewfix/${padded_phase}-$$` and attach
 * the worktree to it via `git worktree add -b "$reviewfix_branch" "$wt"
 * "$branch"`. The cleanup tail then fast-forwards `$branch` to
 * `$reviewfix_branch` so the user's branch captures the agent's commits.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const AGENT_PATH = path.join(__dirname, '..', 'agents', 'gsd-code-fixer.md');

function parseWorktreeAddInvocations(markdown) {
  // Pull `git worktree add ...` calls and classify each into structured
  // records: hasNewBranchFlag (uses -b $reviewfix_branch) vs attachesToBareBranch
  // ($wt $branch). Skip occurrences inside markdown inline code (backticks)
  // or bash comments -- those are documentation citations of the OLD broken
  // pattern, not executable instructions.
  const invocations = [];
  const lines = markdown.split('\n');
  for (const line of lines) {
    const idx = line.indexOf('git worktree add');
    if (idx === -1) continue;
    // Skip if inside backticks: the substring up to the match has an odd
    // number of backticks, the call is inside an inline code span.
    const before = line.slice(0, idx);
    const backticksBefore = (before.match(/`/g) || []).length;
    if (backticksBefore % 2 === 1) continue;
    // Skip if the line is a bash comment (after stripping leading whitespace).
    if (line.trimStart().startsWith('#')) continue;
    const argstr = line.slice(idx + 'git worktree add'.length).trim();
    invocations.push({
      raw: argstr,
      hasNewBranchFlag: /(?:^|\s)-b\s+["']?\$reviewfix_branch["']?/.test(argstr),
      attachesToBareBranch: /^["']?\$wt["']?\s+["']?\$branch["']?\b/.test(argstr),
    });
  }
  return invocations;
}

describe('Bug #2990: gsd-code-fixer worktree attaches to a NEW branch, not the user-checked-out one', () => {
  const md = fs.readFileSync(AGENT_PATH, 'utf-8');
  const invocations = parseWorktreeAddInvocations(md);

  test('sanity: at least one git-worktree-add invocation exists in the agent definition', () => {
    assert.ok(invocations.length > 0,
      'expected gsd-code-fixer.md to document at least one git worktree add invocation');
  });

  test('every git-worktree-add invocation uses -b $reviewfix_branch (not bare $branch)', () => {
    const violations = invocations.filter(inv => inv.attachesToBareBranch);
    assert.deepEqual(
      violations.map(v => v.raw),
      [],
      `worktree-add invocations attaching to bare $branch (#2990): ${JSON.stringify(violations.map(v => v.raw), null, 2)}`,
    );
  });

  test('the canonical setup invocation uses -b "$reviewfix_branch" "$wt" "$branch"', () => {
    const setupInvocations = invocations.filter(inv => inv.hasNewBranchFlag);
    assert.ok(setupInvocations.length >= 1,
      `expected at least one git-worktree-add invocation with -b "$reviewfix_branch" -- found: ${JSON.stringify(invocations.map(i => i.raw), null, 2)}`);
  });
});

describe('Bug #2990: cleanup tail fast-forwards $branch and deletes the temp branch on success', () => {
  const md = fs.readFileSync(AGENT_PATH, 'utf-8');

  function documentsCommand(pattern) {
    return pattern.test(md);
  }

  test('cleanup invokes git merge --ff-only "$reviewfix_branch" against $branch', () => {
    assert.ok(
      documentsCommand(/git\s+(?:-C\s+["']?\$\{?main_repo\}?["']?\s+)?merge\s+--ff-only\s+["']?\$reviewfix_branch["']?/),
      'expected `git -C "$main_repo" merge --ff-only "$reviewfix_branch"` in the cleanup tail',
    );
  });

  test('cleanup invokes git branch -D "$reviewfix_branch" gated on fast-forward success', () => {
    assert.ok(
      documentsCommand(/git\s+(?:-C\s+["']?\$\{?main_repo\}?["']?\s+)?branch\s+-D\s+["']?\$reviewfix_branch["']?/),
      'expected `git -C "$main_repo" branch -D "$reviewfix_branch"` in the cleanup tail',
    );
  });

  test('recovery sentinel includes reviewfix_branch so re-runs can clean both worktree and temp branch', () => {
    assert.ok(
      documentsCommand(/reviewfix_branch/),
      'expected reviewfix_branch field in the recovery sentinel JSON shape',
    );
  });
});
