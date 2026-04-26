/**
 * GSD Tools Tests - MODEL_ALIAS_MAP
 *
 * Verifies that model aliases map to current Claude model IDs.
 * Regression test for #1690: aliases were pointing to outdated model versions.
 *
 * Uses node:test and node:assert/strict (NOT Jest).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { MODEL_ALIAS_MAP } = require('../get-shit-done/bin/lib/core.cjs');

describe('MODEL_ALIAS_MAP (#1690 regression)', () => {
  test('opus maps to claude-opus-4-7', () => {
    assert.equal(MODEL_ALIAS_MAP.opus, 'claude-opus-4-7');
  });

  test('sonnet maps to claude-sonnet-4-6', () => {
    assert.equal(MODEL_ALIAS_MAP.sonnet, 'claude-sonnet-4-6');
  });

  test('haiku maps to claude-haiku-4-5', () => {
    assert.equal(MODEL_ALIAS_MAP.haiku, 'claude-haiku-4-5');
  });
});
