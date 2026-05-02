'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Asserts every exact-match key in config-schema.cjs appears at least once
 * in docs/CONFIGURATION.md. A key present in the validator but absent from
 * the docs means users can set it but have no guidance. A key in the docs but
 * absent from the validator means config-set silently rejects it.
 *
 * Dynamic patterns (agent_skills.*, review.models.*, features.*) are excluded
 * from this check — they are documented by namespace in CONFIGURATION.md.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const { VALID_CONFIG_KEYS } = require('../get-shit-done/bin/lib/config-schema.cjs');
const CONFIGURATION_MD = fs.readFileSync(path.join(ROOT, 'docs', 'CONFIGURATION.md'), 'utf8');

// Reserved for future internal keys; workflow._auto_chain_active removed from VALID_CONFIG_KEYS (#2530).
const INTERNAL_KEYS = new Set();

test('every key in VALID_CONFIG_KEYS is documented in docs/CONFIGURATION.md', () => {
  const undocumented = [];
  for (const key of VALID_CONFIG_KEYS) {
    if (INTERNAL_KEYS.has(key)) continue;
    if (!CONFIGURATION_MD.includes('`' + key + '`')) {
      undocumented.push(key);
    }
  }
  assert.deepStrictEqual(
    undocumented,
    [],
    'Keys in VALID_CONFIG_KEYS with no mention in docs/CONFIGURATION.md:\n' +
    undocumented.map((k) => '  ' + k).join('\n') +
    '\nAdd a row in the appropriate section of docs/CONFIGURATION.md.',
  );
});
