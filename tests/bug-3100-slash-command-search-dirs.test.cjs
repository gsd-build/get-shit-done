'use strict';

// allow-test-rule: structural-regression-guard

/**
 * Regression test for bug #3100.
 *
 * fix-slash-commands.cjs previously omitted agents/, sdk/src/, and the
 * top-level .clinerules file from SEARCH_DIRS, leaving 8 stale /gsd:<cmd>
 * references in 5 files undetected and unfixed.
 *
 * Invariants enforced here:
 *   1. Each of the 5 affected files has zero /gsd:<cmd> references.
 *   2. scripts/fix-slash-commands.cjs SEARCH_DIRS includes 'agents' and 'sdk'.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

// Build the live retired pattern from the command registry — same approach as
// bug-2543-gsd-slash-namespace.test.cjs so coverage is consistent.
const cmdNames = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace(/\.md$/, ''))
  .sort((a, b) => b.length - a.length);

const retiredPattern = new RegExp(`/gsd:(${cmdNames.join('|')})(?=[^a-zA-Z0-9_-]|$)`);

// The 5 files that had stale references on main before this fix.
const TARGET_FILES = [
  path.join(ROOT, 'agents', 'gsd-codebase-mapper.md'),
  path.join(ROOT, '.clinerules'),
  path.join(ROOT, 'sdk', 'src', 'config.ts'),
  path.join(ROOT, 'sdk', 'src', 'query', 'state-mutation.ts'),
  path.join(ROOT, 'sdk', 'src', 'query', 'verify.ts'),
];

describe('bug-3100: fix-slash-commands covers agents/, sdk/src/, and .clinerules', () => {
  test('command registry is non-empty (sanity check)', () => {
    assert.ok(cmdNames.length > 0, 'commands/gsd/ must contain .md files');
  });

  for (const filePath of TARGET_FILES) {
    const label = path.relative(ROOT, filePath);
    test(`no retired /gsd:<cmd> references in ${label}`, () => {
      const src = fs.readFileSync(filePath, 'utf-8');
      const lines = src.split('\n');
      const violations = [];
      for (let i = 0; i < lines.length; i++) {
        if (retiredPattern.test(lines[i])) {
          violations.push(`line ${i + 1}: ${lines[i].trim().slice(0, 100)}`);
        }
      }
      assert.deepStrictEqual(
        violations,
        [],
        `${label} must have zero retired /gsd:<cmd> references:\n${violations.join('\n')}`,
      );
    });
  }

  describe('fix-slash-commands.cjs SEARCH_DIRS coverage guards', () => {
    const scriptPath = path.join(ROOT, 'scripts', 'fix-slash-commands.cjs');

    test("SEARCH_DIRS includes 'agents' path component", () => {
      const src = fs.readFileSync(scriptPath, 'utf-8');
      assert.ok(
        src.includes("'..', 'agents'"),
        "fix-slash-commands.cjs SEARCH_DIRS must include the 'agents' directory",
      );
    });

    test("SEARCH_DIRS includes 'sdk' path component", () => {
      const src = fs.readFileSync(scriptPath, 'utf-8');
      assert.ok(
        src.includes("'..', 'sdk'"),
        "fix-slash-commands.cjs SEARCH_DIRS must include the 'sdk' directory",
      );
    });
  });
});
