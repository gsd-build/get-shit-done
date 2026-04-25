'use strict';

/**
 * Secrets handling — masking convention for API keys and other
 * credentials managed via /gsd-settings-integrations.
 *
 * Convention: strings 8+ chars long render as `****<last-4>`; shorter
 * strings render as `****` with no tail (to avoid leaking a meaningful
 * fraction of a short secret). null/empty renders as `(unset)`.
 *
 * Keys considered sensitive are listed in SECRET_CONFIG_KEYS and matched
 * at the exact key-path level. The list is intentionally narrow — these
 * are the fields documented as secrets in docs/CONFIGURATION.md.
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
  if (value === null || value === undefined || value === '') return '(unset)';
  const s = String(value);
  if (s.length < 8) return '****';
  return '****' + s.slice(-4);
}

module.exports = { SECRET_CONFIG_KEYS, isSecretKey, maskSecret };
