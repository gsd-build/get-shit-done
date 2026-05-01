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
