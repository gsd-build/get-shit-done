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
 * Returns { ok: true, fragment: { type, pr, body, docsExempt } } on success,
 * { ok: false, reason: FRAGMENT_ERROR.X, detail } on failure.
 *
 * `docsExempt` is `null` when the body contains no docs-exempt marker, or the
 * trimmed reason string when the body contains `<!-- docs-exempt: <reason> -->`
 * (#3213). The marker is stripped from `body` at parse time so it never bleeds
 * into the CHANGELOG.md or GitHub release-notes serializers, which append the
 * `(#NNNN)` PR suffix verbatim to the body's last line.
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

// HTML comment marking a fragment as exempt from the docs-required lint (#3213).
// Form: `<!-- docs-exempt: <reason> -->`. Reason is the human paper trail.
//
// Anchored with `^...$` + `m` flag so the marker only counts when it occupies
// its own line. Inline mentions inside paragraphs (e.g. backtick-wrapped
// syntax examples in documentation) are not matched — they cannot
// accidentally exempt a fragment.
//
// Bounded character class `[^\n>]` keeps the regex linear-time — no
// catastrophic backtracking on adversarial input.
const DOCS_EXEMPT_RE = /^[ \t]*<!--[ \t]*docs-exempt[ \t]*(?::[ \t]*([^\n>]*?))?[ \t]*-->[ \t]*$/im;

function extractDocsExempt(body) {
  const m = body.match(DOCS_EXEMPT_RE);
  if (!m) return { docsExempt: null, body };
  const reason = (m[1] || '').trim();
  // Strip the matched comment plus any single trailing newline so collapsed
  // bodies don't accumulate blank-line padding. Collapse 3+ consecutive
  // newlines down to the two-newline paragraph break Keep-a-Changelog uses.
  const cleaned = body
    .replace(DOCS_EXEMPT_RE, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '');
  return { docsExempt: reason, body: cleaned };
}

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
  const { docsExempt, body: visibleBody } = extractDocsExempt(verbatimBody);
  if (!visibleBody.trim()) return { ok: false, reason: FRAGMENT_ERROR.EMPTY_BODY };

  return { ok: true, fragment: { type: fields.type, pr, body: visibleBody, docsExempt } };
}

module.exports = { parseFragment, extractDocsExempt, FRAGMENT_ERROR, ALLOWED_TYPES, DOCS_EXEMPT_RE };
