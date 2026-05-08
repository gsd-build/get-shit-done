// allow-test-rule: source-text-is-the-product — workflow, reference, and docs .md files
// ARE what the runtime loads and what users read; asserting their text content
// tests the deployed skill surface contract, not implementation internals.

'use strict';

// Regression tests for bug #3258.
//
// PR #2790 folded `/gsd-intel` into `/gsd-map-codebase --query`. After that
// consolidation, five prose occurrences in two source files continued to
// reference the retired `/gsd-intel` slash command. Users invoking the wizard
// were directed to a command that no longer exists.
//
// Fix: replace each `/gsd-intel` (the retired user-facing slash command) with
// `/gsd-map-codebase --query` in:
//   - get-shit-done/references/planning-config.md
//   - get-shit-done/workflows/settings.md
//   - docs/INVENTORY.md
//   - docs/USER-GUIDE.md
//   - docs/FEATURES.md
//
// Allowed: `gsd-intel-updater` (still-valid agent name, no leading slash),
//          `intel.cjs` / `intel.enabled` / `intel.*` (internal backend, not user command),
//          CHANGELOG.md (historical record), test files themselves.
//
// This test distinguishes `/gsd-intel` (the retired slash command, leading slash)
// from `gsd-intel-updater` (still-valid agent) by grepping for the literal
// string `/gsd-intel` and then asserting no match survives after excluding
// the `-updater` suffix.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/** Walk a directory recursively and return absolute paths of all .md files. */
function walkMd(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMd(abs));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(abs);
    }
  }
  return results;
}

/**
 * Return all lines in `src` that contain `/gsd-intel` (the retired slash
 * command) but are NOT the agent name `gsd-intel-updater`.
 * We match the literal substring `/gsd-intel` (with leading slash) and then
 * exclude any line where the match is immediately followed by `-updater`.
 */
function staleLinesIn(src) {
  return src.split('\n').filter((line) => {
    if (!line.includes('/gsd-intel')) return false;
    // Remove all occurrences of the valid agent name; if nothing remains, skip.
    const stripped = line.replace(/\/gsd-intel-updater/g, '');
    return stripped.includes('/gsd-intel');
  });
}

const SOURCE_DIRS = [
  path.join(ROOT, 'commands', 'gsd'),
  path.join(ROOT, 'get-shit-done', 'workflows'),
  path.join(ROOT, 'get-shit-done', 'references'),
  path.join(ROOT, 'agents'),
  path.join(ROOT, 'docs'),
];

describe('#3258: no stale /gsd-intel slash-command references in product source dirs', () => {
  for (const dir of SOURCE_DIRS) {
    const files = walkMd(dir);
    for (const file of files) {
      const rel = path.relative(ROOT, file);

      // Allowed exclusions:
      // - CHANGELOG.md is a historical record; /gsd-intel appears in release notes
      // - test files (under tests/) are excluded automatically by SOURCE_DIRS scope
      if (rel === 'CHANGELOG.md') continue;

      test(`${rel} has no stale /gsd-intel references`, () => {
        let src;
        try {
          src = fs.readFileSync(file, 'utf8');
        } catch (err) {
          throw new Error(`failed reading ${rel}: ${err.message}`);
        }

        const staleLines = staleLinesIn(src);
        assert.strictEqual(
          staleLines.length,
          0,
          [
            `${rel} contains ${staleLines.length} stale /gsd-intel reference(s).`,
            'Replace with /gsd-map-codebase --query (retired by PR #2790).',
            'Stale lines:',
            ...staleLines.map((l) => `  ${l.trim()}`),
          ].join('\n'),
        );
      });
    }
  }
});
