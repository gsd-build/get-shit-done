#!/usr/bin/env node
'use strict';

/**
 * Generates docs/INVENTORY-MANIFEST.json — a structural skeleton of every
 * shipped surface derived entirely from the filesystem. Commit this file;
 * CI re-runs the script and diffs. A non-empty diff means a surface shipped
 * without an INVENTORY.md row.
 *
 * Usage:
 *   node scripts/gen-inventory-manifest.cjs              # print to stdout
 *   node scripts/gen-inventory-manifest.cjs --write      # write docs/INVENTORY-MANIFEST.json
 *   node scripts/gen-inventory-manifest.cjs --check      # exit 1 if committed manifest is stale
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'docs', 'INVENTORY-MANIFEST.json');

const FAMILIES = [
  {
    name: 'agents',
    dir: path.join(ROOT, 'agents'),
    filter: (f) => /^gsd-.*\.md$/.test(f),
    toName: (f) => f.replace(/\.md$/, ''),
  },
  {
    name: 'commands',
    dir: path.join(ROOT, 'commands', 'gsd'),
    filter: (f) => f.endsWith('.md'),
    toName: (f) => '/gsd-' + f.replace(/\.md$/, ''),
  },
  {
    name: 'workflows',
    dir: path.join(ROOT, 'get-shit-done', 'workflows'),
    filter: (f) => f.endsWith('.md'),
    toName: (f) => f,
  },
  {
    name: 'references',
    dir: path.join(ROOT, 'get-shit-done', 'references'),
    filter: (f) => f.endsWith('.md'),
    toName: (f) => f,
  },
  {
    name: 'cli_modules',
    dir: path.join(ROOT, 'get-shit-done', 'bin', 'lib'),
    filter: (f) => f.endsWith('.cjs'),
    toName: (f) => f,
  },
  {
    name: 'hooks',
    dir: path.join(ROOT, 'hooks'),
    filter: (f) => /\.(js|sh)$/.test(f),
    toName: (f) => f,
  },
];

function buildManifest() {
  const manifest = { generated: new Date().toISOString().slice(0, 10), families: {} };
  for (const { name, dir, filter, toName } of FAMILIES) {
    manifest.families[name] = fs
      .readdirSync(dir)
      .filter((f) => fs.statSync(path.join(dir, f)).isFile() && filter(f))
      .map(toName)
      .sort();
  }
  return manifest;
}

const [, , flag] = process.argv;

if (flag === '--check') {
  const committed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const live = buildManifest();
  // Strip the generated date for comparison
  delete committed.generated;
  delete live.generated;
  const committedStr = JSON.stringify(committed, null, 2);
  const liveStr = JSON.stringify(live, null, 2);
  if (committedStr !== liveStr) {
    process.stderr.write(
      'docs/INVENTORY-MANIFEST.json is stale. Run:\n' +
      '  node scripts/gen-inventory-manifest.cjs --write\n' +
      'then add a matching row in docs/INVENTORY.md for each new entry.\n\n',
    );
    // Show diff-friendly output
    for (const family of Object.keys(live.families)) {
      const liveSet = new Set(live.families[family]);
      const committedSet = new Set((committed.families || {})[family] || []);
      for (const name of liveSet) {
        if (!committedSet.has(name)) process.stderr.write('  + ' + family + '/' + name + '\n');
      }
      for (const name of committedSet) {
        if (!liveSet.has(name)) process.stderr.write('  - ' + family + '/' + name + '\n');
      }
    }
    process.exit(1);
  }
  process.stdout.write('docs/INVENTORY-MANIFEST.json is up to date.\n');
} else if (flag === '--write') {
  const manifest = buildManifest();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
  process.stdout.write('Wrote ' + MANIFEST_PATH + '\n');
} else {
  process.stdout.write(JSON.stringify(buildManifest(), null, 2) + '\n');
}
