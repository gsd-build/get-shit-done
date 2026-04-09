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
const fs = require('fs');
const path = require('path');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

// All hooks that the installer registers for local installs
const HOOKS = [
  'gsd-statusline.js',
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-workflow-guard.js',
  'gsd-validate-commit.sh',
  'gsd-session-state.sh',
  'gsd-phase-boundary.sh',
];

describe('bug #1906: local hook commands use $CLAUDE_PROJECT_DIR', () => {
  let src;

  before(() => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  test('localPrefix variable is defined with $CLAUDE_PROJECT_DIR', () => {
    assert.match(src, /const localPrefix\s*=\s*['"]\"\$CLAUDE_PROJECT_DIR['"]\s*\//,
      'localPrefix should be defined using $CLAUDE_PROJECT_DIR');
  });

  for (const hook of HOOKS) {
    test(`${hook} local command uses localPrefix (not bare dirName)`, () => {
      // Find all local command strings for this hook
      // The pattern is: `<runner> ' + localPrefix + '/hooks/<hook>'`
      // or the old broken pattern: `<runner> ' + dirName + '/hooks/<hook>'`
      const hookEscaped = hook.replace(/\./g, '\\.');
      const brokenPattern = new RegExp(
        `['"](?:node|bash)\\s['"]\\s*\\+\\s*dirName\\s*\\+\\s*['"]/hooks/${hookEscaped}['"]`
      );
      assert.ok(
        !brokenPattern.test(src),
        `${hook} must not use bare dirName — should use localPrefix for cwd-independent resolution`
      );
    });
  }

  test('no local hook command uses bare dirName + /hooks/', () => {
    // Broader check: no local (non-global) hook path should use dirName directly
    // The pattern `': '<runner> ' + dirName + '/hooks/'` is the broken form
    const lines = src.split('\n');
    const offenders = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match lines that build local hook commands with bare dirName
      if (/['"](?:node|bash)\s['"][^;]*\+\s*dirName\s*\+\s*['"]\/hooks\//.test(line)) {
        offenders.push(`line ${i + 1}: ${line.trim()}`);
      }
    }
    assert.equal(offenders.length, 0,
      'Found local hook commands using bare dirName instead of localPrefix:\n' +
      offenders.join('\n'));
  });
});
