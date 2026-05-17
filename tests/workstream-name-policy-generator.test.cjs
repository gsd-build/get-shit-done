'use strict';

/**
 * Parity test: workstream-name-policy.generated.cjs vs sdk/src/workstream-name-policy.ts
 *
 * Verifies that the generated CJS artifact matches the SDK source-of-truth
 * for all exports: toWorkstreamSlug, hasInvalidPathSegment, isValidActiveWorkstreamName,
 * validateWorkstreamName.
 *
 * Covers: Phase 6 (#3575) MIGRATE_ME resolution for workstream-name-policy.cjs.
 */

const assert = require('assert');
const { describe, test } = require('node:test');
const {
  toWorkstreamSlug,
  hasInvalidPathSegment,
  isValidActiveWorkstreamName,
  validateWorkstreamName,
} = require('../get-shit-done/bin/lib/workstream-name-policy.cjs');

// ─── toWorkstreamSlug ────────────────────────────────────────────────────────

describe('workstream-name-policy — toWorkstreamSlug', () => {
  test('lowercases and collapses non-alphanumeric to hyphens', () => {
    assert.strictEqual(toWorkstreamSlug('My Feature Branch'), 'my-feature-branch');
    assert.strictEqual(toWorkstreamSlug('hello_world'), 'hello-world');
    assert.strictEqual(toWorkstreamSlug('API v2'), 'api-v2');
  });

  test('strips leading/trailing hyphens', () => {
    assert.strictEqual(toWorkstreamSlug('--foo--'), 'foo');
    assert.strictEqual(toWorkstreamSlug('  spaces  '), 'spaces');
  });

  test('handles empty and nullish values', () => {
    assert.strictEqual(toWorkstreamSlug(''), '');
    assert.strictEqual(toWorkstreamSlug(null), '');
    assert.strictEqual(toWorkstreamSlug(undefined), '');
  });

  test('handles already-valid slug', () => {
    assert.strictEqual(toWorkstreamSlug('my-feature'), 'my-feature');
    assert.strictEqual(toWorkstreamSlug('v2'), 'v2');
  });
});

// ─── hasInvalidPathSegment ───────────────────────────────────────────────────

describe('workstream-name-policy — hasInvalidPathSegment', () => {
  test('returns true for names with forward slash', () => {
    assert.strictEqual(hasInvalidPathSegment('foo/bar'), true);
  });

  test('returns true for names with backslash', () => {
    assert.strictEqual(hasInvalidPathSegment('foo\\bar'), true);
  });

  test('returns true for bare dot', () => {
    assert.strictEqual(hasInvalidPathSegment('.'), true);
  });

  test('returns true for double dot', () => {
    assert.strictEqual(hasInvalidPathSegment('..'), true);
  });

  test('returns true for names containing dot-dot sequence', () => {
    assert.strictEqual(hasInvalidPathSegment('foo..bar'), true);
    assert.strictEqual(hasInvalidPathSegment('../etc'), true);
  });

  test('returns false for valid workstream names', () => {
    assert.strictEqual(hasInvalidPathSegment('my-feature'), false);
    assert.strictEqual(hasInvalidPathSegment('v2'), false);
    assert.strictEqual(hasInvalidPathSegment('feature.experimental'), false);
    assert.strictEqual(hasInvalidPathSegment('alpha_1'), false);
  });

  test('handles empty and nullish values', () => {
    assert.strictEqual(hasInvalidPathSegment(''), false);
    assert.strictEqual(hasInvalidPathSegment(null), false);
    assert.strictEqual(hasInvalidPathSegment(undefined), false);
  });
});

// ─── isValidActiveWorkstreamName ─────────────────────────────────────────────

describe('workstream-name-policy — isValidActiveWorkstreamName', () => {
  test('returns true for valid alphanumeric names', () => {
    assert.strictEqual(isValidActiveWorkstreamName('feature'), true);
    assert.strictEqual(isValidActiveWorkstreamName('v2'), true);
    assert.strictEqual(isValidActiveWorkstreamName('my-branch'), true);
    assert.strictEqual(isValidActiveWorkstreamName('feature.experimental'), true);
    assert.strictEqual(isValidActiveWorkstreamName('alpha_1'), true);
    assert.strictEqual(isValidActiveWorkstreamName('A1'), true);
  });

  test('returns false for names starting with non-alphanumeric', () => {
    assert.strictEqual(isValidActiveWorkstreamName('-feature'), false);
    assert.strictEqual(isValidActiveWorkstreamName('.feature'), false);
    assert.strictEqual(isValidActiveWorkstreamName('_feature'), false);
  });

  test('returns false for names with path traversal', () => {
    assert.strictEqual(isValidActiveWorkstreamName('..'), false);
    assert.strictEqual(isValidActiveWorkstreamName('../etc'), false);
    assert.strictEqual(isValidActiveWorkstreamName('foo..bar'), false);
  });

  test('returns false for names with slashes', () => {
    assert.strictEqual(isValidActiveWorkstreamName('foo/bar'), false);
    assert.strictEqual(isValidActiveWorkstreamName('foo\\bar'), false);
  });

  test('returns false for names with spaces', () => {
    assert.strictEqual(isValidActiveWorkstreamName('my feature'), false);
  });

  test('returns false for empty string', () => {
    assert.strictEqual(isValidActiveWorkstreamName(''), false);
  });

  test('returns false for nullish values', () => {
    assert.strictEqual(isValidActiveWorkstreamName(null), false);
    assert.strictEqual(isValidActiveWorkstreamName(undefined), false);
  });
});

// ─── validateWorkstreamName (SDK alias) ──────────────────────────────────────

describe('workstream-name-policy — validateWorkstreamName (SDK alias)', () => {
  test('is an alias for isValidActiveWorkstreamName', () => {
    const testCases = [
      'feature', 'v2', 'my-branch', '-bad', '', null, undefined,
      'foo/bar', '..', 'foo..bar', 'A1', 'alpha_1',
    ];
    for (const tc of testCases) {
      assert.strictEqual(
        validateWorkstreamName(tc),
        isValidActiveWorkstreamName(tc),
        `validateWorkstreamName and isValidActiveWorkstreamName should agree on: ${JSON.stringify(tc)}`,
      );
    }
  });
});
