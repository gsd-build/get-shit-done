/**
 * Regression tests for bug #2136
 *
 * gsd-check-update.js contains a MANAGED_HOOKS array used to detect stale
 * hooks after a GSD update. It must list every hook file that GSD ships so
 * that all deployed hooks are checked for staleness — not just the .js ones.
 *
 * The original bug: the 3 bash hooks (gsd-phase-boundary.sh,
 * gsd-session-state.sh, gsd-validate-commit.sh) were missing from
 * MANAGED_HOOKS, so they would never be detected as stale after an update.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const HOOKS_DIR = path.join(__dirname, '..', 'hooks');
const CHECK_UPDATE_FILE = path.join(HOOKS_DIR, 'gsd-check-update.js');

describe('bug #2136: MANAGED_HOOKS must include all shipped hook files', () => {
  let src;
  let managedHooks;
  let shippedHooks;

  // Read once — all tests share the same source snapshot
  src = fs.readFileSync(CHECK_UPDATE_FILE, 'utf-8');

  // Extract the MANAGED_HOOKS array entries from the source
  // The array is defined as a multi-line array literal of quoted strings
  const match = src.match(/const MANAGED_HOOKS\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(match, 'MANAGED_HOOKS array not found in gsd-check-update.js');

  managedHooks = match[1]
    .split('\n')
    .map(line => line.trim().replace(/^['"]|['"],?$/g, ''))
    .filter(s => s.length > 0 && !s.startsWith('//'));

  // List all GSD-managed hook files in hooks/ (names starting with "gsd-")
  shippedHooks = fs.readdirSync(HOOKS_DIR)
    .filter(f => f.startsWith('gsd-') && (f.endsWith('.js') || f.endsWith('.sh')));

  test('every shipped gsd-*.js hook is in MANAGED_HOOKS', () => {
    const jsHooks = shippedHooks.filter(f => f.endsWith('.js'));
    for (const hookFile of jsHooks) {
      assert.ok(
        managedHooks.includes(hookFile),
        `${hookFile} is shipped in hooks/ but missing from MANAGED_HOOKS in gsd-check-update.js`
      );
    }
  });

  test('every shipped gsd-*.sh hook is in MANAGED_HOOKS', () => {
    const shHooks = shippedHooks.filter(f => f.endsWith('.sh'));
    for (const hookFile of shHooks) {
      assert.ok(
        managedHooks.includes(hookFile),
        `${hookFile} is shipped in hooks/ but missing from MANAGED_HOOKS in gsd-check-update.js`
      );
    }
  });

  test('MANAGED_HOOKS contains no entries for hooks that do not exist', () => {
    for (const entry of managedHooks) {
      const exists = fs.existsSync(path.join(HOOKS_DIR, entry));
      assert.ok(
        exists,
        `MANAGED_HOOKS entry '${entry}' has no corresponding file in hooks/ — remove stale entry`
      );
    }
  });
});
