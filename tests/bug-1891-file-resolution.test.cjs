/**
 * Regression tests for bug #1891
 *
 * gsd-tools.cjs must transparently resolve @file: references in stdout
 * so that workflows never see the @file: prefix. This eliminates the
 * bash-specific `if [[ "$INIT" == @file:* ]]` check that breaks on
 * PowerShell and other non-bash shells.
 */

'use strict';

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const GSD_TOOLS_SRC = path.join(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

describe('bug #1891: @file: resolution in gsd-tools.cjs', () => {
  let src;

  before(() => {
    src = fs.readFileSync(GSD_TOOLS_SRC, 'utf-8');
  });

  test('main() intercepts stdout and resolves @file: references', () => {
    // The non-pick path should have @file: resolution, just like the --pick path
    assert.ok(
      src.includes("captured.startsWith('@file:')") ||
      src.includes('captured.startsWith(\'@file:\')'),
      'main() should check for @file: prefix in captured output'
    );
  });

  test('@file: resolution reads file content via readFileSync', () => {
    // Verify the resolution reads the actual file
    assert.ok(
      src.includes("readFileSync(captured.slice(6)") ||
      src.includes('readFileSync(captured.slice(6)'),
      '@file: resolution should read file at the path after the prefix'
    );
  });

  test('stdout interception wraps runCommand in the non-pick path', () => {
    // The main function should intercept fs.writeSync for fd=1
    // in BOTH the pick path AND the normal path
    const mainFunc = src.slice(src.indexOf('async function main()'));
    const pickInterception = mainFunc.indexOf('// When --pick is active');
    const fileResolution = mainFunc.indexOf('@file:');

    // There should be at least two @file: resolution points:
    // one in the --pick path and one in the normal path
    const firstAt = mainFunc.indexOf("'@file:'");
    const secondAt = mainFunc.indexOf("'@file:'", firstAt + 1);
    assert.ok(secondAt > firstAt,
      'Both --pick and normal paths should resolve @file: references');
  });
});
