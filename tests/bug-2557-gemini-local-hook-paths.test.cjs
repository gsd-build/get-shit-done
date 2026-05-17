'use strict';

/**
 * Bug #2557: Gemini CLI local hook commands must NOT use $CLAUDE_PROJECT_DIR.
 *
 * $CLAUDE_PROJECT_DIR is a Claude Code-specific env variable. Gemini CLI does
 * not set it. On Windows, Gemini's own variable-substitution + path-join logic
 * produced a doubled path like `D:\Projects\GSD\'D:\Projects\GSD'`, causing
 * every local project hook to fail at SessionStart.
 *
 * Fix: localPrefix is now runtime-conditional. Gemini/Antigravity use bare
 * dirName (relative path) since they always run project hooks with the project
 * dir as cwd. Claude Code and others still use "$CLAUDE_PROJECT_DIR"/ (#1906).
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projection = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const { projectLocalHookPrefix, projectShellCommandText } = projection;

describe('bug #2557: Gemini/Antigravity local hooks use relative paths (not $CLAUDE_PROJECT_DIR)', () => {
  test('Gemini local prefix is bare dirName', () => {
    assert.equal(projectLocalHookPrefix({ runtime: 'gemini', dirName: '.gemini' }), '.gemini');
  });

  test('Antigravity local prefix is bare dirName', () => {
    assert.equal(projectLocalHookPrefix({ runtime: 'antigravity', dirName: '.agent' }), '.agent');
  });

  test('non-Gemini local prefix remains $CLAUDE_PROJECT_DIR anchored', () => {
    assert.equal(
      projectLocalHookPrefix({ runtime: 'claude', dirName: '.claude' }),
      '"$CLAUDE_PROJECT_DIR"/.claude',
    );
  });

  test('Gemini local command projection does not contain "$CLAUDE_PROJECT_DIR"', () => {
    const prefix = projectLocalHookPrefix({ runtime: 'gemini', dirName: '.gemini' });
    const command = projectShellCommandText({
      runnerToken: '"/usr/local/bin/node"',
      argTokens: [`${prefix}/hooks/gsd-check-update.js`],
      runtime: 'gemini',
      platform: 'linux',
    });
    assert.ok(
      !command.includes('$CLAUDE_PROJECT_DIR'),
      'Gemini local command must not include $CLAUDE_PROJECT_DIR',
    );
  });
});
