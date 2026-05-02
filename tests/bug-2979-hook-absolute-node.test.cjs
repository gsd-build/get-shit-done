'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2979: Managed JS hooks fail in GUI/minimal-PATH runtimes because
 * the installer emits bare `node`.
 *
 * Reporter evidence: in a stripped PATH like /usr/bin:/bin:/usr/sbin:/sbin
 * (the default for Finder-launched/Antigravity-spawned processes on macOS),
 * `node` is not resolvable. Hook commands like
 *   `node "<HOME>/.gemini/hooks/gsd-check-update.js"`
 * fail with `/bin/sh: node: command not found` (exit 127).
 *
 * Fix: emit the absolute node path (`process.execPath`, the binary
 * running the installer itself) as the runner. Forward-slash-normalized
 * and double-quoted so it works on POSIX and Windows.
 *
 * This test exercises the public buildHookCommand surface plus the
 * resolveNodeRunner helper, asserting on structured records:
 *  - the runner field is an absolute path (not bare 'node')
 *  - it ends with /node or \\node (or .exe on Windows simulation)
 *  - .sh hooks still use bare 'bash' (POSIX std PATH always has /bin)
 *
 * No source-grep on install.js content — assertions go against the
 * value returned by the exported function and the parsed structure of
 * the emitted hook command (split into runner + args).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const INSTALL = require(path.join(__dirname, '..', 'bin', 'install.js'));
const { buildHookCommand, resolveNodeRunner } = INSTALL;

/**
 * Parse a hook command string into { runner, hookPath } structured
 * record. The shape is `<runner> "<hookPath>"` where <runner> may itself
 * be a quoted absolute path (containing spaces), so we split on the
 * trailing quoted-path token rather than the first space.
 */
function parseHookCommand(cmd) {
  // Trailing token: a double-quoted string ending the command.
  const m = cmd.match(/^(.+?)\s+"([^"]+)"\s*$/);
  if (!m) {
    return { runner: null, hookPath: null, raw: cmd };
  }
  return { runner: m[1], hookPath: m[2], raw: cmd };
}

describe('Bug #2979: resolveNodeRunner returns absolute, quoted, forward-slash node path', () => {
  test('exported as a function', () => {
    assert.equal(typeof resolveNodeRunner, 'function');
  });

  test('returns a double-quoted absolute path', () => {
    const runner = resolveNodeRunner();
    assert.ok(runner.startsWith('"'), `expected leading double-quote, got: ${runner}`);
    assert.ok(runner.endsWith('"'), `expected trailing double-quote, got: ${runner}`);
    const inner = runner.slice(1, -1);
    assert.ok(path.isAbsolute(inner.replace(/\//g, path.sep)), `expected absolute path, got: ${inner}`);
  });

  test('uses forward slashes (Windows-safe, matches buildHookCommand convention)', () => {
    const runner = resolveNodeRunner();
    assert.ok(!runner.includes('\\'), `expected forward slashes, got: ${runner}`);
  });

  test('points at a node binary (basename starts with "node")', () => {
    const runner = resolveNodeRunner();
    const inner = runner.slice(1, -1);
    const base = path.posix.basename(inner);
    assert.ok(/^node(\.exe)?$/i.test(base), `expected basename node or node.exe, got: ${base}`);
  });
});

describe('Bug #2979: buildHookCommand for .js hooks emits absolute node runner', () => {
  test('global install: .js hook uses absolute node path, not bare "node"', () => {
    const cmd = buildHookCommand('/tmp/.claude', 'gsd-check-update.js');
    const parsed = parseHookCommand(cmd);
    assert.notEqual(parsed.runner, null, `failed to parse: ${cmd}`);
    assert.notEqual(parsed.runner, 'node', `must not emit bare node (#2979): ${cmd}`);
    // The runner should be a quoted absolute path.
    assert.ok(parsed.runner.startsWith('"') && parsed.runner.endsWith('"'),
      `runner must be quoted absolute path, got: ${parsed.runner}`);
  });

  test('global install: .js hook command parses with hookPath at expected location', () => {
    const cmd = buildHookCommand('/tmp/.gemini', 'gsd-statusline.js');
    const parsed = parseHookCommand(cmd);
    assert.equal(parsed.hookPath, '/tmp/.gemini/hooks/gsd-statusline.js');
  });

  test('portableHooks global install: .js hook still uses absolute node (only the path is $HOME-relative)', () => {
    const home = require('node:os').homedir().replace(/\\/g, '/');
    const configDir = home + '/.gemini';
    const cmd = buildHookCommand(configDir, 'gsd-check-update.js', { portableHooks: true });
    const parsed = parseHookCommand(cmd);
    assert.notEqual(parsed.runner, 'node', `portableHooks must also use absolute node (#2979): ${cmd}`);
    assert.equal(parsed.hookPath, '$HOME/.gemini/hooks/gsd-check-update.js');
  });
});

describe('Bug #2979: buildHookCommand for .sh hooks still uses bare "bash" (POSIX std PATH always has /bin)', () => {
  test('.sh hook runner is exactly "bash" — bash is in /usr/bin:/bin and resolves under minimal PATH', () => {
    const cmd = buildHookCommand('/tmp/.claude', 'gsd-session-state.sh');
    const parsed = parseHookCommand(cmd);
    assert.equal(parsed.runner, 'bash');
  });
});

// ─── #3002 CR follow-up: legacy-bare-node migration ─────────────────────────

const { rewriteLegacyManagedNodeHookCommands } = INSTALL;

describe('Bug #2979 (#3002 CR): rewriteLegacyManagedNodeHookCommands rewrites bare-node managed hooks on reinstall', () => {
  test('exported as a function', () => {
    assert.equal(typeof rewriteLegacyManagedNodeHookCommands, 'function');
  });

  test('rewrites a managed hook entry that uses bare `node ` to the absolute runner', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [
            { type: 'command', command: 'node "/Users/x/.gemini/hooks/gsd-check-update.js"' },
          ],
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

  test('does NOT touch entries that already use a quoted absolute runner', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: '"/usr/local/bin/node" "/x/hooks/gsd-statusline.js"' }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });

  test('does NOT touch user-authored bare-node hooks (filename not in managed allowlist)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: 'node /home/me/my-custom-hook.js' }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });

  test('does NOT touch .sh hooks (they correctly use bare bash)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: 'bash "/x/hooks/gsd-session-state.sh"' }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false);
  });

  test('is a no-op when absoluteRunner is null (resolveNodeRunner failed)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: 'node "/x/hooks/gsd-check-update.js"' }],
        }],
      },
    };
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, null);
    assert.equal(changed, false);
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });
});

