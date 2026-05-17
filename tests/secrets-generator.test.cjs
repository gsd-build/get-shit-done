'use strict';

/**
 * Parity test — verifies that secrets.generated.cjs produces identical
 * results to the compiled SDK ESM output for all exported functions.
 *
 * SDK side: import('../sdk/dist/query/secrets.js')
 * CJS side: require('../get-shit-done/bin/lib/secrets.generated.cjs')
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

const requireFromRoot = createRequire(__filename);

// CJS side — direct require works fine
const cjs = requireFromRoot('../get-shit-done/bin/lib/secrets.generated.cjs');

// ── SECRET_CONFIG_KEYS ────────────────────────────────────────────────────

describe('secrets-generator parity: SECRET_CONFIG_KEYS', async () => {
  const sdk = await import('../sdk/dist/query/secrets.js');

  test('contains same keys as SDK', () => {
    const sdkKeys = [...sdk.SECRET_CONFIG_KEYS].sort();
    const cjsKeys = [...cjs.SECRET_CONFIG_KEYS].sort();
    assert.deepStrictEqual(cjsKeys, sdkKeys, 'SDK/CJS parity: SECRET_CONFIG_KEYS');
  });

  test('contains brave_search', () => {
    assert.ok(cjs.SECRET_CONFIG_KEYS.has('brave_search'));
    assert.ok(sdk.SECRET_CONFIG_KEYS.has('brave_search'));
  });

  test('contains firecrawl', () => {
    assert.ok(cjs.SECRET_CONFIG_KEYS.has('firecrawl'));
    assert.ok(sdk.SECRET_CONFIG_KEYS.has('firecrawl'));
  });

  test('contains exa_search', () => {
    assert.ok(cjs.SECRET_CONFIG_KEYS.has('exa_search'));
    assert.ok(sdk.SECRET_CONFIG_KEYS.has('exa_search'));
  });
});

// ── isSecretKey ────────────────────────────────────────────────────────────

describe('secrets-generator parity: isSecretKey', async () => {
  const sdk = await import('../sdk/dist/query/secrets.js');

  const fixtures = [
    { label: 'brave_search is secret', key: 'brave_search', expected: true },
    { label: 'firecrawl is secret', key: 'firecrawl', expected: true },
    { label: 'exa_search is secret', key: 'exa_search', expected: true },
    { label: 'non-secret key returns false', key: 'model', expected: false },
    { label: 'empty string returns false', key: '', expected: false },
    { label: 'unrelated string returns false', key: 'api_key', expected: false },
  ];

  for (const { label, key, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.isSecretKey(key);
      const cjsResult = cjs.isSecretKey(key);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── maskSecret ────────────────────────────────────────────────────────────

describe('secrets-generator parity: maskSecret', async () => {
  const sdk = await import('../sdk/dist/query/secrets.js');

  const fixtures = [
    { label: 'null returns (unset)', value: null, expected: '(unset)' },
    { label: 'undefined returns (unset)', value: undefined, expected: '(unset)' },
    { label: 'empty string returns (unset)', value: '', expected: '(unset)' },
    { label: 'short string (< 8) returns ****', value: 'abc', expected: '****' },
    { label: '7-char string returns ****', value: '1234567', expected: '****' },
    { label: '8-char string returns ****<last-4>', value: '12345678', expected: '****5678' },
    { label: 'long string returns ****<last-4>', value: 'sk-ant-abc123def456', expected: '****f456' },
  ];

  for (const { label, value, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.maskSecret(value);
      const cjsResult = cjs.maskSecret(value);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── maskIfSecret ──────────────────────────────────────────────────────────

describe('secrets-generator parity: maskIfSecret', async () => {
  const sdk = await import('../sdk/dist/query/secrets.js');

  const fixtures = [
    {
      label: 'secret key gets masked',
      key: 'brave_search',
      value: 'sk-ant-12345678',
      expectedType: 'string',
      expectedValue: '****5678',
    },
    {
      label: 'non-secret key returns value unchanged',
      key: 'model',
      value: 'claude-opus-4-5',
      expectedType: 'string',
      expectedValue: 'claude-opus-4-5',
    },
    {
      label: 'secret key with null value returns (unset)',
      key: 'firecrawl',
      value: null,
      expectedType: 'string',
      expectedValue: '(unset)',
    },
  ];

  for (const { label, key, value, expectedValue } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.maskIfSecret(key, value);
      const cjsResult = cjs.maskIfSecret(key, value);
      assert.strictEqual(sdkResult, expectedValue, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expectedValue, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});
