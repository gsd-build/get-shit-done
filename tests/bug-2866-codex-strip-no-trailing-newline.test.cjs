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

  for (const [shape, block] of Object.entries(SHAPES)) {
    test(`${shape}: stripped when terminated by trailing newline`, () => {
      const input = `[history]\npersistence = "save-all"\n${block}\n`;
      const out = stripStaleGsdHookBlocks(input);
      assert.ok(!out.includes('# GSD Hooks'),
        `expected stale GSD Hooks block to be stripped, got:\n${out}`);
      assert.ok(!out.includes('gsd-update-check') && !out.includes('gsd-check-update'),
        `expected gsd-*-update reference to be stripped, got:\n${out}`);
      // Pre-existing user content must remain intact.
      assert.ok(out.includes('persistence = "save-all"'),
        `pre-existing user content must remain, got:\n${out}`);
    });

    test(`${shape}: stripped when at end-of-file without trailing newline`, () => {
      // The reporter's repro: stale block sits at the very end with no \n.
      const input = `[history]\npersistence = "save-all"\n${block}`;
      const out = stripStaleGsdHookBlocks(input);
      assert.ok(!out.includes('# GSD Hooks'),
        `(${shape}, no trailing newline) expected stale block to be stripped, got:\n${out}`);
      assert.ok(!out.includes('gsd-update-check') && !out.includes('gsd-check-update'),
        `(${shape}, no trailing newline) expected gsd-*-update reference to be stripped, got:\n${out}`);
      assert.ok(out.includes('persistence = "save-all"'),
        `pre-existing user content must remain, got:\n${out}`);
    });
  }

  test('returns input unchanged when no GSD hook block is present', () => {
    const benign = '[history]\npersistence = "save-all"\n';
    assert.strictEqual(stripStaleGsdHookBlocks(benign), benign,
      'helper must be a no-op when no GSD reference exists');
  });

  test('Shape 4 strip does not leave an orphaned [[hooks.SessionStart]] header', () => {
    // Shape 4 is stripped before Shape 3 specifically to avoid this.
    const block = SHAPES['Shape 4 (nested [[hooks.SessionStart]] + [[hooks.SessionStart.hooks]])'];
    const out = stripStaleGsdHookBlocks(`[history]\npersistence = "save-all"\n${block}`);
    assert.ok(!out.includes('[[hooks.SessionStart]]'),
      `Shape 4 strip must remove the parent [[hooks.SessionStart]] header too, got:\n${out}`);
  });
});
