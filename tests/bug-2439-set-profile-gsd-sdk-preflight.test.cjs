/**
 * Regression test for bug #2439
 *
 * /gsd-set-profile crashed with `command not found: gsd-sdk` when the
 * gsd-sdk binary was not installed or not in PATH. The command body
 * invoked `gsd-sdk query config-set-model-profile` directly with no
 * pre-flight check, so missing gsd-sdk produced an opaque shell error.
 *
 * Fix mirrors bug #2334: guard the invocation with `command -v gsd-sdk`
 * and emit an install hint when absent.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// #2790: set-profile.md was consolidated into config.md as the --profile flag.
// The gsd-sdk pre-flight check logic moved to config.md body.
const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'config.md');

describe('bug #2439: /gsd-set-profile gsd-sdk pre-flight check', () => {
  test('command file exists (config.md — absorbed set-profile in #2790)', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/config.md should exist (absorbed set-profile)');
  });

  test('config.md --profile flag references gsd-sdk config-set-model-profile', () => {
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');
    assert.ok(
      content.includes('gsd-sdk query config-set-model-profile') || content.includes('config-set-model-profile'),
      'config.md must reference gsd-sdk query config-set-model-profile for --profile flag'
    );
  });

  test('pre-flight guard for #2439 is explicitly documented in config.md --profile path', () => {
    // The original #2439 bug: gsd-sdk was invoked with no pre-flight check, producing
    // an opaque "command not found: gsd-sdk" error.
    //
    // Structural assertion (no raw .includes() on the whole file): isolate the
    // <context> block, locate the --profile branch, then verify it documents both
    // (a) the pre-flight check (`command -v gsd-sdk`) and (b) the install hint
    // BEFORE the gsd-sdk invocation. Otherwise the regression returns silently.
    const content = fs.readFileSync(COMMAND_PATH, 'utf-8');

    const ctxMatch = content.match(/<context>([\s\S]*?)<\/context>/);
    assert.ok(ctxMatch, 'config.md must contain a <context> block describing flag routing');
    const ctx = ctxMatch[1];

    // Find the --profile bullet (everything from the --profile mention up to the
    // next top-level `- ` bullet that does not start with `--profile`).
    const profileBranchMatch = ctx.match(/- If it starts with `--profile`[\s\S]*?(?=\n- (?!\s)[A-Z])/);
    assert.ok(profileBranchMatch, 'config.md <context> must contain a --profile branch');
    const profileBranch = profileBranchMatch[0];

    // (a) pre-flight check token
    assert.ok(
      /command -v gsd-sdk/.test(profileBranch),
      'config.md --profile branch must document `command -v gsd-sdk` pre-flight check (#2439)'
    );
    // (b) install hint near the guard, not after the invocation
    assert.ok(
      /install/i.test(profileBranch),
      'config.md --profile branch must surface an install hint when gsd-sdk is absent (#2439)'
    );
    // (c) #2439 reference so future maintainers can trace the contract
    assert.ok(
      /#2439/.test(profileBranch),
      'config.md --profile branch must cite #2439 so the regression contract is discoverable'
    );

    // (d) ordering: the pre-flight guard text must appear BEFORE the actual
    // `gsd-sdk query config-set-model-profile` invocation in the same branch.
    const guardIdx = profileBranch.indexOf('command -v gsd-sdk');
    const invokeIdx = profileBranch.indexOf('gsd-sdk query config-set-model-profile');
    assert.notEqual(guardIdx, -1, 'guard token missing');
    assert.notEqual(invokeIdx, -1, 'invocation token missing');
    assert.ok(guardIdx < invokeIdx, 'pre-flight guard must appear before the gsd-sdk invocation (#2439 contract)');
  });
});
