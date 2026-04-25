'use strict';

/**
 * Slash-command namespace invariant (#2543, updated by #2697).
 *
 * History:
 *   #2543 switched user-facing references from /gsd-<cmd> (dash) to /gsd:<cmd> (colon)
 *   because Claude Code's skill frontmatter used `name: gsd:<cmd>`.
 *   #2697 reversed this: Claude Code slash commands are invoked by skill *directory*
 *   name (gsd-<cmd>), not frontmatter name. The colon form (/gsd:<cmd>) does not work
 *   as a user-typed slash command. Other environment installers (OpenCode, Copilot,
 *   Antigravity) already transform gsd: → gsd- at install time, so changing the source
 *   to use gsd- makes all environments consistent.
 *
 * Invariant enforced here:
 *   No `/gsd:<cmd>` pattern in user-facing source text.
 *   `Skill(skill="gsd:<cmd>")` calls (no leading slash) are ALLOWED — they use
 *   frontmatter `name:` resolution internally and are not user-typed commands.
 *
 * Exceptions:
 *   - CHANGELOG.md: historical entries document commands under their original names.
 *   - gsd-sdk / gsd-tools identifiers: never rewritten (not slash commands).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

// Matches /gsd:<cmd> — the retired user-facing format.
// Does NOT match Skill(skill="gsd:<cmd>") because those have no leading slash.
const retiredPattern = new RegExp(`/gsd:(${cmdNames.join('|')})(?=[^a-zA-Z0-9_-]|$)`);

const allFiles = SEARCH_DIRS.flatMap(d => collectFiles(d));

describe('slash-command namespace invariant (#2697)', () => {
  test('commands/gsd/ directory contains known command files', () => {
    assert.ok(cmdNames.length > 0, 'commands/gsd/ must contain .md files');
    assert.ok(cmdNames.includes('plan-phase'), 'plan-phase must be a known command');
    assert.ok(cmdNames.includes('execute-phase'), 'execute-phase must be a known command');
  });

  test('no /gsd:<cmd> retired syntax in user-facing source files', () => {
    const violations = [];
    for (const file of allFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (retiredPattern.test(lines[i])) {
          violations.push(`${path.relative(ROOT, file)}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
        }
      }
    }
    assert.strictEqual(
      violations.length,
      0,
      `Found ${violations.length} retired /gsd:<cmd> reference(s) — use /gsd-<cmd> instead:\n${violations.slice(0, 10).join('\n')}`,
    );
  });

  test('gsd-sdk and gsd-tools identifiers are not rewritten', () => {
    for (const file of allFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      assert.ok(
        !src.includes('/gsd:sdk'),
        `${path.relative(ROOT, file)} must not contain /gsd:sdk (gsd-sdk is not a slash command)`,
      );
      assert.ok(
        !src.includes('/gsd:tools'),
        `${path.relative(ROOT, file)} must not contain /gsd:tools (gsd-tools is not a slash command)`,
      );
    }
  });
});
