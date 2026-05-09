/**
 * Workstream Name Policy Module
 *
 * Owns canonical name validation and slug normalization used by workstream and
 * active-pointer callers.
 */

const ACTIVE_WORKSTREAM_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function toWorkstreamSlug(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hasInvalidPathSegment(name) {
  const value = String(name || '');
  return /[/\\]/.test(value) || value === '.' || value === '..' || value.includes('..');
}

function isValidActiveWorkstreamName(name) {
  const value = String(name || '');
  if (value === '..' || value.startsWith('../') || value.includes('..')) return false;
  return ACTIVE_WORKSTREAM_RE.test(value);
}

module.exports = {
  toWorkstreamSlug,
  hasInvalidPathSegment,
  isValidActiveWorkstreamName,
};

