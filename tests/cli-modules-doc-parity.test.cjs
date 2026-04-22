'use strict';

/**
 * For every `get-shit-done/bin/lib/*.cjs`, assert the module name
 * appears as a row in docs/INVENTORY.md's CLI Modules table.
 * docs/CLI-TOOLS.md is allowed to describe a subset (narrative doc);
 * INVENTORY.md is the authoritative module roster.
 *
 * Related: docs readiness refresh, lane-12 recommendation.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'get-shit-done', 'bin', 'lib');
const INVENTORY_MD = fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY.md'), 'utf8');

const moduleFiles = fs
  .readdirSync(LIB_DIR)
  .filter((f) => f.endsWith('.cjs'));

function mentionedInInventoryCliModules(filename) {
  // Row form: | `filename.cjs` | responsibility |
  const rowRe = new RegExp(`\\|\\s*\\\`${filename.replace(/\./g, '\\.')}\\\`\\s*\\|`, 'm');
  return rowRe.test(INVENTORY_MD);
}

describe('every CLI module has a row in INVENTORY.md', () => {
  for (const file of moduleFiles) {
    test(file, () => {
      assert.ok(
        mentionedInInventoryCliModules(file),
        `get-shit-done/bin/lib/${file} has no row in docs/INVENTORY.md CLI Modules table — add one`,
      );
    });
  }
});
