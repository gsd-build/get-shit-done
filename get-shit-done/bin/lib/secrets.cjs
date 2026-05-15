'use strict';

/**
 * Secrets Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/query/secrets.ts and
 * lives in secrets.generated.cjs. This file is a thin re-export so
 * that existing call sites (config.cjs, init.cjs, and tests) can
 * continue to require('./secrets') unchanged.
 *
 * Exports (from generated file):
 *   - SECRET_CONFIG_KEYS — Set of secret key paths
 *   - isSecretKey(keyPath) — returns true if keyPath is a secret
 *   - maskSecret(value) — masks a secret value
 *   - maskIfSecret(keyPath, value) — masks value only if keyPath is secret
 *
 * Regenerate: cd sdk && npm run gen:secrets
 */

module.exports = require('./secrets.generated.cjs');
