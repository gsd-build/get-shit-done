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
const projection = require(path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const { buildCodexHookBlock, rewriteLegacyCodexHookBlock, resolveNodeRunner } = INSTALL;
const { projectCodexHookTomlCommand } = projection;

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

// Strip the toml-escape (\") and JSON-quote (") layers from the parsed
// runner token to compare against the raw absolute path the caller
// supplied. parsed.runner round-trips through TWO escape layers:
//   1. JSON.stringify in resolveNodeRunner adds outer "..." quotes
//   2. toml escapes the interior " to \" inside the command field
// After both, parsed.runner ends in `\"` and starts with `\"`.
function unescapeRunner(token) {
  if (!token) return token;
  let t = token.replace(/^\\"/, '').replace(/\\"$/, '');
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  return t;
}

describe('Bug #3017 / #3440: Codex hook projection seam', () => {
  test('projectCodexHookTomlCommand renders escaped command value from shared projection module', () => {
    const commandValue = projectCodexHookTomlCommand({
      absoluteRunner: '"/usr/local/bin/node"',
      scriptPath: '/tmp/codex-test/.codex/hooks/gsd-check-update.js',
      platform: 'linux',
    });
    assert.equal(
      commandValue,
      '\\"/usr/local/bin/node\\" \\"/tmp/codex-test/.codex/hooks/gsd-check-update.js\\"',
    );
  });
});

describe('Bug #3017: buildCodexHookBlock emits absolute node runner', () => {
  test('exported as a function', () => {
    assert.equal(typeof buildCodexHookBlock, 'function');
  });

  test('emits the EXACT absolute node runner the caller supplied (#3022 CR)', () => {
    const targetDir = '/tmp/codex-test/.codex';
    const expectedRunnerPath = '/usr/local/bin/node';
    const absoluteRunner = `"${expectedRunnerPath}"`;
    const block = buildCodexHookBlock(targetDir, { absoluteRunner });
    const parsed = parseCodexHookBlock(block);
    assert.equal(parsed.ok, true, `parse failed: ${block}`);
    assert.equal(parsed.hasMarker, true, '# GSD Hooks marker present');
    assert.equal(parsed.hasEvent, true, '[[hooks.SessionStart]] AoT entry present');
    assert.equal(parsed.hasHandler, true, '[[hooks.SessionStart.hooks]] handler entry present');
    assert.equal(parsed.type, 'command', 'handler is type=command');
    // Strict: parsed runner must match the supplied absolute path EXACTLY
    // (after stripping toml/JSON escape layers). A loose substring like
    // '/node' would let an unrelated absolute token containing '/node'
    // pass — e.g. '/Users/x/notnode/foo'.
    assert.equal(unescapeRunner(parsed.runner), expectedRunnerPath,
      `parsed runner must equal supplied absolute path: got ${parsed.runner}, want ${expectedRunnerPath}`);
    assert.equal(parsed.hookPath, '/tmp/codex-test/.codex/hooks/gsd-check-update.js',
      `hook path equality, got: ${parsed.hookPath}`);
  });

  test('returns null when absoluteRunner is null (caller skips registration)', () => {
    const block = buildCodexHookBlock('/tmp/x/.codex', { absoluteRunner: null });
    assert.equal(block, null,
      'must return null on missing runner so caller can warn-and-skip instead of writing a broken hook');
  });

  test('integrates with resolveNodeRunner() in the live process — runner equals resolved node runner (#3022 CR)', () => {
    const runner = resolveNodeRunner();
    assert.ok(runner, 'resolveNodeRunner returns a usable value in this test env');
    const block = buildCodexHookBlock('/tmp/x/.codex', { absoluteRunner: runner });
    const parsed = parseCodexHookBlock(block);
    assert.equal(parsed.ok, true);
    // Strict canonical-runner equality: the parsed runner (after stripping
    // toml + JSON escape layers) must be exactly the normalized runner that
    // resolveNodeRunner selected. Homebrew Cellar execPath values intentionally
    // normalize to the stable Homebrew symlink (#3181).
    const expected = JSON.parse(runner);
    assert.equal(unescapeRunner(parsed.runner), expected,
      `parsed runner must equal resolveNodeRunner(), got: ${parsed.runner}, want: ${expected}`);
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
    const expectedRunnerPath = '/usr/local/bin/node';
    const runner = `"${expectedRunnerPath}"`;
    const result = rewriteLegacyCodexHookBlock(before, runner);
    assert.equal(result.changed, true, 'must report change=true');
    // The migrated command must use the EXACT absolute runner the caller
    // supplied (#3022 CR — was previously asserting a loose '/node'
    // substring which let unrelated absolute paths pass).
    const parsed = parseCodexHookBlock(result.content);
    assert.equal(parsed.ok, true);
    assert.equal(unescapeRunner(parsed.runner), expectedRunnerPath,
      `runner must equal supplied absolute path: ${parsed.runner}`);
    assert.equal(parsed.hookPath, '/Users/x/.codex/hooks/gsd-check-update.js');
    // Non-GSD content (the [model] block) must be preserved verbatim.
    assert.ok(result.content.includes('[model]'));
    assert.ok(result.content.includes('name = "o3"'));
  });

  test('decodes TOML-escaped quoted script paths before projection', () => {
    const before = [
      '# GSD Hooks',
      '[[hooks.SessionStart]]',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "node \\"C:\\\\Users\\\\x\\\\.codex\\\\hooks\\\\gsd-check-update.js\\""',
      '',
    ].join('\n');
    const runner = '"/usr/local/bin/node"';
    const result = rewriteLegacyCodexHookBlock(before, runner, { platform: 'win32' });
    assert.equal(result.changed, true);
    const parsed = parseCodexHookBlock(result.content);
    assert.equal(parsed.ok, true, 'hook block must parse correctly');
    const expected = projectCodexHookTomlCommand({
      absoluteRunner: runner,
      scriptPath: 'C:\\Users\\x\\.codex\\hooks\\gsd-check-update.js',
      platform: 'win32',
    });
    assert.equal(parsed.command, expected,
      'rewritten command must project from decoded Windows path (not TOML-escaped token text)');
    assert.equal(unescapeRunner(parsed.runner), '/usr/local/bin/node',
      'runner must equal supplied absolute path');
    assert.equal(parsed.hookPath, 'C:/Users/x/.codex/hooks/gsd-check-update.js',
      'hook path must equal decoded Windows path after projection normalization');
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
