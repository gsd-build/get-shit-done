/**
 * Regression tests for bugs #1852 and #1862
 *
 * The package.json "files" field listed "hooks/dist" but not "hooks" directly.
 * The three .sh hook files live in hooks/ (not hooks/dist/), so they were
 * excluded from the npm tarball. Any fresh install from the registry would
 * produce broken shell hooks (SessionStart / PostToolUse errors).
 *
 * Fix: change "hooks/dist" to "hooks" in package.json so that the entire
 * hooks/ directory (both .js dist files and .sh source files) is included.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PKG_PATH = path.join(__dirname, '..', 'package.json');
const HOOKS_DIR = path.join(__dirname, '..', 'hooks');

const SH_HOOKS = [
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
];

describe('package.json manifest — hooks .sh files (#1852 #1862)', () => {
  let pkg;

  try {
    pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  } catch {
    pkg = {};
  }

  const filesField = pkg.files || [];

  test('package.json "files" does not contain the narrow "hooks/dist" entry', () => {
    assert.ok(
      !filesField.includes('hooks/dist'),
      [
        '"hooks/dist" must not appear alone in package.json "files".',
        'This entry only bundles compiled .js files and excludes the .sh hooks',
        'in hooks/ (gsd-session-state.sh, gsd-validate-commit.sh, gsd-phase-boundary.sh).',
        'Replace "hooks/dist" with "hooks" to include all hook files.',
      ].join(' ')
    );
  });

  test('package.json "files" includes the full "hooks" directory', () => {
    assert.ok(
      filesField.includes('hooks'),
      [
        '"hooks" must be listed in package.json "files" so that',
        '.sh hook files are included in the npm tarball.',
        'Current files field: ' + JSON.stringify(filesField),
      ].join(' ')
    );
  });

  for (const hook of SH_HOOKS) {
    test(`${hook} exists in hooks/ source directory`, () => {
      const hookPath = path.join(HOOKS_DIR, hook);
      assert.ok(
        fs.existsSync(hookPath),
        [
          `${hook} must exist at hooks/${hook}.`,
          'This file must be present in the repository so that',
          'it is included when npm packs the "hooks" directory.',
        ].join(' ')
      );
    });
  }
});
