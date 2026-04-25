'use strict';

/**
 * CJS↔SDK config-schema parity (#2653).
 *
 * The SDK has its own config-set handler at sdk/src/query/config-mutation.ts,
 * which validates keys against sdk/src/query/config-schema.ts. That allowlist
 * MUST match the CJS allowlist at get-shit-done/bin/lib/config-schema.cjs or
 * SDK users are told "Unknown config key" for documented keys (regression
 * that #2653 fixes).
 *
 * This test parses the TS file as text (to avoid requiring a TS toolchain
 * in the node:test runner) and asserts:
 *   1. Every key in CJS VALID_CONFIG_KEYS appears in the SDK literal set.
 *   2. Every dynamic pattern source in CJS has an identical counterpart
 *      in the SDK file.
 *   3. The reverse direction — SDK has no keys/patterns the CJS side lacks.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { VALID_CONFIG_KEYS: CJS_KEYS, DYNAMIC_KEY_PATTERNS: CJS_PATTERNS } =
  require('../get-shit-done/bin/lib/config-schema.cjs');

const SDK_SCHEMA_PATH = path.join(ROOT, 'sdk', 'src', 'query', 'config-schema.ts');
const SDK_SRC = fs.readFileSync(SDK_SCHEMA_PATH, 'utf8');

function extractSdkKeys(src) {
  const start = src.indexOf('VALID_CONFIG_KEYS');
  assert.ok(start > -1, 'SDK config-schema.ts must export VALID_CONFIG_KEYS');
  const setOpen = src.indexOf('new Set([', start);
  const setClose = src.indexOf('])', setOpen);
  assert.ok(setOpen > -1 && setClose > -1, 'VALID_CONFIG_KEYS must be a new Set([...]) literal');
  const body = src.slice(setOpen + 'new Set(['.length, setClose);
  const keys = new Set();
  for (const match of body.matchAll(/'([^']+)'/g)) keys.add(match[1]);
  return keys;
}

function extractSdkPatternSources(src) {
  const sources = [];
  for (const match of src.matchAll(/source:\s*'([^']+)'/g)) {
    // TS source file stores escape sequences; convert \\ -> \ so the
    // extracted value matches RegExp.source from the CJS side.
    sources.push(match[1].replace(/\\\\/g, '\\'));
  }
  return sources;
}

test('#2653 — SDK VALID_CONFIG_KEYS matches CJS VALID_CONFIG_KEYS', () => {
  const sdkKeys = extractSdkKeys(SDK_SRC);
  const missingInSdk = [...CJS_KEYS].filter((k) => !sdkKeys.has(k));
  const extraInSdk = [...sdkKeys].filter((k) => !CJS_KEYS.has(k));
  assert.deepStrictEqual(
    missingInSdk,
    [],
    'CJS keys missing from sdk/src/query/config-schema.ts:\n' +
      missingInSdk.map((k) => '  ' + k).join('\n'),
  );
  assert.deepStrictEqual(
    extraInSdk,
    [],
    'SDK keys missing from get-shit-done/bin/lib/config-schema.cjs:\n' +
      extraInSdk.map((k) => '  ' + k).join('\n'),
  );
});

test('#2653 — SDK DYNAMIC_KEY_PATTERNS sources match CJS regex .source', () => {
  const sdkSources = new Set(extractSdkPatternSources(SDK_SRC));
  const cjsSources = CJS_PATTERNS.map((p) => {
    // Reconstruct each CJS pattern's .source by probing with a known string
    // that identifies the regex. CJS stores a `test` arrow only, so derive
    // `.source` by running against sentinel inputs — instead, inspect function
    // text as a fallback cross-check.
    const fnSrc = p.test.toString();
    const regexMatch = fnSrc.match(/\/(\^[^/]+\$)\//);
    assert.ok(regexMatch, 'CJS dynamic pattern test function must embed a literal regex: ' + fnSrc);
    return regexMatch[1];
  });
  for (const src of cjsSources) {
    assert.ok(
      sdkSources.has(src),
      `CJS dynamic pattern ${src} not mirrored in SDK config-schema.ts (sources: ${[...sdkSources].join(', ')})`,
    );
  }
  for (const src of sdkSources) {
    assert.ok(
      cjsSources.includes(src),
      `SDK dynamic pattern ${src} not mirrored in CJS config-schema.cjs`,
    );
  }
});
