'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #3017: Codex SessionStart hook still emits bare `node` after #3002.
 *
 * PR #3002 fixed #2979 for settings.json-based managed JS hooks (Claude
 * Code, Gemini, Antigravity) by routing through buildHookCommand() →
 * resolveNodeRunner(), which emits the absolute Node binary path. But the
 * Codex install path writes its SessionStart hook directly into a
 * config.toml string, bypassing both helpers:
 *
 *   command = "node ${updateCheckScript}"
 *
 * Under a GUI/minimal PATH (`/usr/bin:/bin:/usr/sbin:/sbin`) where node
 * is not resolvable, the hook fails with `/bin/sh: node: command not
 * found` (exit 127). The same failure mode #2979 was meant to fix —
 * just on the codex toml branch instead of the settings.json branch.
 *
 * The fix exposes two pure helpers and tests them as typed records,
 * not by grepping install.js content:
 *
 *   buildCodexHookBlock(targetDir, { absoluteRunner }) → toml string
 *     - emits `command = "<absoluteRunner> <quoted hook path>"` so the
 *       hook resolves under minimal PATH.
 *     - returns null when absoluteRunner is null (caller skips with warn,
 *       matching settings.json branch behavior).
 *
 *   rewriteLegacyCodexHookBlock(tomlContent, absoluteRunner) → { content, changed }
 *     - rewrites an existing bare-node managed-hook command on reinstall
 *       (matches the rewriteLegacyManagedNodeHookCommands shape from #3002).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const INSTALL = require(path.join(__dirname, '..', 'bin', 'install.js'));
const { buildCodexHookBlock, rewriteLegacyCodexHookBlock, resolveNodeRunner } = INSTALL;

/**
 * Parse the toml hook block into a typed record so tests can assert on
 * the structured shape (what's the runner, what's the hook path, what's
 * the type) rather than substring-matching the toml text.
 */
function parseCodexHookBlock(block) {
  if (!block) return { ok: false, reason: 'empty' };
  // The block always carries the "# GSD Hooks" marker, the AoT tables,
  // a type=command, and a command="<runner> <quoted-hook-path>" line.
  const hasMarker = /^# GSD Hooks$/m.test(block);
  const hasEvent = /^\[\[hooks\.SessionStart\]\]$/m.test(block);
  const hasHandler = /^\[\[hooks\.SessionStart\.hooks\]\]$/m.test(block);
  const typeMatch = block.match(/^type\s*=\s*"([^"]+)"$/m);
  // command = "<runner> <hookpath>" — runner may itself be a quoted absolute path.
  // Match the whole RHS as one toml double-quoted string, then split into runner + hookpath.
  const cmdLine = block.match(/^command\s*=\s*"((?:[^"\\]|\\.)*)"$/m);
  if (!cmdLine) return { ok: false, reason: 'no command line' };
  const cmdValue = cmdLine[1];
  // Inside the command value, the runner is either a quoted string (escaped \" in toml)
  // or a bare token, followed by a space and the hook path (quoted).
  // toml escapes interior " as \", so the cmdValue contains literal \" sequences.
  const cmdParsed = cmdValue.match(/^(\\".+?\\"|node|bash|\S+)\s+\\"([^\\]+)\\"\s*$/);
  return {
    ok: true,
    hasMarker,
    hasEvent,
    hasHandler,
    type: typeMatch ? typeMatch[1] : null,
    command: cmdValue,
    runner: cmdParsed ? cmdParsed[1] : null,
    hookPath: cmdParsed ? cmdParsed[2] : null,
  };
}

