'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Locks docs/INVENTORY.md's "(N shipped)" headline counts against the
 * filesystem for each of the six families. INVENTORY.md is the
 * authoritative roster — if a surface ships, its row must exist here
 * and the headline count must match ls.
 *
 * Both sides are computed at test runtime — no hardcoded numbers.
 *
 * Related: docs readiness refresh, lane-12 recommendation.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const INVENTORY_MD = path.join(ROOT, 'docs', 'INVENTORY.md');
const INVENTORY = fs.readFileSync(INVENTORY_MD, 'utf8');

const FAMILIES = [
  { label: 'Agents',      dir: 'agents',                      filter: (f) => /^gsd-.*\.md$/.test(f) },
  { label: 'Commands',    dir: 'commands/gsd',                filter: (f) => f.endsWith('.md') },
  { label: 'Workflows',   dir: 'get-shit-done/workflows',     filter: (f) => f.endsWith('.md') },
  { label: 'References',  dir: 'get-shit-done/references',    filter: (f) => f.endsWith('.md') },
  { label: 'CLI Modules', dir: 'get-shit-done/bin/lib',       filter: (f) => f.endsWith('.cjs') },
  { label: 'Hooks',       dir: 'hooks',                       filter: (f) => /\.(js|sh)$/.test(f) },
];

function headlineCount(label) {
  const re = new RegExp(`^##\\s+${label}\\s+\\((\\d+)\\s+shipped\\)`, 'm');
  const m = INVENTORY.match(re);
  assert.ok(m, `docs/INVENTORY.md is missing the "## ${label} (N shipped)" header`);
  return parseInt(m[1], 10);
}

function fsCount(relDir, filter) {
  return fs
    .readdirSync(path.join(ROOT, relDir))
    .filter((name) => fs.statSync(path.join(ROOT, relDir, name)).isFile())
    .filter(filter)
    .length;
}

describe('docs/INVENTORY.md headline counts match the filesystem', () => {
  for (const { label, dir, filter } of FAMILIES) {
    test(`"${label} (N shipped)" matches ${dir}/`, () => {
      const documented = headlineCount(label);
      const actual = fsCount(dir, filter);
      assert.strictEqual(
        documented,
        actual,
        `docs/INVENTORY.md "${label} (${documented} shipped)" disagrees with ${dir}/ file count (${actual}) — update the headline and the row list`,
      );
    });
  }
});
