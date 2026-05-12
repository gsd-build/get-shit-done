'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projection = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const install = require(path.join(__dirname, '..', 'bin', 'install.js'));

const { hookCommandNeedsPowerShellCallOperator, formatHookCommandForRuntime } = projection;
const { buildHookCommand, rewriteLegacyManagedNodeHookCommands } = install;

describe('bug #3413: Shell Command Projection Module uses runtime-aware hook policy', () => {
  test('Gemini on Windows requires PowerShell call operator', () => {
    assert.equal(
      hookCommandNeedsPowerShellCallOperator({ platform: 'win32', runtime: 'gemini' }),
      true,
    );
    assert.equal(
      formatHookCommandForRuntime('"C:/node.exe" "C:/hook.js"', { platform: 'win32', runtime: 'gemini' }),
      '& "C:/node.exe" "C:/hook.js"',
    );
  });

  test('Claude on Windows stays shell-neutral', () => {
    assert.equal(
      hookCommandNeedsPowerShellCallOperator({ platform: 'win32', runtime: 'claude' }),
      false,
    );
    assert.equal(
      formatHookCommandForRuntime('"C:/node.exe" "C:/hook.js"', { platform: 'win32', runtime: 'claude' }),
      '"C:/node.exe" "C:/hook.js"',
    );
  });

  test('runtime omitted stays conservative (no PowerShell prefix)', () => {
    assert.equal(
      formatHookCommandForRuntime('"C:/node.exe" "C:/hook.js"', { platform: 'win32' }),
      '"C:/node.exe" "C:/hook.js"',
    );
  });
});

describe('bug #3413: installer hook surfaces consume runtime-aware projection', () => {
  test('buildHookCommand emits shell-neutral Claude hook command on Windows', () => {
    const cmd = buildHookCommand('C:/Users/me/.claude', 'gsd-check-update.js', {
      platform: 'win32',
      runtime: 'claude',
    });
    assert.equal(cmd.startsWith('& '), false, `Claude hook command must not use PowerShell prefix: ${cmd}`);
  });

  test('rewriteLegacyManagedNodeHookCommands removes stale PowerShell prefix for Claude on Windows', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: '& "/usr/local/bin/node" "C:/Users/me/.claude/hooks/gsd-check-update.js"' }],
        }],
      },
    };
    const changed = rewriteLegacyManagedNodeHookCommands(settings, '"/usr/local/bin/node"', {
      platform: 'win32',
      runtime: 'claude',
    });
    assert.equal(changed, true);
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      '"/usr/local/bin/node" "C:/Users/me/.claude/hooks/gsd-check-update.js"',
    );
  });
});
