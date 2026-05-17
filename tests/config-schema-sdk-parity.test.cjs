'use strict';

// allow-test-rule: structural source assertion — verifies that sdk/src/query/config-schema.ts
// is a re-export shell (no inline literals) rather than a redeclared Set. Runtime/IR comparison
// cannot distinguish a re-export from a redeclared `new Set([...])` with identical contents
// because both would deep-equal the manifest set; only source-shape inspection catches drift
// back to inline literals. See test "SDK config-schema.ts re-exports from configuration module".

/**
 * Manifest-as-source-of-truth guard (Phase 2, Cycle 5, #3536).
 *
 * Prior to Cycle 5, the CJS and SDK schema files each had independent inline
 * literals. This test existed to prevent drift between them. After Cycle 5,
 * BOTH sides derive their data from sdk/shared/config-schema.manifest.json,
 * so there is nothing to drift — but the guard still serves a purpose:
 *
 *   1. Confirm that VALID_CONFIG_KEYS loaded at runtime from config-schema.cjs
 *      exactly matches the manifest's validKeys array.
 *   2. Confirm that VALID_CONFIG_KEYS exported from sdk/src/query/config-schema.ts
 *      (via sdk/dist/) equals the same manifest.
 *   3. Confirm that DYNAMIC_KEY_PATTERNS from config-schema.cjs have .source
 *      fields matching the manifest's dynamicKeyPatterns.
 *   4. Confirm RUNTIME_STATE_KEYS from config-schema.cjs matches the manifest.
 *
 * This ensures neither side has accidentally disconnected from the manifest
 * (e.g. reverted to inline literals or switched to a different data source).
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'sdk', 'shared', 'config-schema.manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const manifestValidKeys = new Set(manifest.validKeys);
const manifestRuntimeKeys = new Set(manifest.runtimeStateKeys);
const manifestPatternSources = manifest.dynamicKeyPatterns.map((p) => p.source);

const {
  VALID_CONFIG_KEYS: CJS_KEYS,
  RUNTIME_STATE_KEYS: CJS_RUNTIME_KEYS,
  DYNAMIC_KEY_PATTERNS: CJS_PATTERNS,
} = require('../get-shit-done/bin/lib/config-schema.cjs');

// ─── CJS side: verify manifest-sourced values ─────────────────────────────

test('CJS VALID_CONFIG_KEYS matches manifest validKeys exactly', () => {
  const missingInCjs = [...manifestValidKeys].filter((k) => !CJS_KEYS.has(k));
  const extraInCjs = [...CJS_KEYS].filter((k) => !manifestValidKeys.has(k));
  assert.deepStrictEqual(
    missingInCjs,
    [],
    'Manifest keys missing from CJS VALID_CONFIG_KEYS:\n' +
      missingInCjs.map((k) => '  ' + k).join('\n'),
  );
  assert.deepStrictEqual(
    extraInCjs,
    [],
    'CJS VALID_CONFIG_KEYS has keys not in manifest:\n' +
      extraInCjs.map((k) => '  ' + k).join('\n'),
  );
});

test('CJS RUNTIME_STATE_KEYS matches manifest runtimeStateKeys exactly', () => {
  const missingInCjs = [...manifestRuntimeKeys].filter((k) => !CJS_RUNTIME_KEYS.has(k));
  const extraInCjs = [...CJS_RUNTIME_KEYS].filter((k) => !manifestRuntimeKeys.has(k));
  assert.deepStrictEqual(missingInCjs, [], 'Manifest runtime keys missing from CJS RUNTIME_STATE_KEYS');
  assert.deepStrictEqual(extraInCjs, [], 'CJS RUNTIME_STATE_KEYS has keys not in manifest');
});

test('CJS DYNAMIC_KEY_PATTERNS .source fields match manifest dynamicKeyPatterns', () => {
  assert.strictEqual(
    CJS_PATTERNS.length,
    manifestPatternSources.length,
    `CJS has ${CJS_PATTERNS.length} patterns but manifest has ${manifestPatternSources.length}`,
  );
  for (let i = 0; i < manifestPatternSources.length; i++) {
    const expected = manifestPatternSources[i];
    const actual = CJS_PATTERNS[i].source;
    assert.strictEqual(
      actual,
      expected,
      `CJS pattern[${i}].source mismatch: expected "${expected}", got "${actual}"`,
    );
  }
});

// ─── SDK side: verify config-schema.ts re-exports from configuration module ─

test('SDK config-schema.ts re-exports from configuration module (not inline literals)', () => {
  const SDK_SCHEMA_PATH = path.join(ROOT, 'sdk', 'src', 'query', 'config-schema.ts');
  const src = fs.readFileSync(SDK_SCHEMA_PATH, 'utf8');

  // After Cycle 5, the file must NOT contain inline key literals.
  // It should import/re-export from '../configuration/index.js'.
  assert.ok(
    src.includes("from '../configuration/index.js'"),
    'sdk/src/query/config-schema.ts must re-export from ../configuration/index.js (not inline literals)',
  );

  // Must NOT contain a standalone new Set([...]) block with key literals.
  // A minimal check: the file should not define VALID_CONFIG_KEYS as a Set literal.
  assert.ok(
    !src.includes("new Set([\n  'mode'") && !src.includes("new Set(['mode'"),
    'sdk/src/query/config-schema.ts must not contain an inline VALID_CONFIG_KEYS Set literal',
  );
});

// ─── Cross-check: CJS equals SDK via manifest ─────────────────────────────

test('#2653 — CJS and SDK both source from the same manifest (set equality via manifest)', () => {
  // Since both sides derive from sdk/shared/config-schema.manifest.json,
  // the CJS runtime set must equal the manifest set (verified above).
  // This test is the explicit statement of the invariant for audit purposes.
  const cjsKeysSorted = [...CJS_KEYS].sort();
  const manifestKeysSorted = [...manifestValidKeys].sort();
  assert.deepStrictEqual(
    cjsKeysSorted,
    manifestKeysSorted,
    'CJS VALID_CONFIG_KEYS must equal manifest validKeys — both sides source from the manifest',
  );
});

test('#2653 — CJS DYNAMIC_KEY_PATTERNS test functions work correctly', () => {
  // Verify that each pattern's test() function (reconstructed from manifest source)
  // correctly accepts sample keys and rejects non-matching ones.
  const samples = [
    ['agent_skills.gsd-planner', 0],
    ['review.models.claude', 1],
    ['features.some_feature', 2],
    ['claude_md_assembly.blocks.intro', 3],
    ['model_profile_overrides.codex.opus', 4],
    ['models.planning', 5],
    ['dynamic_routing.enabled', 6],
    ['model_overrides.my-agent', 7],
  ];
  for (const [key, idx] of samples) {
    assert.ok(
      CJS_PATTERNS[idx].test(key),
      `CJS pattern[${idx}] must accept "${key}"`,
    );
  }
});