describe('Bug #3017: buildCodexHookBlock emits absolute node runner', () => {
  test('exported as a function', () => {
    assert.equal(typeof buildCodexHookBlock, 'function');
  });

  test('emits an absolute, quoted node runner (not bare "node")', () => {
    const targetDir = '/tmp/codex-test/.codex';
    const absoluteRunner = '"/usr/local/bin/node"';
    const block = buildCodexHookBlock(targetDir, { absoluteRunner });
    const parsed = parseCodexHookBlock(block);
    assert.equal(parsed.ok, true, `parse failed: ${block}`);
    assert.equal(parsed.hasMarker, true, '# GSD Hooks marker present');
    assert.equal(parsed.hasEvent, true, '[[hooks.SessionStart]] AoT entry present');
    assert.equal(parsed.hasHandler, true, '[[hooks.SessionStart.hooks]] handler entry present');
    assert.equal(parsed.type, 'command', 'handler is type=command');
    // Strict: runner is the absolute node path, not bare "node".
    assert.notEqual(parsed.runner, 'node', `must not emit bare node (#3017): ${block}`);
    assert.ok(parsed.runner && parsed.runner.includes('/node'),
      `runner must reference an absolute node binary: ${parsed.runner}`);
    assert.ok(parsed.hookPath && parsed.hookPath.endsWith('/hooks/gsd-check-update.js'),
      `hook path must point at gsd-check-update.js: ${parsed.hookPath}`);
  });

  test('returns null when absoluteRunner is null (caller skips registration)', () => {
    const block = buildCodexHookBlock('/tmp/x/.codex', { absoluteRunner: null });
    assert.equal(block, null,
      'must return null on missing runner so caller can warn-and-skip instead of writing a broken hook');
  });

  test('integrates with resolveNodeRunner() in the live process', () => {
    const runner = resolveNodeRunner();
    assert.ok(runner, 'resolveNodeRunner returns a usable value in this test env');
    const block = buildCodexHookBlock('/tmp/x/.codex', { absoluteRunner: runner });
    const parsed = parseCodexHookBlock(block);
    assert.equal(parsed.ok, true);
    assert.notEqual(parsed.runner, 'node');
  });
});

describe('Bug #3017: rewriteLegacyCodexHookBlock migrates bare-node on reinstall', () => {
  test('exported as a function', () => {
    assert.equal(typeof rewriteLegacyCodexHookBlock, 'function');
  });

  test('rewrites a bare-node managed-hook command to the absolute runner', () => {
    const before = [
      '[model]',
      'name = "o3"',
      '',
      '# GSD Hooks',
      '[[hooks.SessionStart]]',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "node /Users/x/.codex/hooks/gsd-check-update.js"',
      '',
    ].join('\n');
    const runner = '"/usr/local/bin/node"';
    const result = rewriteLegacyCodexHookBlock(before, runner);
    assert.equal(result.changed, true, 'must report change=true');
    // The migrated command must use the absolute runner, hook path preserved & quoted.
    const parsed = parseCodexHookBlock(result.content);
    assert.equal(parsed.ok, true);
    assert.notEqual(parsed.runner, 'node');
    assert.ok(parsed.runner.includes('/node'),
      `runner must be the absolute node path: ${parsed.runner}`);
    assert.equal(parsed.hookPath, '/Users/x/.codex/hooks/gsd-check-update.js');
    // Non-GSD content (the [model] block) must be preserved verbatim.
    assert.ok(result.content.includes('[model]'));
    assert.ok(result.content.includes('name = "o3"'));
  });

  test('does NOT touch a managed-hook entry that already uses an absolute runner', () => {
    const already = [
      '# GSD Hooks',
      '[[hooks.SessionStart]]',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "\\"/usr/local/bin/node\\" /Users/x/.codex/hooks/gsd-check-update.js"',
      '',
    ].join('\n');
    const result = rewriteLegacyCodexHookBlock(already, '"/usr/local/bin/node"');
    assert.equal(result.changed, false);
    assert.equal(result.content, already);
  });

  test('does NOT touch user-authored bare-node hooks (filename not in managed allowlist)', () => {
    const userOwned = [
      '[[hooks.SessionStart]]',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "node /home/me/my-custom-codex-hook.js"',
      '',
    ].join('\n');
    const result = rewriteLegacyCodexHookBlock(userOwned, '"/usr/local/bin/node"');
    assert.equal(result.changed, false,
      'user-authored hooks must be left alone; only managed gsd-* hooks are migrated');
    assert.equal(result.content, userOwned);
  });

  test('returns content unchanged when absoluteRunner is null', () => {
    const before = 'command = "node /path/to/gsd-check-update.js"';
    const result = rewriteLegacyCodexHookBlock(before, null);
    assert.equal(result.changed, false);
    assert.equal(result.content, before);
  });
});
