'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/secrets.ts
 * Regenerate: cd sdk && npm run gen:secrets
 *
 * Secrets handling — masking convention for API keys and other
 * credentials managed via /gsd-settings-integrations.
 * This module does not read the filesystem.
 */

const SECRET_CONFIG_KEYS = new Set([
  'brave_search',
  'firecrawl',
  'exa_search',
]);

function isSecretKey(keyPath) {
    return SECRET_CONFIG_KEYS.has(keyPath);
}

function maskSecret(value) {
    if (value === null || value === undefined || value === '')
        return '(unset)';
    const s = String(value);
    if (s.length < 8)
        return '****';
    return '****' + s.slice(-4);
}

function maskIfSecret(keyPath, value) {
    return isSecretKey(keyPath) ? maskSecret(value) : value;
}

module.exports = { SECRET_CONFIG_KEYS, isSecretKey, maskSecret, maskIfSecret };
