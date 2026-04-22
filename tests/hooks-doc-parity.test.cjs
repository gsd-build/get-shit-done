'use strict';

/**
 * For every `hooks/*.(js|sh)`, assert the hook filename appears as a
 * row in docs/INVENTORY.md's Hooks table. docs/ARCHITECTURE.md's hook
 * table is allowed to lag — INVENTORY.md is authoritative.
 *
 * Related: docs readiness refresh, lane-12 recommendation.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const HOOKS_DIR = path.join(ROOT, 'hooks');
const INVENTORY_MD = fs.readFileSync(path.join(ROOT, 'docs', 'INVENTORY.md'), 'utf8');

const hookFiles = fs
  .readdirSync(HOOKS_DIR)
  .filter((f) => /\.(js|sh)$/.test(f));

function mentionedInInventoryHooks(filename) {
  // Row form: | `filename.js` | event | purpose |
  const rowRe = new RegExp(`\\|\\s*\\\`${filename.replace(/\./g, '\\.')}\\\`\\s*\\|`, 'm');
  return rowRe.test(INVENTORY_MD);
}

describe('every shipped hook has a row in INVENTORY.md', () => {
  for (const file of hookFiles) {
    test(file, () => {
      assert.ok(
        mentionedInInventoryHooks(file),
        `hooks/${file} has no row in docs/INVENTORY.md Hooks table — add one`,
      );
    });
  }
});
