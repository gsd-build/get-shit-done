/**
 * Workstream Name Policy Module
 *
 * Owns canonical name validation and slug normalization used by workstream and
 * active-pointer callers.
 */

const ACTIVE_WORKSTREAM_RE = /^[a-zA-Z0-9_-]+$/;

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
  return ACTIVE_WORKSTREAM_RE.test(String(name || ''));
}

module.exports = {
  toWorkstreamSlug,
  hasInvalidPathSegment,
  isValidActiveWorkstreamName,
};

