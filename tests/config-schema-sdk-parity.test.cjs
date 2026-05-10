'use strict';

/**
 * Config Schema Module Interface coverage.
 *
 * CJS and SDK config-schema files are thin Adapters over sdk/shared/config-schema.json.
 * These tests assert both Adapters project the same shared Interface instead of
 * parsing mirrored source text.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
const {
  CONFIG_SCHEMA_DATA: CJS_DATA,
  VALID_CONFIG_KEYS: CJS_KEYS,
  RUNTIME_STATE_KEYS: CJS_RUNTIME_KEYS,
  DYNAMIC_KEY_PATTERNS: CJS_PATTERNS,
} =
  require('../get-shit-done/bin/lib/config-schema.cjs');

const SHARED_SCHEMA = require('../sdk/shared/config-schema.json');
const SDK_SCHEMA_URL = pathToFileURL(path.join(ROOT, 'sdk', 'dist', 'query', 'config-schema.js')).href;

test('shared config-schema data has the expected shape', () => {
  assert.ok(Array.isArray(SHARED_SCHEMA.validConfigKeys), 'validConfigKeys must be an array');
  assert.ok(Array.isArray(SHARED_SCHEMA.runtimeStateKeys), 'runtimeStateKeys must be an array');
  assert.ok(Array.isArray(SHARED_SCHEMA.dynamicKeyPatterns), 'dynamicKeyPatterns must be an array');
  assert.equal(new Set(SHARED_SCHEMA.validConfigKeys).size, SHARED_SCHEMA.validConfigKeys.length, 'validConfigKeys must not contain duplicates');
  assert.equal(new Set(SHARED_SCHEMA.runtimeStateKeys).size, SHARED_SCHEMA.runtimeStateKeys.length, 'runtimeStateKeys must not contain duplicates');
  for (const pattern of SHARED_SCHEMA.dynamicKeyPatterns) {
    assert.equal(typeof pattern.topLevel, 'string');
    assert.equal(typeof pattern.source, 'string');
    assert.equal(typeof pattern.description, 'string');
    assert.doesNotThrow(() => new RegExp(pattern.source), `invalid dynamic pattern source: ${pattern.source}`);
  }
});

test('CJS Adapter projects the shared Config Schema Module data', () => {
  assert.deepStrictEqual(CJS_DATA, SHARED_SCHEMA);
  assert.deepStrictEqual([...CJS_KEYS], SHARED_SCHEMA.validConfigKeys);
  assert.deepStrictEqual([...CJS_RUNTIME_KEYS], SHARED_SCHEMA.runtimeStateKeys);
  assert.deepStrictEqual(
    CJS_PATTERNS.map(({ topLevel, source, description }) => ({ topLevel, source, description })),
    SHARED_SCHEMA.dynamicKeyPatterns,
  );
});

test('SDK Adapter projects the shared Config Schema Module data', async () => {
  const sdkSchema = await import(SDK_SCHEMA_URL);
  assert.deepStrictEqual(sdkSchema.CONFIG_SCHEMA_DATA, SHARED_SCHEMA);
  assert.deepStrictEqual([...sdkSchema.VALID_CONFIG_KEYS], SHARED_SCHEMA.validConfigKeys);
  assert.deepStrictEqual([...sdkSchema.RUNTIME_STATE_KEYS], SHARED_SCHEMA.runtimeStateKeys);
  assert.deepStrictEqual(
    sdkSchema.DYNAMIC_KEY_PATTERNS.map(({ topLevel, source, description }) => ({ topLevel, source, description })),
    SHARED_SCHEMA.dynamicKeyPatterns,
  );
});