describe('Bug #2979 (#3002 CR): resolveNodeRunner returns null when execPath unavailable', () => {
  test('returns null instead of bare "node" when process.execPath is empty', () => {
    const orig = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', { value: '', configurable: true });
      const r = resolveNodeRunner();
      assert.equal(r, null, 'expected null, not bare "node"');
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });

  test('buildHookCommand returns null when execPath is unavailable (caller skips registration)', () => {
    const orig = process.execPath;
    try {
      Object.defineProperty(process, 'execPath', { value: '', configurable: true });
      const cmd = buildHookCommand('/tmp/.claude', 'gsd-statusline.js');
      assert.equal(cmd, null);
    } finally {
      Object.defineProperty(process, 'execPath', { value: orig, configurable: true });
    }
  });
});

// ─── #3002 CR follow-up #2: null-command guards in settings.json ──────────

describe('Bug #2979 (#3002 CR follow-up): registration sites guard on null command before push', () => {
  // The settings-mutation registration sites (configureSettings) check both
  // file existence AND that the resolved *Command variable is truthy before
  // calling settings.hooks.<event>.push({ type: 'command', command: cmd }).
  // Without the truthy guard, when resolveNodeRunner returns null, every
  // dependent *Command becomes null and we'd write `command: null` entries
  // that the runtime hook schema would reject. This test parses install.js
  // for each of the 6 managed JS hook push-site `if` clauses and asserts
  // the corresponding `&& <command>` guard is present.
  const fs = require('node:fs');
  const path = require('node:path');
  const installSrc = fs.readFileSync(
    path.join(__dirname, '..', 'bin', 'install.js'),
    'utf8',
  );

  // Each entry: the file-existence check we expect followed by the && <command>
  // guard we expect on the same `if` line. The check anchors on the file
  // variable name (e.g. checkUpdateFile) and the *Command variable name; the
  // guard token between them ensures both are required for registration.
  const guardSites = [
    { hook: 'gsd-check-update.js',           fileVar: 'checkUpdateFile',           cmdVar: 'updateCheckCommand' },
    { hook: 'gsd-context-monitor.js',        fileVar: 'contextMonitorFile',        cmdVar: 'contextMonitorCommand' },
    { hook: 'gsd-prompt-guard.js',           fileVar: 'promptGuardFile',           cmdVar: 'promptGuardCommand' },
    { hook: 'gsd-read-guard.js',             fileVar: 'readGuardFile',             cmdVar: 'readGuardCommand' },
    { hook: 'gsd-read-injection-scanner.js', fileVar: 'readInjectionScannerFile',  cmdVar: 'readInjectionScannerCommand' },
    { hook: 'gsd-workflow-guard.js',         fileVar: 'workflowGuardFile',         cmdVar: 'workflowGuardCommand' },
  ];

  for (const { hook, fileVar, cmdVar } of guardSites) {
    test(`${hook} registration if-clause includes && ${cmdVar} guard`, () => {
      // Match: `if (...fs.existsSync(<fileVar>) && <cmdVar>)`
      const pattern = new RegExp(
        `fs\\.existsSync\\(${fileVar}\\)\\s*&&\\s*${cmdVar}\\b`,
      );
      assert.ok(
        pattern.test(installSrc),
        `expected \`fs.existsSync(${fileVar}) && ${cmdVar}\` guard for ${hook} (#3002 CR)`,
      );
    });
  }

  test('statusline registration includes a null-command early-skip branch', () => {
    // The CR fix added an `else if (!statuslineCommand)` clause between the
    // local-skip guard and the `settings.statusLine = { ... }` write.
    // Match the structural shape: an else-if guard on !statuslineCommand
    // somewhere in the file. The clause's body content is allowed to vary;
    // the structural invariant is the guard itself.
    assert.ok(
      /else if \(!statuslineCommand\)/.test(installSrc),
      'expected `else if (!statuslineCommand)` guard somewhere in the statusline registration block (#3002 CR)',
    );
    // Verify the guard precedes the statusLine write (otherwise the guard
    // doesn't help). The statusLine write must come AFTER the !statuslineCommand
    // guard's location in the source.
    const guardIdx = installSrc.indexOf('else if (!statuslineCommand)');
    const writeIdx = installSrc.indexOf('settings.statusLine = {');
    assert.ok(
      guardIdx >= 0 && writeIdx > guardIdx,
      `statusLine write at ${writeIdx} must come after !statuslineCommand guard at ${guardIdx}`,
    );
  });
});
