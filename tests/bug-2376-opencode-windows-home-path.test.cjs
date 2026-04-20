/**
 * Regression test for #2376: @$HOME not correctly mapped in OpenCode on Windows.
 *
 * On Windows, $HOME is not expanded by PowerShell/cmd.exe, so OpenCode cannot
 * resolve @$HOME/... file references in installed command files.
 *
 * Fix: install.js must use the absolute path (not $HOME-relative) when installing
 * for OpenCode on Windows.
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

  test('install.js pathPrefix computation skips $HOME for OpenCode on Windows', () => {
    const content = fs.readFileSync(INSTALL_JS_PATH, 'utf-8');

    // The fix must include a Windows detection condition for OpenCode
    const hasWindowsOpenCodeGuard = (
      content.includes('isWindowsHost') ||
      (content.includes("'win32'") && content.includes('isOpencode') && content.includes('pathPrefix'))
    );
    assert.ok(
      hasWindowsOpenCodeGuard,
      'install.js must include a Windows platform guard for OpenCode pathPrefix computation'
    );
  });

  test('install.js pathPrefix guard excludes $HOME for OpenCode+Windows combination', () => {
    const content = fs.readFileSync(INSTALL_JS_PATH, 'utf-8');

    // The pathPrefix assignment must include a guard that prevents $HOME substitution
    // for OpenCode on Windows (process.platform === 'win32').
    const pathPrefixBlock = content.match(/const pathPrefix[\s\S]{0,500}resolvedTarget/);
    assert.ok(pathPrefixBlock, 'pathPrefix assignment block should be present');

    const block = pathPrefixBlock[0];
    const excludesOpenCodeWindows = (
      block.includes('isWindowsHost') ||
      (block.includes('isOpencode') && block.includes('win32'))
    );
    assert.ok(
      excludesOpenCodeWindows,
      'pathPrefix computation must exclude $HOME substitution for OpenCode on Windows'
    );
  });

  test('pathPrefix simulation: OpenCode on Windows uses absolute path', () => {
    // Simulate the fixed pathPrefix computation for Windows+OpenCode
    const isGlobal = true;
    const isOpencode = true;
    const isWindowsHost = true; // simulated Windows
    const resolvedTarget = 'C:/Users/user/.config/opencode';
    const homeDir = 'C:/Users/user';

    const pathPrefix = isGlobal && resolvedTarget.startsWith(homeDir) && !(isOpencode && isWindowsHost)
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : `${resolvedTarget}/`;

    assert.strictEqual(
      pathPrefix,
      'C:/Users/user/.config/opencode/',
      'OpenCode on Windows should use absolute path, not $HOME-relative'
    );
    assert.ok(
      !pathPrefix.includes('$HOME'),
      'OpenCode on Windows pathPrefix must not contain $HOME'
    );
  });

  test('pathPrefix simulation: OpenCode on Linux/macOS still uses $HOME', () => {
    // Non-Windows OpenCode should still use $HOME (POSIX shells expand it)
    const isGlobal = true;
    const isOpencode = true;
    const isWindowsHost = false; // simulated Linux/macOS
    const homeDir = '/home/user';
    const resolvedTarget = '/home/user/.config/opencode';

    const pathPrefix = isGlobal && resolvedTarget.startsWith(homeDir) && !(isOpencode && isWindowsHost)
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : `${resolvedTarget}/`;

    assert.strictEqual(
      pathPrefix,
      '$HOME/.config/opencode/',
      'OpenCode on Linux/macOS should still use $HOME-relative path'
    );
  });

  test('pathPrefix simulation: Claude Code on Windows still uses $HOME (unaffected)', () => {
    // Claude Code on Windows is handled by Claude Code's own shell, which expands $HOME
    const isGlobal = true;
    const isOpencode = false; // Claude Code, not OpenCode
    const isWindowsHost = true;
    const homeDir = 'C:/Users/user';
    const resolvedTarget = 'C:/Users/user/.claude';

    const pathPrefix = isGlobal && resolvedTarget.startsWith(homeDir) && !(isOpencode && isWindowsHost)
      ? '$HOME' + resolvedTarget.slice(homeDir.length) + '/'
      : `${resolvedTarget}/`;

    assert.strictEqual(
      pathPrefix,
      '$HOME/.claude/',
      'Claude Code on Windows should still use $HOME-relative path (Claude Code handles this)'
    );
  });
});
