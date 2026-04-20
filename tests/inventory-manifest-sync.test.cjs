'use strict';

/**
 * Asserts docs/INVENTORY-MANIFEST.json is in sync with the filesystem.
 * A stale manifest means a surface shipped without updating INVENTORY.md.
 * Fix by running: node scripts/gen-inventory-manifest.cjs --write
 * then adding the corresponding row(s) in docs/INVENTORY.md.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'INVENTORY-MANIFEST.json');

const FAMILIES = [
  { name: 'agents',      dir: path.join(ROOT, 'agents'),                           filter: (f) => /^gsd-.*\.md$/.test(f),  toName: (f) => f.replace(/\.md$/, '') },
  { name: 'commands',    dir: path.join(ROOT, 'commands', 'gsd'),                  filter: (f) => f.endsWith('.md'),        toName: (f) => '/gsd-' + f.replace(/\.md$/, '') },
  { name: 'workflows',   dir: path.join(ROOT, 'get-shit-done', 'workflows'),        filter: (f) => f.endsWith('.md'),        toName: (f) => f },
  { name: 'references',  dir: path.join(ROOT, 'get-shit-done', 'references'),       filter: (f) => f.endsWith('.md'),        toName: (f) => f },
  { name: 'cli_modules', dir: path.join(ROOT, 'get-shit-done', 'bin', 'lib'),       filter: (f) => f.endsWith('.cjs'),       toName: (f) => f },
  { name: 'hooks',       dir: path.join(ROOT, 'hooks'),                             filter: (f) => /\.(js|sh)$/.test(f),    toName: (f) => f },
];

test('docs/INVENTORY-MANIFEST.json matches the filesystem', () => {
  const committed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const additions = [];
  const removals = [];

  for (const { name, dir, filter, toName } of FAMILIES) {
    const live = new Set(
      fs.readdirSync(dir)
        .filter((f) => fs.statSync(path.join(dir, f)).isFile() && filter(f))
        .map(toName),
    );
    const recorded = new Set((committed.families || {})[name] || []);

    for (const entry of live) {
      if (!recorded.has(entry)) additions.push(name + '/' + entry);
    }
    for (const entry of recorded) {
      if (!live.has(entry)) removals.push(name + '/' + entry);
    }
  }

  const msg = [
    additions.length ? 'New surfaces not in manifest (run node scripts/gen-inventory-manifest.cjs --write):\n' + additions.map((e) => '  + ' + e).join('\n') : '',
    removals.length  ? 'Manifest entries with no matching file:\n'                                                  + removals.map((e) => '  - ' + e).join('\n') : '',
  ].filter(Boolean).join('\n');

  assert.ok(additions.length === 0 && removals.length === 0, msg);
});
