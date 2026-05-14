/**
 * Regression tests for bug #1906
 *
 * Local installs must anchor hook command paths to $CLAUDE_PROJECT_DIR so
 * hooks resolve correctly regardless of the shell's current working directory.
 *
 * The original bug: local install hook commands used bare relative paths like
 * `node .claude/hooks/gsd-context-monitor.js`. Claude Code persists the bash
 * tool's cwd between calls, so a single `cd subdir && …` early in a session
 * permanently broke every hook for the rest of that session.
 *
 * The fix prefixes all local hook commands with "$CLAUDE_PROJECT_DIR"/ so
 * path resolution is always anchored to the project root.
 */

'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const projection = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const { projectLocalHookPrefix, projectShellCommandText } = projection;

describe('bug #1906: local hook commands use $CLAUDE_PROJECT_DIR', () => {
  before(() => {
    assert.equal(typeof projectLocalHookPrefix, 'function');
    assert.equal(typeof projectShellCommandText, 'function');
  });

  test('non-Gemini runtimes get $CLAUDE_PROJECT_DIR anchored local prefix', () => {
    const prefix = projectLocalHookPrefix({ runtime: 'claude', dirName: '.claude' });
    assert.equal(prefix, '"$CLAUDE_PROJECT_DIR"/.claude');
  });

  test('local command projection for non-Gemini keeps $CLAUDE_PROJECT_DIR anchor', () => {
    const prefix = projectLocalHookPrefix({ runtime: 'claude', dirName: '.claude' });
    const command = projectShellCommandText({
      runnerToken: '"/usr/local/bin/node"',
      argTokens: [`${prefix}/hooks/gsd-context-monitor.js`],
      runtime: 'claude',
      platform: 'linux',
    });
    assert.equal(
      command,
      '"/usr/local/bin/node" "$CLAUDE_PROJECT_DIR"/.claude/hooks/gsd-context-monitor.js',
    );
  });
});
