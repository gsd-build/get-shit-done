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

  // #3002 CR: substring containment was a false-positive vector.
  // User-authored hooks whose path happened to CONTAIN a managed filename
  // as a substring would get unconditionally rewritten with the GSD runner.
  // The fix matches by basename equality.
  test('does NOT rewrite a user hook whose path contains a managed filename as a substring', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{
            type: 'command',
            // Path contains gsd-check-update.js as substring of a longer
            // filename, but is NOT actually that file.
            command: 'node /home/me/scripts/wraps-gsd-check-update.js-helper.js',
          }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const before = settings.hooks.SessionStart[0].hooks[0].command;
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, false, 'must not rewrite user hooks with managed-filename-as-substring paths');
    assert.equal(settings.hooks.SessionStart[0].hooks[0].command, before);
  });

  test('rewrites a managed entry whose path is quoted with single quotes', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: "node '/x/hooks/gsd-statusline.js'" }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true);
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      `"/usr/local/bin/node" '/x/hooks/gsd-statusline.js'`,
    );
  });

  test('rewrites a managed entry with no path quoting (bareword)', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: 'node /x/hooks/gsd-context-monitor.js' }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true);
    assert.equal(
      settings.hooks.SessionStart[0].hooks[0].command,
      '"/usr/local/bin/node" /x/hooks/gsd-context-monitor.js',
    );
  });

  test('handles Windows-style backslash path separators when extracting basename', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [{ type: 'command', command: 'node "C:\\\\Users\\\\me\\\\.claude\\\\hooks\\\\gsd-prompt-guard.js"' }],
        }],
      },
    };
    const runner = '"/usr/local/bin/node"';
    const changed = rewriteLegacyManagedNodeHookCommands(settings, runner);
    assert.equal(changed, true);
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

const { validateHookFields } = INSTALL;

describe('Bug #2979 (#3002 CR follow-up): no command:null hook entries survive serialization', () => {
  // CR feedback: assert structurally on the resulting settings object, not by
  // grepping bin/install.js source. The push-site guards (each `if` clause's
  // `&& <command>` token) skip null-command pushes at the source. As a
  // backstop, install.js now runs validateHookFields(settings) right before
  // writeSettings; this test exercises that backstop directly.
  //
  // Construct a settings object that contains exactly the kind of null-command
  // entries that the registration code would have written if my push-site
  // guards regressed. Run validateHookFields on it. Assert the null entries
  // are gone and the well-formed entries survive.

  function nullCommandEntry(matcher) {
    const entry = { hooks: [{ type: 'command', command: null }] };
    if (matcher) entry.matcher = matcher;
    return entry;
  }
  function realCommandEntry(matcher, command) {
    const entry = { hooks: [{ type: 'command', command }] };
    if (matcher) entry.matcher = matcher;
    return entry;
  }

  const MANAGED_JS_HOOKS = [
    { event: 'SessionStart',  matcher: undefined,                                       label: 'gsd-check-update.js' },
    { event: 'PostToolUse',   matcher: 'Bash|Edit|Write|MultiEdit|Agent|Task',          label: 'gsd-context-monitor.js' },
    { event: 'PreToolUse',    matcher: 'Write|Edit',                                    label: 'gsd-prompt-guard.js' },
    { event: 'PreToolUse',    matcher: 'Write|Edit',                                    label: 'gsd-read-guard.js' },
    { event: 'PostToolUse',   matcher: 'Read',                                          label: 'gsd-read-injection-scanner.js' },
    { event: 'PreToolUse',    matcher: 'Bash|Edit|Write|MultiEdit',                     label: 'gsd-workflow-guard.js' },
  ];

  for (const { event, matcher, label } of MANAGED_JS_HOOKS) {
    test(`validateHookFields strips a null-command ${label} entry from settings.hooks.${event}`, () => {
      const settings = {
        hooks: {
          [event]: [
            nullCommandEntry(matcher),
            realCommandEntry(matcher, '"/usr/local/bin/node" "/x/hooks/other.js"'),
          ],
        },
      };
      const out = validateHookFields(settings);
      const survivors = out.hooks[event] || [];
      // The well-formed entry must remain.
      assert.equal(survivors.length, 1, `expected the real-command entry to survive`);
      // No survivor entry contains a hook with command === null.
      for (const e of survivors) {
        for (const h of e.hooks || []) {
          assert.notEqual(h.command, null, 'no surviving hook should have command:null');
        }
      }
    });
  }

  test('validateHookFields drops the entry entirely when all its hooks have null commands', () => {
    const settings = {
      hooks: {
        SessionStart: [nullCommandEntry()],
      },
    };
    const out = validateHookFields(settings);
    // Empty event arrays should be cleaned up (the entire SessionStart key
    // gets removed when nothing valid remains).
    assert.ok(
      !out.hooks.SessionStart || out.hooks.SessionStart.length === 0,
      'expected SessionStart to be empty/removed after the only entry was dropped',
    );
  });

  test('validateHookFields preserves agent-type hooks while stripping command:null sibling hooks', () => {
    const settings = {
      hooks: {
        SessionStart: [{
          hooks: [
            { type: 'command', command: null },
            { type: 'agent', prompt: 'analyze the session' },
            { type: 'command', command: '"/usr/local/bin/node" "/x/hooks/y.js"' },
          ],
        }],
      },
    };
    const out = validateHookFields(settings);
    const survivors = out.hooks.SessionStart[0].hooks;
    assert.equal(survivors.length, 2, 'expected 2 of 3 hooks to survive (the null-command one is stripped)');
    assert.equal(survivors.find(h => h.command === null), undefined, 'no surviving hook should have command:null');
  });
});
