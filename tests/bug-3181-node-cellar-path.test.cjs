'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #3181: `resolveNodeRunner()` bakes versioned Homebrew Cellar paths
 * (e.g. `/usr/local/Cellar/node/25.8.1/bin/node`) into hook commands in
 * `~/.claude/settings.json`. After `brew upgrade node` the Cellar binary
 * fails with `dyld: Library not loaded` because shared libraries have
 * changed SOVERSION.
 *
 * Fix: prefer the stable Homebrew symlinks (`/usr/local/bin/node` for Intel
 * Macs, `/opt/homebrew/bin/node` for Apple Silicon) when a Cellar path is
 * detected. Non-Homebrew paths (NVM, system node, Windows, etc.) are
 * returned unchanged.
 *
 * Also: `rewriteLegacyManagedNodeHookCommands()` must normalize Cellar paths
 * baked into existing hook commands so reinstall doesn't re-bake them.
 *
 * All assertions go against exported function return values — no source-grep.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const INSTALL = require(path.join(__dirname, '..', 'bin', 'install.js'));
const { normalizeNodePath, resolveNodeRunner, rewriteLegacyManagedNodeHookCommands } = INSTALL;

// ─── normalizeNodePath ────────────────────────────────────────────────────────

describe('Bug #3181: normalizeNodePath — exported as a function', () => {
  test('normalizeNodePath is exported', () => {
    assert.equal(typeof normalizeNodePath, 'function');
  });
});

describe('Bug #3181: normalizeNodePath — Intel Homebrew Cellar paths → /usr/local/bin/node', () => {
  test('simple versioned Intel Cellar path', () => {
    const result = normalizeNodePath('/usr/local/Cellar/node/25.8.1/bin/node');
    assert.equal(result, '/usr/local/bin/node');
  });

  test('Intel Cellar path with long semver', () => {
    const result = normalizeNodePath('/usr/local/Cellar/node/20.11.0/bin/node');
    assert.equal(result, '/usr/local/bin/node');
  });

  test('Intel Cellar path with prerelease version segment', () => {
    const result = normalizeNodePath('/usr/local/Cellar/node/22.0.0-rc.1/bin/node');
    assert.equal(result, '/usr/local/bin/node');
  });

  test('Intel versioned formula Cellar path (node@20) maps to stable symlink', () => {
    const result = normalizeNodePath('/usr/local/Cellar/node@20/20.11.0/bin/node');
    assert.equal(result, '/usr/local/bin/node');
  });
});

describe('Bug #3181: normalizeNodePath — Apple Silicon Homebrew Cellar paths → /opt/homebrew/bin/node', () => {
  test('simple versioned Apple Silicon Cellar path', () => {
    const result = normalizeNodePath('/opt/homebrew/Cellar/node/25.8.1/bin/node');
    assert.equal(result, '/opt/homebrew/bin/node');
  });

  test('Apple Silicon Cellar path with another version', () => {
    const result = normalizeNodePath('/opt/homebrew/Cellar/node/18.20.4/bin/node');
    assert.equal(result, '/opt/homebrew/bin/node');
  });

  test('Apple Silicon versioned formula Cellar path (node@18) maps to stable symlink', () => {
    const result = normalizeNodePath('/opt/homebrew/Cellar/node@18/18.20.4/bin/node');
    assert.equal(result, '/opt/homebrew/bin/node');
  });
});

