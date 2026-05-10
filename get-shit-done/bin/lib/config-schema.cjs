'use strict';

/**
 * Thin CJS Adapter over the Config Schema Module shared data.
 *
 * Imported by:
 *   - config.cjs (isValidConfigKey validator)
 *   - tests/config-schema-docs-parity.test.cjs (CI drift guard)
 *
 * Adding a key to the shared schema without documenting it in docs/CONFIGURATION.md will
 * fail the parity test. Adding a key to docs/CONFIGURATION.md without
 * adding it here will cause config-set to reject it at runtime.
 */

const CONFIG_SCHEMA_DATA = require('../../../sdk/shared/config-schema.json');

/** Exact-match config key paths accepted by config-set. */
const VALID_CONFIG_KEYS = new Set(CONFIG_SCHEMA_DATA.validConfigKeys);

/**
 * Internal runtime-state keys — accepted by config-set (workflows write them) but not
 * exposed as user-settable options.  Excluded from VALID_CONFIG_KEYS so they stay out of
 * the public docs-parity check and the "Valid keys:" error message.
 * See: #3162 (workflow._auto_chain_active written by plan/execute/discuss workflows)
 */
const RUNTIME_STATE_KEYS = new Set(CONFIG_SCHEMA_DATA.runtimeStateKeys);

/**
 * Dynamic-pattern validators — keys matching these regexes are also accepted.
 * Each entry has a `test` function and a human-readable `description`.
 */
const DYNAMIC_KEY_PATTERNS = CONFIG_SCHEMA_DATA.dynamicKeyPatterns.map((pattern) => {
  const regex = new RegExp(pattern.source);
  return {
    topLevel: pattern.topLevel,
    source: pattern.source,
    description: pattern.description,
    test: (k) => regex.test(k),
  };
});

/**
 * Returns true if keyPath is a valid config key (exact, dynamic pattern, or runtime state).
 */
function isValidConfigKey(keyPath) {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  if (RUNTIME_STATE_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}

module.exports = { CONFIG_SCHEMA_DATA, VALID_CONFIG_KEYS, RUNTIME_STATE_KEYS, DYNAMIC_KEY_PATTERNS, isValidConfigKey };
