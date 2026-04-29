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

const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let computePathPrefix;

before(() => {
  process.env.GSD_TEST_MODE = '1';
  // Re-require fresh in case other tests already loaded it.
  delete require.cache[require.resolve('../bin/install.js')];
  ({ computePathPrefix } = require('../bin/install.js'));
});

after(() => {
  delete process.env.GSD_TEST_MODE;
});

describe('bug-2376: OpenCode on Windows must use absolute path, not $HOME', () => {
  test('computePathPrefix is exported by install.js', () => {
    assert.equal(typeof computePathPrefix, 'function');
  });

  test('OpenCode on Windows: pathPrefix is absolute (no $HOME substitution)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: true,
      isWindowsHost: true,
      resolvedTarget: 'C:/Users/user/.config/opencode',
      homeDir: 'C:/Users/user',
    });
    assert.strictEqual(pathPrefix, 'C:/Users/user/.config/opencode/');
    assert.ok(!pathPrefix.includes('$HOME'));
  });

  test('Claude Code on Windows: pathPrefix still uses $HOME (unaffected)', () => {
    const pathPrefix = computePathPrefix({
      isGlobal: true,
      isOpencode: false,
      isWindowsHost: true,
      resolvedTarget: 'C:/Users/user/.claude',
      homeDir: 'C:/Users/user',
    });
    assert.strictEqual(pathPrefix, '$HOME/.claude/');
  });
});
