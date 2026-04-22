/**
 * Regression tests for bug #1962
 *
 * normalizePhaseName must preserve the original case of letter suffixes.
 * Uppercasing "16c" to "16C" causes directory/roadmap mismatches on
 * case-sensitive filesystems — init progress can't match the directory
 * back to the roadmap phase entry.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { normalizePhaseName } = require('../get-shit-done/bin/lib/core.cjs');

describe('bug #1962: normalizePhaseName preserves letter suffix case', () => {
  test('lowercase suffix preserved: 16c → 16c', () => {
    assert.equal(normalizePhaseName('16c'), '16c');
  });

  test('uppercase suffix preserved: 16C → 16C', () => {
    assert.equal(normalizePhaseName('16C'), '16C');
  });

  test('single digit padded with lowercase suffix: 1a → 01a', () => {
    assert.equal(normalizePhaseName('1a'), '01a');
  });

  test('single digit padded with uppercase suffix: 1A → 01A', () => {
    assert.equal(normalizePhaseName('1A'), '01A');
  });

  test('no suffix unchanged: 16 → 16', () => {
    assert.equal(normalizePhaseName('16'), '16');
  });

  test('decimal suffix preserved: 16.1 → 16.1', () => {
    assert.equal(normalizePhaseName('16.1'), '16.1');
  });

  test('letter + decimal preserved: 16c.2 → 16c.2', () => {
    assert.equal(normalizePhaseName('16c.2'), '16c.2');
  });

  test('project code prefix stripped, suffix case preserved: CK-01a → 01a', () => {
    assert.equal(normalizePhaseName('CK-01a'), '01a');
  });
});
