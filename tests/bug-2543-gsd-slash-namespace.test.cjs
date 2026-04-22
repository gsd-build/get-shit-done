'use strict';

/**
 * Bug #2543: GSD emits legacy '/gsd-<cmd>' syntax in 102 places.
 *
 * Installed commands are under commands/gsd/<name>.md and invoked as
 * /gsd:<name>. All internal references must use the colon form.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

const SEARCH_DIRS = [
  path.join(ROOT, 'get-shit-done', 'bin', 'lib'),
  path.join(ROOT, 'get-shit-done', 'workflows'),
  path.join(ROOT, 'get-shit-done', 'references'),
  path.join(ROOT, 'get-shit-done', 'templates'),
  path.join(ROOT, 'get-shit-done', 'contexts'),
  COMMANDS_DIR,
];

const EXTENSIONS = new Set(['.md', '.cjs', '.js']);

function collectFiles(dir, results = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collectFiles(full, results);
    else if (EXTENSIONS.has(path.extname(e.name))) results.push(full);
  }
  return results;
}

const cmdNames = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace(/\.md$/, ''))
  .sort((a, b) => b.length - a.length);

const legacyPattern = new RegExp(`/gsd-(${cmdNames.join('|')})(?=[^a-zA-Z0-9_-]|$)`);

const allFiles = SEARCH_DIRS.flatMap(d => collectFiles(d));

describe('slash-command namespace fix (#2543)', () => {
  test('commands/gsd/ directory contains known command files', () => {
    assert.ok(cmdNames.length > 0, 'commands/gsd/ must contain .md files');
    assert.ok(cmdNames.includes('plan-phase'), 'plan-phase must be a known command');
    assert.ok(cmdNames.includes('execute-phase'), 'execute-phase must be a known command');
  });

  test('no /gsd-<cmd> legacy syntax remains in source files', () => {
    const violations = [];
    for (const file of allFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (legacyPattern.test(lines[i])) {
          violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
        }
      }
    }
    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} legacy /gsd-<cmd> reference(s):\n${violations.slice(0, 10).join('\n')}`,
    );
  });

  test('gsd-sdk and gsd-tools identifiers are not rewritten', () => {
    for (const file of allFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      assert.ok(
        !src.includes('/gsd:sdk'),
        `${path.relative(ROOT, file)} must not contain /gsd:sdk (gsd-sdk was incorrectly renamed)`,
      );
      assert.ok(
        !src.includes('/gsd:tools'),
        `${path.relative(ROOT, file)} must not contain /gsd:tools (gsd-tools was incorrectly renamed)`,
      );
    }
  });
});
