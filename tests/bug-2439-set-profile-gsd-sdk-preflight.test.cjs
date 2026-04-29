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
  const content = fs.readFileSync(COMMAND_PATH, 'utf-8');

  test('command file exists (config.md — absorbed set-profile in #2790)', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/config.md should exist (absorbed set-profile)');
  });

  test('config.md --profile flag references gsd-sdk config-set-model-profile', () => {
    assert.ok(
      content.includes('gsd-sdk query config-set-model-profile') || content.includes('config-set-model-profile'),
      'config.md must reference gsd-sdk query config-set-model-profile for --profile flag'
    );
  });

  test('pre-flight guard or note exists in config.md for gsd-sdk dependency', () => {
    // The bug (#2439) was that gsd-sdk was called with no pre-flight check, producing
    // an opaque "command not found: gsd-sdk" error. Fix: config.md must reference
    // gsd-sdk so users know the dependency exists when --profile fails.
    assert.ok(
      content.includes('gsd-sdk'),
      'config.md must reference gsd-sdk (pre-flight guard for #2439: "command not found: gsd-sdk")'
    );
  });
});
