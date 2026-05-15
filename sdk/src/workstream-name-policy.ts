/**
 * Workstream Name Policy Module
 *
 * Owns canonical workstream name validation and slug normalization.
 * Shared by CJS runtime (active-workstream-store.cjs, planning-workspace.cjs,
 * workstream.cjs) and SDK layer.
 *
 * Phase 6 (#3575): added hasInvalidPathSegment and isValidActiveWorkstreamName
 * from CJS bin/lib/workstream-name-policy.cjs to complete the MIGRATE_ME migration.
 */

const ACTIVE_WORKSTREAM_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/**
 * Validate a workstream name.
 * Allowed: alphanumeric, hyphens, underscores, dots.
 * Disallowed: empty, spaces, slashes, special chars, path traversal.
 *
 * Alias for isValidActiveWorkstreamName; provided for SDK-layer callers.
 */
export function validateWorkstreamName(name: string): boolean {
  return isValidActiveWorkstreamName(name);
}

/**
 * Convert a display name to a URL/filesystem-safe workstream slug.
 * Lowercases, collapses non-alphanumeric runs to hyphens, strips leading/trailing hyphens.
 */
export function toWorkstreamSlug(name: string): string {
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
export function hasInvalidPathSegment(name: string): boolean {
  const value = String(name || '');
  return /[/\\]/.test(value) || value === '.' || value === '..' || value.includes('..');
}

/**
 * Returns true when `name` is a valid active workstream name:
 * - Must start with alphanumeric
 * - May contain alphanumeric, dots, underscores, hyphens
 * - Must not contain path traversal sequences (..)
 */
export function isValidActiveWorkstreamName(name: string): boolean {
  const value = String(name || '');
  if (value === '..' || value.startsWith('../') || value.includes('..')) return false;
  return ACTIVE_WORKSTREAM_RE.test(value);
}

