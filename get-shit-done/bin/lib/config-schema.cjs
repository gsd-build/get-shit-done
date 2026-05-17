'use strict';

/**
 * Thin adapter — sources schema data from the manifest via the generated
 * Configuration Module. All inline literals have been removed; the manifest
 * at sdk/shared/config-schema.manifest.json is the single source of truth.
 *
 * Imported by:
 *   - config.cjs (isValidConfigKey validator)
 *   - tests/config-schema-docs-parity.test.cjs (CI drift guard)
 *   - tests/config-schema-sdk-parity.test.cjs (CJS↔SDK parity guard)
 *
 * See Phase 2 Cycle 5 (#3536) — schema manifest migration.
 */

const {
  VALID_CONFIG_KEYS,
  RUNTIME_STATE_KEYS,
  DYNAMIC_KEY_PATTERNS,
} = require('./configuration.generated.cjs');

/**
 * Returns true if keyPath is a valid config key (exact, dynamic pattern, or runtime state).
 */
function isValidConfigKey(keyPath) {
  if (VALID_CONFIG_KEYS.has(keyPath)) return true;
  if (RUNTIME_STATE_KEYS.has(keyPath)) return true;
  return DYNAMIC_KEY_PATTERNS.some((p) => p.test(keyPath));
}

module.exports = { VALID_CONFIG_KEYS, RUNTIME_STATE_KEYS, DYNAMIC_KEY_PATTERNS, isValidConfigKey };
