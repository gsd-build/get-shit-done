'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2957: post-install message for `--claude --global` must instruct
 * users to restart Claude Code and offer the skill-name fallback, since
 * the skills-only install layout (CC 2.1.88+) leaves nothing in
 * commands/gsd/ for the slash menu to read on older configurations.
 *
 * Captures the call to finishInstall(runtime='claude', isGlobal=true) and
 * asserts the printed message contains both invocation paths.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const installModule = require(path.join(ROOT, 'bin', 'install.js'));

function captureFinishInstallOutput(runtime, isGlobal) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try {
    installModule.finishInstall(
      '/tmp/gsd-test-settings.json',
      {},
      null,
      false,
      runtime,
      isGlobal,
      null,
    );
  } finally {
    console.log = original;
  }
  // Strip ANSI color escapes so message-content assertions don't couple to colors.
  return lines.join('\n').replace(/\x1B\[[0-9;]*m/g, '');
}

describe('Bug #2957: claude+global post-install message', () => {
  test('claude+global message tells the user to restart and offers skill-name fallback', () => {
    const output = captureFinishInstallOutput('claude', true);

    assert.match(output, /restart claude code/i, 'should mention restart');
    assert.match(output, /\/gsd-new-project/, 'should still mention /gsd-new-project');
    assert.match(output, /gsd-new-project skill/i, 'should mention the skill name fallback');
    assert.doesNotMatch(
      output,
      /open a blank directory/i,
      'global claude install should replace, not extend, the legacy generic instruction',
    );
  });

  test('claude+local message keeps the original /gsd-new-project instruction', () => {
    const output = captureFinishInstallOutput('claude', false);

    assert.match(output, /\/gsd-new-project/, 'should still mention /gsd-new-project');
    assert.doesNotMatch(output, /restart claude code/i, 'local install does not require the skills restart note');
  });

  test('non-claude runtimes keep their original message format', () => {
    const output = captureFinishInstallOutput('opencode', true);

    assert.match(output, /Open a blank directory/, 'opencode message should be unchanged');
    assert.doesNotMatch(output, /restart/i, 'opencode message should not have the claude-specific restart note');
  });
});
