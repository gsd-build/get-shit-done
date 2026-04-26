/**
 * Regression test for bug #2686
 *
 * The gsd-code-fixer agent (spawned by /gsd-code-review-fix) operated directly
 * against the main working tree. When it ran concurrently with a foreground
 * session both processes raced for HEAD, the index, and on-disk files. The
 * foreground session's next commit could land on the wrong branch (whichever
 * branch the agent last checked out).
 *
 * Fix: the agent's working instructions must include `git worktree add` as the
 * FIRST git operation, run ALL subsequent git operations inside that worktree
 * path, and call `git worktree remove` for cleanup when done.
 *
 * This mirrors the pattern already used by every other per-issue GSD agent at
 * /private/tmp/sv-<n>.
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// The gsd-code-fixer agent's working instructions ARE the product — Claude
// executes them literally at runtime. Testing the text content tests the
// deployed contract: if the instruction is absent, the isolation guarantee
// is absent.

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('bug-2686: review-fix agent worktree isolation', () => {
  let agentContent;

  before(() => {
    const agentPath = path.join(__dirname, '..', 'agents', 'gsd-code-fixer.md');
    assert.ok(fs.existsSync(agentPath), 'agents/gsd-code-fixer.md must exist');
    agentContent = fs.readFileSync(agentPath, 'utf-8');
  });

  test('agent instructions include git worktree add before any branch-switching checkout or commit', () => {
    const worktreePos = agentContent.indexOf('git worktree add');

    assert.ok(
      worktreePos !== -1,
      'gsd-code-fixer.md must include a "git worktree add" instruction to isolate operations from the main working tree (#2686)'
    );

    // `git checkout -- {file}` is a file-restore within the worktree — safe, not a branch switch.
    // The dangerous operation is `git checkout <branch>` (no leading --).
    // Find the first branch-switching checkout (pattern: "git checkout " NOT followed by "--").
    const branchCheckoutMatch = /git checkout (?!--)/.exec(agentContent);
    if (branchCheckoutMatch) {
      const branchCheckoutPos = branchCheckoutMatch.index;
      assert.ok(
        worktreePos < branchCheckoutPos,
        'git worktree add must appear before any branch-switching git checkout in the agent instructions'
      );
    }

    // commit command must come after worktree setup — the fixer may use
    // either `git commit` directly or `gsd-sdk query commit`
    const commitMatch = /(?:git commit|gsd-sdk query commit)/.exec(agentContent);
    if (commitMatch) {
      const commitPos = commitMatch.index;
      assert.ok(
        worktreePos < commitPos,
        'git worktree add must appear before any commit command in the agent instructions'
      );
    }
  });

  test('agent instructions include worktree cleanup after completion', () => {
    assert.ok(
      agentContent.includes('git worktree remove') || agentContent.includes('worktree remove'),
      'gsd-code-fixer.md must include worktree cleanup (git worktree remove) to avoid leaking tmp directories (#2686)'
    );
  });

  test('agent instructions use a /tmp path for the worktree', () => {
    // Require either a literal /tmp/sv- path or a variable assignment to /tmp/sv-
    // (e.g. `wt=$(mktemp -d "/tmp/sv-..."`).  Bare `$wt` or `wt=` references
    // without a /tmp/sv- assignment are not sufficient.
    const hasTmpWorktreePath =
      /\/tmp\/sv-/.test(agentContent) ||
      /\bwt\s*=\s*["']?\/tmp\/sv-/.test(agentContent);
    assert.ok(
      hasTmpWorktreePath,
      'gsd-code-fixer.md must define a worktree variable at a /tmp/sv-... path, consistent with other GSD agents (#2686)'
    );
  });
});
