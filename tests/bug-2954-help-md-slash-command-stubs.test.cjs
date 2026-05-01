'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2954: help.md must not advertise /gsd-* slash entries that have no
 * matching commands/gsd/*.md stub. Regression introduced by #2824 (skill
 * consolidation deleted 31 stubs) without an updated help.md.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HELP_MD = path.join(ROOT, 'get-shit-done', 'workflows', 'help.md');
const COMMANDS_DIR = path.join(ROOT, 'commands', 'gsd');

function listStubBaseNames() {
  return fs
    .readdirSync(COMMANDS_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => e.name.replace(/\.md$/, ''));
}

function extractAdvertisedNames(helpContents) {
  const names = new Set();
  const tokenRe = /\/gsd-([a-z][a-z0-9-]*)/g;
  let match;
  while ((match = tokenRe.exec(helpContents)) !== null) {
    names.add(match[1]);
  }
  return names;
}

describe('Bug #2954: help.md slash-stub parity', () => {
  test('every /gsd-<name> in help.md has a commands/gsd/<name>.md stub', () => {
    const helpContents = fs.readFileSync(HELP_MD, 'utf8');
    const advertised = extractAdvertisedNames(helpContents);
    const stubs = new Set(listStubBaseNames());

    const missing = [...advertised].filter((name) => !stubs.has(name)).sort();

    assert.deepEqual(
      missing,
      [],
      `help.md advertises /gsd-<name> entries with no matching commands/gsd/<name>.md stub: ${missing.join(', ')}`,
    );
  });
});