describe('Bug #3181: normalizeNodePath — non-Homebrew paths are returned unchanged', () => {
  test('NVM path is unchanged', () => {
    const nvm = '/Users/dev/.nvm/versions/node/v20.11.0/bin/node';
    assert.equal(normalizeNodePath(nvm), nvm);
  });

  test('already-stable Intel Homebrew symlink is unchanged', () => {
    assert.equal(normalizeNodePath('/usr/local/bin/node'), '/usr/local/bin/node');
  });

  test('already-stable Apple Silicon Homebrew symlink is unchanged', () => {
    assert.equal(normalizeNodePath('/opt/homebrew/bin/node'), '/opt/homebrew/bin/node');
  });

  test('system node (/usr/bin/node) is unchanged', () => {
    assert.equal(normalizeNodePath('/usr/bin/node'), '/usr/bin/node');
  });

  test('Windows path is unchanged', () => {
    const win = 'C:\\Program Files\\nodejs\\node.exe';
    assert.equal(normalizeNodePath(win), win);
  });

  test('empty string is returned as-is', () => {
    assert.equal(normalizeNodePath(''), '');
  });

  test('null is returned as-is', () => {
    assert.equal(normalizeNodePath(null), null);
  });
});

// ─── resolveNodeRunner ────────────────────────────────────────────────────────

describe('Bug #3181: resolveNodeRunner — maps Cellar execPath to stable symlink', () => {
  test('Intel Cellar execPath → stable symlink quoted token', () => {
    const orig = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', {
        value: '/usr/local/Cellar/node/25.8.1/bin/node',
        configurable: true,
      });
      const runner = resolveNodeRunner();
      assert.equal(runner, '"/usr/local/bin/node"',
        `expected stable Intel symlink, got: ${runner}`);
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });

  test('Apple Silicon Cellar execPath → stable symlink quoted token', () => {
    const orig = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', {
        value: '/opt/homebrew/Cellar/node/25.8.1/bin/node',
        configurable: true,
      });
      const runner = resolveNodeRunner();
      assert.equal(runner, '"/opt/homebrew/bin/node"',
        `expected stable Apple Silicon symlink, got: ${runner}`);
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });

  test('non-Homebrew execPath is returned as a quoted absolute path unchanged', () => {
    const orig = process.execPath;
    const nvmPath = '/Users/dev/.nvm/versions/node/v20.11.0/bin/node';
    try {
      Object.defineProperty(process, 'execPath', { value: nvmPath, configurable: true });
      const runner = resolveNodeRunner();
      assert.equal(runner, JSON.stringify(nvmPath));
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });

  test('returns null when execPath is empty (existing null-guard is preserved)', () => {
    const orig = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', { value: '', configurable: true });
      assert.equal(resolveNodeRunner(), null);
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });
});

// ─── rewriteLegacyManagedNodeHookCommands — Cellar runner rewrite ─────────────

describe('Bug #3181: rewriteLegacyManagedNodeHookCommands — rewrites baked Cellar runner to stable symlink', () => {
  test('Intel Cellar runner in a managed hook is rewritten to the stable symlink', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            command: '"/usr/local/Cellar/node/25.8.1/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
          }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true, 'expected rewrite to occur');
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      '"/usr/local/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
    );
  });

  test('Apple Silicon Cellar runner in a managed hook is rewritten to the stable symlink', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            command: '"/opt/homebrew/Cellar/node/25.8.1/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
          }],
        }],
      },
    };
    const runner = '"/opt/homebrew/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true, 'expected rewrite to occur');
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      '"/opt/homebrew/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
    );
  });

  test('a hook already using the stable runner is NOT rewritten (no churn)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            command: '"/usr/local/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
          }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false, 'already-stable entry must not be touched');
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });

  test('a user hook using a Cellar runner but an unmanaged filename is NOT rewritten', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            command: '"/usr/local/Cellar/node/25.8.1/bin/node" "/Users/x/my-custom-hook.js"',
          }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false, 'unmanaged hooks with Cellar runner must not be touched');
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });

  // Existing bare-node rewrite still works alongside the new Cellar rewrite
  test('bare `node` managed hook is still rewritten (existing #2979 behaviour preserved)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            command: 'node "/Users/x/.gemini/hooks/gsd-check-update.js"',
          }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true);
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      '"/usr/local/bin/node" "/Users/x/.gemini/hooks/gsd-check-update.js"',
    );
  });
});
