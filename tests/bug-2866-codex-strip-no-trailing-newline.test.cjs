/**
 * Bug #2866: Codex Installer (RC.7) fails to strip legacy flat hooks if
 * trailing newline is missing.
 *
 * The cleanup regexes in `bin/install.js` matched stale GSD hook blocks
 * via `\r?\n` at the end. When a stale block sat at end-of-file without
 * a trailing newline (very common — many editors strip them, and the
 * legacy installer never wrote one), no shape stripped, the installer
 * saw `gsd-check-update` already present, skipped writing the new
 * Nested-AoT block, and Codex 0.125+ refused to load with
 *   "invalid type: map, expected a sequence in `hooks`"
 *
 * Fix: every shape's terminator is now `(?:\r?\n|$)` so end-of-file
 * counts as a valid terminator. The strip logic was lifted into a pure
 * helper, `stripStaleGsdHookBlocks(configContent)`, exported from
 * `bin/install.js` for direct test coverage.
 *
 * This test parses `package.json` to require `bin/install.js`
 * structurally (not by hardcoded path), then drives each historical
 * shape through the helper twice — once with a trailing newline, once
 * without — and asserts both are stripped.
 */
'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
const installPath = path.resolve(REPO_ROOT, pkg.bin['get-shit-done-cc']);
const { stripStaleGsdHookBlocks } = require(installPath);

/**
 * Parse the TOML output line-structurally so assertions check shape, not
 * substring presence in raw text. Comments are dropped, table headers are
 * recorded, and string-valued keys are captured. Sufficient for the small,
 * well-formed TOML produced by these tests.
 */
function parseTomlShape(text) {
  const tableHeaders = [];
  const keys = new Map(); // dotted path → string value (last-write-wins, fine for these inputs)
  let currentTable = '';
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/(?:^|\s)#.*$/, '').trim();
    if (!line) continue;
    const tableMatch = line.match(/^\[(\[)?([^\]]+)\]?\]$/);
    if (tableMatch) {
      currentTable = tableMatch[2];
      tableHeaders.push((tableMatch[1] ? '[[' : '[') + currentTable + (tableMatch[1] ? ']]' : ']'));
      continue;
    }
    const kvMatch = line.match(/^([A-Za-z_][\w-]*)\s*=\s*(.*)$/);
    if (kvMatch) {
      const key = currentTable ? `${currentTable}.${kvMatch[1]}` : kvMatch[1];
      const value = kvMatch[2].replace(/^"(.*)"$/, '$1');
      keys.set(key, value);
    }
  }
  return { tableHeaders, keys };
}

const SHAPES = {
  'Shape 1 (legacy gsd-update-check)': [
    '# GSD Hooks',
    '[[hooks]]',
    'event = "SessionStart"',
    'command = "node /Users/USER/.codex/hooks/gsd-update-check.js"',
  ].join('\n'),
  'Shape 2 (flat [[hooks]] + gsd-check-update)': [
    '# GSD Hooks',
    '[[hooks]]',
    'event = "SessionStart"',
    'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
  ].join('\n'),
  'Shape 3 ([[hooks.SessionStart]] without nested .hooks)': [
    '# GSD Hooks',
    '[[hooks.SessionStart]]',
    'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
  ].join('\n'),
  'Shape 4 (nested [[hooks.SessionStart]] + [[hooks.SessionStart.hooks]])': [
    '# GSD Hooks',
    '[[hooks.SessionStart]]',
    '',
    '[[hooks.SessionStart.hooks]]',
    'type = "command"',
    'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
  ].join('\n'),
};

