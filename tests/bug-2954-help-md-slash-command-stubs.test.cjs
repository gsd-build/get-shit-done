'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2954: workflow files that surface /gsd-* slash commands to users
 * (help.md and the do.md dispatcher table) must not reference any
 * /gsd-<name> that has no matching commands/gsd/<name>.md stub.
 *
 * Regression introduced by #2824 (skill consolidation deleted 31 stubs)
 * without updating help.md or the do.md routing table.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

const SURFACED_FILES = [
  path.join(ROOT, 'get-shit-done', 'workflows', 'help.md'),
  path.join(ROOT, 'get-shit-done', 'workflows', 'do.md'),
];

function listStubBaseNames() {
  return fs
    .readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''));
}

function extractAdvertisedNames(contents) {
  const names = new Set();
  const tokenRe = /\/gsd-([a-z][a-z0-9-]*)/g;
  let match;
  while ((match = tokenRe.exec(contents)) !== null) {
    names.add(match[1]);
  }
  return names;
}

describe('Bug #2954: user-surfaced workflow files reference live slash stubs only', () => {
  const stubs = new Set(listStubBaseNames());

  for (const file of SURFACED_FILES) {
    test(`${path.relative(ROOT, file)} only references live commands/gsd/<name>.md stubs`, () => {
      const contents = fs.readFileSync(file, 'utf8');
      const advertised = extractAdvertisedNames(contents);
      const missing = [...advertised].filter((name) => !stubs.has(name)).sort();
      assert.deepEqual(
        missing,
        [],
        `${path.relative(ROOT, file)} references /gsd-<name> with no matching commands/gsd/<name>.md stub: ${missing.join(', ')}`,
      );
    });
  }
});
