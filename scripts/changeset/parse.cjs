'use strict';

/**
 * Parses a changeset fragment file (text → typed record).
 *
 *   ---
 *   type: Fixed
 *   pr: 2975
 *   ---
 *   <markdown body>
 *
 * Returns { ok: true, fragment: { type, pr, body } } on success,
 * { ok: false, reason: FRAGMENT_ERROR.X, detail } on failure.
 *
 * The reason field is a frozen enum so tests assert on stable codes,
 * not free-text error messages (CONTRIBUTING.md: "Prohibited: Raw
 * Text Matching on Test Outputs").
 */
const FRAGMENT_ERROR = Object.freeze({
  MISSING_FRONTMATTER: 'missing_frontmatter',
  MISSING_TYPE: 'missing_type',
  INVALID_TYPE: 'invalid_type',
  MISSING_PR: 'missing_pr',
  INVALID_PR: 'invalid_pr',
  EMPTY_BODY: 'empty_body',
});

const ALLOWED_TYPES = new Set(['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']);

function parseFragment(src) {
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) return { ok: false, reason: FRAGMENT_ERROR.MISSING_FRONTMATTER };
  const [, fmBlock, body] = fmMatch;

  const fields = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].trim();
  }

  if (!fields.type) return { ok: false, reason: FRAGMENT_ERROR.MISSING_TYPE };
  if (!ALLOWED_TYPES.has(fields.type)) {
    return { ok: false, reason: FRAGMENT_ERROR.INVALID_TYPE, detail: fields.type };
  }
  if (!fields.pr) return { ok: false, reason: FRAGMENT_ERROR.MISSING_PR };
  const pr = Number(fields.pr);
  if (!Number.isInteger(pr) || pr <= 0) {
    return { ok: false, reason: FRAGMENT_ERROR.INVALID_PR, detail: fields.pr };
  }
  // Use trim() only for the emptiness check; preserve the body verbatim
  // (including significant leading/trailing whitespace, code blocks, etc.)
  // so render → serialize round-trips exactly. Strip only a single trailing
  // newline added by editors so byte-equality holds for typical fragments.
  if (!body.trim()) return { ok: false, reason: FRAGMENT_ERROR.EMPTY_BODY };
  const verbatimBody = body.endsWith('\n') ? body.slice(0, -1) : body;

  return { ok: true, fragment: { type: fields.type, pr, body: verbatimBody } };
}

module.exports = { parseFragment, FRAGMENT_ERROR, ALLOWED_TYPES };
