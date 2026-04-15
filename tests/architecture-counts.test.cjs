'use strict';

/**
 * Guards ARCHITECTURE.md component counts against drift.
 *
 * Both sides are computed at test runtime — no hardcoded numbers.
 * Parsing ARCHITECTURE.md: regex extracts the documented count.
 * Filesystem count: readdirSync filters to *.md files.
 *
 * To add a new component: append a row to COMPONENTS below and update
 * docs/ARCHITECTURE.md with a matching "**Total <label>:** N" line.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ARCH_MD = path.join(ROOT, 'docs', 'ARCHITECTURE.md');
const ARCH_CONTENT = fs.readFileSync(ARCH_MD, 'utf-8');

/** Components whose counts must stay in sync with ARCHITECTURE.md. */
const COMPONENTS = [
  { label: 'commands',  dir: 'commands/gsd' },
  { label: 'workflows', dir: 'get-shit-done/workflows' },
  { label: 'agents',    dir: 'agents' },
];

/**
 * Parse "**Total <label>:** N" from ARCHITECTURE.md.
 * Returns the integer N, or throws if the pattern is missing.
 */
function parseDocCount(label) {
  const match = ARCH_CONTENT.match(new RegExp(`\\*\\*Total ${label}:\\*\\*\\s+(\\d+)`));
  assert.ok(match, `ARCHITECTURE.md is missing "**Total ${label}:** N" — add it`);
  return parseInt(match[1], 10);
}

/**
 * Count *.md files in a directory (non-recursive).
 */
function countMdFiles(relDir) {
  return fs.readdirSync(path.join(ROOT, relDir)).filter((f) => f.endsWith('.md')).length;
}

describe('ARCHITECTURE.md component counts', () => {
  for (const { label, dir } of COMPONENTS) {
    test(`Total ${label} matches ${dir}/*.md file count`, () => {
      const documented = parseDocCount(label);
      const actual = countMdFiles(dir);
      assert.strictEqual(
        documented,
        actual,
        `docs/ARCHITECTURE.md says "Total ${label}: ${documented}" but ${dir}/ has ${actual} .md files — update ARCHITECTURE.md`
      );
    });
  }
});