describe('bug-2866: stripStaleGsdHookBlocks handles end-of-file without trailing newline', () => {
  test('stripStaleGsdHookBlocks is exported from bin/install.js', () => {
    assert.strictEqual(typeof stripStaleGsdHookBlocks, 'function',
      'bin/install.js must export stripStaleGsdHookBlocks');
  });

  function assertStripped(out, shape, scenario) {
    const shape_ = parseTomlShape(out);
    const hooksTable = shape_.tableHeaders.find((h) => /^\[\[?hooks(\.|]\])/.test(h));
    assert.strictEqual(hooksTable, undefined,
      `(${shape}, ${scenario}) no hooks table header may remain after strip, got tables: ${shape_.tableHeaders.join(', ')}`);
    const staleCmd = [...shape_.keys.entries()].find(([_, v]) =>
      /gsd-(update-check|check-update)/.test(v));
    assert.strictEqual(staleCmd, undefined,
      `(${shape}, ${scenario}) no key may carry a stale gsd-*-update command, got: ${staleCmd && staleCmd.join('=')}`);
    assert.strictEqual(shape_.keys.get('history.persistence'), 'save-all',
      `(${shape}, ${scenario}) history.persistence must be preserved as "save-all"`);
  }

  for (const [shape, block] of Object.entries(SHAPES)) {
    test(`${shape}: stripped when terminated by trailing newline`, () => {
      const input = `[history]\npersistence = "save-all"\n${block}\n`;
      assertStripped(stripStaleGsdHookBlocks(input), shape, 'with trailing newline');
    });

    test(`${shape}: stripped when at end-of-file without trailing newline`, () => {
      // The reporter's repro: stale block sits at the very end with no \n.
      const input = `[history]\npersistence = "save-all"\n${block}`;
      assertStripped(stripStaleGsdHookBlocks(input), shape, 'no trailing newline');
    });
  }

  test('returns input unchanged when no GSD hook block is present', () => {
    const benign = '[history]\npersistence = "save-all"\n';
    const out = stripStaleGsdHookBlocks(benign);
    assert.strictEqual(out, benign, 'helper must be a no-op when no GSD reference exists');
    const benignShape = parseTomlShape(out);
    assert.strictEqual(benignShape.keys.get('history.persistence'), 'save-all',
      'parsed shape must preserve history.persistence');
    assert.deepStrictEqual(benignShape.tableHeaders, ['[history]'],
      'parsed shape must contain only the [history] table');
  });

  // The structural rewrite (TOML-AST-driven, not regex-driven) must handle
  // whitespace and key-ordering variations that the previous regex missed.
  // These cases were silently leaked by the old implementation; one
  // (V3) actually corrupted the file by leaving an orphaned key=value line
  // outside any table.
  const VARIATIONS = {
    'extra blank line in Shape 4': [
      '# GSD Hooks',
      '[[hooks.SessionStart]]',
      '',
      '',
      '[[hooks.SessionStart.hooks]]',
      'type = "command"',
      'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
    ].join('\n'),
    'keys reordered (command before event in Shape 2)': [
      '# GSD Hooks',
      '[[hooks]]',
      'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
      'event = "SessionStart"',
    ].join('\n'),
    'extra key alongside command (Shape 3 + timeout)': [
      '# GSD Hooks',
      '[[hooks.SessionStart]]',
      'command = "node /Users/USER/.codex/hooks/gsd-check-update.js"',
      'timeout = 5000',
    ].join('\n'),
    'tight whitespace (no spaces around `=`)': [
      '# GSD Hooks',
      '[[hooks]]',
      'event="SessionStart"',
      'command="node /Users/USER/.codex/hooks/gsd-check-update.js"',
    ].join('\n'),
  };

  for (const [variation, block] of Object.entries(VARIATIONS)) {
    test(`variation stripped: ${variation}`, () => {
      const input = `[history]\npersistence = "save-all"\n${block}\n`;
      assertStripped(stripStaleGsdHookBlocks(input), variation, 'with trailing newline');
    });
    test(`variation stripped at EOF without trailing newline: ${variation}`, () => {
      const input = `[history]\npersistence = "save-all"\n${block}`;
      assertStripped(stripStaleGsdHookBlocks(input), variation, 'no trailing newline');
    });
  }

  test('user-authored [[hooks.UserPromptSubmit]] is preserved', () => {
    // The structural strip must not touch hook tables that don't carry a
    // GSD-managed `gsd-(check-update|update-check).js` command.
    const input = [
      '[history]',
      'persistence = "save-all"',
      '[[hooks.UserPromptSubmit]]',
      'command = "node /Users/USER/my-hook.js"',
      '',
    ].join('\n');
    const out = stripStaleGsdHookBlocks(input);
    const shape = parseTomlShape(out);
    assert.ok(
      shape.tableHeaders.includes('[[hooks.UserPromptSubmit]]'),
      `user-authored [[hooks.UserPromptSubmit]] must survive, got: ${shape.tableHeaders.join(', ')}`,
    );
    assert.strictEqual(
      shape.keys.get('hooks.UserPromptSubmit.command'),
      'node /Users/USER/my-hook.js',
      'user-authored command value must be preserved verbatim',
    );
  });

  test('Shape 4 strip does not leave an orphaned [[hooks.SessionStart]] header', () => {
    // Shape 4 is stripped before Shape 3 specifically to avoid this.
    const block = SHAPES['Shape 4 (nested [[hooks.SessionStart]] + [[hooks.SessionStart.hooks]])'];
    const out = stripStaleGsdHookBlocks(`[history]\npersistence = "save-all"\n${block}`);
    const outShape = parseTomlShape(out);
    const orphan = outShape.tableHeaders.find((h) => /hooks\.SessionStart/.test(h));
    assert.strictEqual(orphan, undefined,
      `Shape 4 strip must remove the parent [[hooks.SessionStart]] header too, got tables: ${outShape.tableHeaders.join(', ')}`);
  });
});
