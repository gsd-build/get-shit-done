'use strict';

/**
 * Regression test for bug #3749
 *
 * PR #1279 added strategy-branch creation logic to cmdCommit() in
 * get-shit-done/bin/lib/commands.cjs (lines 285-320) so pre-execution
 * workflows (discuss-phase, plan-phase, etc.) would create the configured
 * phase/milestone branch before their first commit. That fix only landed in
 * the CJS path; sdk/src/query/commit.ts — the live production path for
 * `gsd-sdk query commit` — has zero branching logic.
 *
 * This test verifies the structural invariants (source-text) that the SDK
 * commit handler implements the same strategy-branch behaviour as the CJS
 * path. A static assertion is appropriate here because:
 *   (a) sdk/dist/ is not required in CI (built at publish time),
 *   (b) the logic lives in a single well-defined location in commit.ts, and
 *   (c) the vitest suite covers runtime behaviour for the commit handler
 *       (sdk/src/query/commit.test.ts).
 *
 * Counterpart runtime coverage is added to sdk/src/query/commit.test.ts
 * alongside the source fix (GREEN step).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COMMIT_TS = path.join(__dirname, '..', 'sdk', 'src', 'query', 'commit.ts');
const source = fs.readFileSync(COMMIT_TS, 'utf-8');

// ─── Structural: branching_strategy must be present ───────────────────────

describe('bug #3749: SDK commit handler — branching-strategy port from CJS (#1279)', () => {

  test('commit.ts reads branching_strategy from config', () => {
    assert.ok(
      source.includes('branching_strategy'),
      'sdk/src/query/commit.ts must read branching_strategy from the project config. ' +
      'PR #1279 added this check to the CJS path (commands.cjs:288) but the SDK ' +
      'commit handler never received the port — fixes #3749.',
    );
  });

  test('commit.ts handles branching_strategy === "phase"', () => {
    assert.ok(
      source.includes("=== 'phase'") || source.includes('=== "phase"'),
      'sdk/src/query/commit.ts must handle branching_strategy === "phase" to match ' +
      'the CJS logic at commands.cjs:290.',
    );
  });

  test('commit.ts handles branching_strategy === "milestone"', () => {
    assert.ok(
      source.includes("=== 'milestone'") || source.includes('=== "milestone"'),
      'sdk/src/query/commit.ts must handle branching_strategy === "milestone" to match ' +
      'the CJS logic at commands.cjs:302.',
    );
  });

  test('commit.ts performs git checkout to create or switch to the strategy branch', () => {
    // The CJS path calls execGit(['checkout', '-b', branchName]) and falls back
    // to execGit(['checkout', branchName]). The SDK must do the equivalent.
    const hasCheckoutB = source.includes("'checkout', '-b'") || source.includes('"checkout", "-b"');
    const hasCheckout = source.includes("'checkout'") || source.includes('"checkout"');
    assert.ok(
      hasCheckoutB || hasCheckout,
      'sdk/src/query/commit.ts must call git checkout (-b) to create or switch to the ' +
      'strategy branch before committing, matching CJS commands.cjs:314-316.',
    );
  });

  test('commit.ts uses loadConfig (typed) instead of raw JSON.parse for config in the strategy block', () => {
    // The branching-strategy fix needs the nested git.branching_strategy key,
    // which is only available via loadConfig(). The current handler reads config
    // via readFile/JSON.parse for commit_docs only — the fix must use loadConfig
    // so that the full typed GSDConfig is available for the git sub-object.
    assert.ok(
      source.includes('loadConfig'),
      'sdk/src/query/commit.ts must import and call loadConfig() to read ' +
      'config.git.branching_strategy and the branch templates — raw JSON.parse ' +
      'only accesses top-level keys (commit_docs); it misses the nested git section.',
    );
  });

  test('commit.ts uses phase_branch_template for phase strategy', () => {
    assert.ok(
      source.includes('phase_branch_template'),
      'sdk/src/query/commit.ts must reference phase_branch_template when computing ' +
      'the target branch for branching_strategy === "phase", matching CJS:297.',
    );
  });

  test('commit.ts uses milestone_branch_template for milestone strategy', () => {
    assert.ok(
      source.includes('milestone_branch_template'),
      'sdk/src/query/commit.ts must reference milestone_branch_template when computing ' +
      'the target branch for branching_strategy === "milestone", matching CJS:305.',
    );
  });

  test('commit.ts guards strategy switch on current branch !== target branch', () => {
    // CJS: rev-parse --abbrev-ref HEAD, then only checkout if !== branchName.
    // This prevents repeated checkout calls on every commit once on the branch.
    assert.ok(
      source.includes('--abbrev-ref'),
      'sdk/src/query/commit.ts must read the current branch via ' +
      '`git rev-parse --abbrev-ref HEAD` and only switch when current !== target, ' +
      'matching the CJS guard at commands.cjs:311-312.',
    );
  });
});

// ─── Structural: branching_strategy=off/none → NO checkout ────────────────

describe('bug #3749 counter-test: branching_strategy "none"/"off" must not trigger switch', () => {
  test('commit.ts guards strategy block on branching_strategy !== "none"', () => {
    // The CJS block is: if (config.branching_strategy && config.branching_strategy !== 'none')
    // A missing or "none" strategy must not attempt any git checkout.
    assert.ok(
      source.includes("!== 'none'") || source.includes('!== "none"') ||
      source.includes("=== 'none'") || source.includes('=== "none"') ||
      // Acceptable alternative: treat only explicit phase/milestone values
      (source.includes("=== 'phase'") && source.includes("=== 'milestone'")),
      'sdk/src/query/commit.ts must skip the branch-switch logic when ' +
      'branching_strategy is absent, "none", or unrecognised — matching the ' +
      'CJS guard at commands.cjs:288.',
    );
  });
});
