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

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

describe('bug #2557: Gemini/Antigravity local hooks use relative paths (not $CLAUDE_PROJECT_DIR)', () => {
  let src;

  before(() => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  test('localPrefix is a ternary that branches on Gemini/Antigravity', () => {
    assert.match(
      src,
      /const localPrefix\s*=\s*\(runtime\s*===\s*['"]gemini['"]/,
      'localPrefix must branch on runtime === "gemini"',
    );
  });

  test('Gemini/Antigravity branch of localPrefix uses bare dirName (relative path)', () => {
    // The ternary must assign `dirName` (not `"$CLAUDE_PROJECT_DIR"/` + dirName)
    // for the Gemini branch so hooks use a relative path on all platforms.
    assert.match(
      src,
      /const localPrefix\s*=\s*\(runtime\s*===\s*['"]gemini['"]\s*\|\|\s*runtime\s*===\s*['"]antigravity['"]\)\s*\n?\s*\?\s*dirName/,
      'Gemini/Antigravity branch must resolve to bare dirName',
    );
  });

  test('non-Gemini branch of localPrefix uses "$CLAUDE_PROJECT_DIR"/', () => {
    // The else branch must still use "$CLAUDE_PROJECT_DIR"/ to fix #1906 for
    // Claude Code and other runtimes that do set the variable.
    assert.match(
      src,
      /:\s*['"]\"\$CLAUDE_PROJECT_DIR\"\//,
      'non-Gemini branch must use "$CLAUDE_PROJECT_DIR"/ prefix',
    );
  });

  test('Gemini/Antigravity hook commands do not contain "$CLAUDE_PROJECT_DIR" literal', () => {
    // Since localPrefix is now dirName for Gemini/Antigravity, no command
    // string built via `localPrefix` should contain the variable literal.
    // We verify by checking that the only occurrence of $CLAUDE_PROJECT_DIR
    // in the localPrefix definition is in the non-Gemini (else) branch.
    const lines = src.split('\n');
    const prefixDefIdx = lines.findIndex(l => /const localPrefix\s*=/.test(l));
    assert.ok(prefixDefIdx >= 0, 'localPrefix definition not found');
    // The Gemini (truthy) branch is the line right after the ternary condition.
    // It must NOT contain $CLAUDE_PROJECT_DIR.
    const geminiLine = lines[prefixDefIdx + 1] || '';
    assert.ok(
      !geminiLine.includes('$CLAUDE_PROJECT_DIR'),
      'Gemini branch of localPrefix must not reference $CLAUDE_PROJECT_DIR',
    );
  });
});
