/**
 * Regression test for #2376: @$HOME not correctly mapped in OpenCode on Windows.
 *
 * On Windows, $HOME is not expanded by PowerShell/cmd.exe, so OpenCode cannot
 * resolve @$HOME/... file references in installed command files.
 *
 * Fix: install.js must use the absolute path (not $HOME-relative) when installing
 * for OpenCode. (Generalized to all platforms in #2831 — OpenCode `@file`
 * references are not shell-expanded on any platform.)
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INSTALL_JS_PATH = path.join(__dirname, '..', 'bin', 'install.js');

describe('bug-2376: OpenCode on Windows must use absolute path, not $HOME', () => {
  test('install.js exists', () => {
    assert.ok(fs.existsSync(INSTALL_JS_PATH), 'bin/install.js should exist');
  });

  test('install.js pathPrefix excludes $HOME for OpenCode (generalized in #2831)', () => {
    const content = fs.readFileSync(INSTALL_JS_PATH, 'utf-8');

    // The pathPrefix assignment must include an isOpencode guard that prevents
    // $HOME substitution. #2376 added a Windows-only guard; #2831 generalized it
    // to all platforms because OpenCode never expands $HOME in `@file` refs.
    const pathPrefixBlock = content.match(/const pathPrefix[\s\S]*?resolvedTarget\.slice\(homeDir\.length\)/);
    assert.ok(pathPrefixBlock, 'pathPrefix assignment block should be present');

    const block = pathPrefixBlock[0];
    assert.ok(
      block.includes('isOpencode'),
      'pathPrefix computation must include isOpencode guard'
    );
  });

  test('pathPrefix simulation: OpenCode on Windows uses absolute path', () => {
    const isGlobal = true;
    const isOpencode = true;
    const resolvedTarget = 'C:/Users/user/.config/opencode';
    const homeDir = 'C:/Users/user';

    const pathPrefix = isGlobal && resolvedTarget.startsWith(homeDir) && !isOpencode
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : `${resolvedTarget}/`;

    assert.strictEqual(pathPrefix, 'C:/Users/user/.config/opencode/');
    assert.ok(!pathPrefix.includes('$HOME'));
  });

  test('pathPrefix simulation: Claude Code on Windows still uses $HOME (unaffected)', () => {
    const isGlobal = true;
    const isOpencode = false; // Claude Code
    const homeDir = 'C:/Users/user';
    const resolvedTarget = 'C:/Users/user/.claude';

    const pathPrefix = isGlobal && resolvedTarget.startsWith(homeDir) && !isOpencode
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : `${resolvedTarget}/`;

    assert.strictEqual(pathPrefix, '$HOME/.claude/');
  });
});
