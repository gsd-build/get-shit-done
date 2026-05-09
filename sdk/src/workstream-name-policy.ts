/**
 * Workstream Name Policy Module
 *
 * Owns SDK-side workstream validation and slug normalization.
 */

/**
 * Validate a workstream name.
 * Allowed: alphanumeric, hyphens, underscores, dots.
 * Disallowed: empty, spaces, slashes, special chars, path traversal.
 */
export function validateWorkstreamName(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (name.includes('..')) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

export function toWorkstreamSlug(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

