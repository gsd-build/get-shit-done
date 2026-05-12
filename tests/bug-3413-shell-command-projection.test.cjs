'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const projection = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const install = require(path.join(__dirname, '..', 'bin', 'install.js'));

const {
  hookCommandNeedsPowerShellCallOperator,
  formatHookCommandForRuntime,
  isManagedHookBasename,
  projectLocalHookPrefix,
  projectLegacySettingsHookCommand,
  projectPortableHookBaseDir,
} = projection;
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

describe('bug #3439: shell projection module owns managed-hook policy and legacy rewrite projection', () => {
  test('isManagedHookBasename is surface-aware', () => {
    assert.equal(isManagedHookBasename('/x/hooks/gsd-check-update.js', { surface: 'settings-json' }), true);
    assert.equal(isManagedHookBasename('/x/hooks/gsd-statusline.js', { surface: 'settings-json' }), true);
    assert.equal(isManagedHookBasename('/x/hooks/gsd-statusline.js', { surface: 'codex-toml' }), false);
    assert.equal(isManagedHookBasename('/x/hooks/custom-hook.js', { surface: 'settings-json' }), false);
  });

  test('projectLegacySettingsHookCommand preserves non-Windows script token shape', () => {
    const command = projectLegacySettingsHookCommand({
      absoluteRunner: '"/usr/local/bin/node"',
      scriptPath: '/x/hooks/gsd-statusline.js',
      scriptToken: "'/x/hooks/gsd-statusline.js'",
      platform: 'linux',
      runtime: 'claude',
    });
    assert.equal(command, `"/usr/local/bin/node" '/x/hooks/gsd-statusline.js'`);
  });

  test('projectLegacySettingsHookCommand normalizes Windows managed paths and runtime wrapper policy', () => {
    const command = projectLegacySettingsHookCommand({
      absoluteRunner: '"C:/nvm4w/nodejs/node.exe"',
      scriptPath: 'C:\\Users\\me\\.gemini\\hooks\\gsd-prompt-guard.js',
      scriptToken: "'C:\\Users\\me\\.gemini\\hooks\\gsd-prompt-guard.js'",
      platform: 'win32',
      runtime: 'gemini',
    });
    assert.equal(command, '& "C:/nvm4w/nodejs/node.exe" "C:/Users/me/.gemini/hooks/gsd-prompt-guard.js"');
  });

  test('projectLocalHookPrefix centralizes runtime-specific project-dir interpolation policy', () => {
    assert.equal(projectLocalHookPrefix({ runtime: 'gemini', dirName: '.gemini' }), '.gemini');
    assert.equal(projectLocalHookPrefix({ runtime: 'antigravity', dirName: '.agent' }), '.agent');
    assert.equal(
      projectLocalHookPrefix({ runtime: 'claude', dirName: '.claude' }),
      '"$CLAUDE_PROJECT_DIR"/.claude',
    );
  });

  test('projectPortableHookBaseDir centralizes $HOME interpolation policy', () => {
    assert.equal(
      projectPortableHookBaseDir({
        configDir: '/Users/me/.claude',
        homeDir: '/Users/me',
      }),
      '$HOME/.claude',
    );
    assert.equal(
      projectPortableHookBaseDir({
        configDir: 'C:\\Users\\me\\.claude',
        homeDir: 'C:\\Users\\me',
      }),
      '$HOME/.claude',
    );
    assert.equal(
      projectPortableHookBaseDir({
        configDir: '/opt/custom/.claude',
        homeDir: '/Users/me',
      }),
      '/opt/custom/.claude',
    );
  });
});
