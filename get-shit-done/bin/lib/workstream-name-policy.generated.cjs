'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/workstream-name-policy.ts
 * Regenerate: cd sdk && npm run gen:workstream-name-policy
 *
 * Canonical workstream name validation and slug normalization.
 * Used by active-workstream-store.cjs, planning-workspace.cjs, workstream.cjs.
 */

const ACTIVE_WORKSTREAM_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;
/**
 * Validate a workstream name.
 * Allowed: alphanumeric, hyphens, underscores, dots.
 * Disallowed: empty, spaces, slashes, special chars, path traversal.
 *
 * Alias for isValidActiveWorkstreamName; provided for SDK-layer callers.
 */
function validateWorkstreamName(name) {
    return isValidActiveWorkstreamName(name);
}
/**
 * Convert a display name to a URL/filesystem-safe workstream slug.
 * Lowercases, collapses non-alphanumeric runs to hyphens, strips leading/trailing hyphens.
 */
function toWorkstreamSlug(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * Returns true when `name` contains a path separator, a bare dot, or a
 * dot-dot sequence — any of which would make the name unsafe for use as a
 * filesystem path segment.
 */
function hasInvalidPathSegment(name) {
    const value = String(name || '');
    return /[/\\]/.test(value) || value === '.' || value === '..' || value.includes('..');
}
/**
 * Returns true when `name` is a valid active workstream name:
 * - Must start with alphanumeric
 * - May contain alphanumeric, dots, underscores, hyphens
 * - Must not contain path traversal sequences (..)
 */
function isValidActiveWorkstreamName(name) {
    const value = String(name || '');
    if (value === '..' || value.startsWith('../') || value.includes('..'))
        return false;
    return ACTIVE_WORKSTREAM_RE.test(value);
}

module.exports = {
  validateWorkstreamName,
  toWorkstreamSlug,
  hasInvalidPathSegment,
  isValidActiveWorkstreamName,
};
