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
// Form: `<!-- docs-exempt: <reason> -->`. The reason is the *required* human
// audit trail — without it the exemption has no paper-trail value, so a bare
// `<!-- docs-exempt -->` or empty `<!-- docs-exempt: -->` is intentionally
// rejected (the colon and a non-whitespace first reason char are mandatory).
//
// Anchored with `^...$` + `m` flag so the marker only counts when it occupies
// its own line. Inline mentions inside paragraphs (e.g. backtick-wrapped
// syntax examples in documentation) are not matched — they cannot
// accidentally exempt a fragment.
//
// The trailing `\r?` consumes the CR character of a CRLF line terminator,
// which the `$` boundary (multiline mode) does not — so Windows-authored
// fragments produce the same `body` shape as LF-authored ones. The reason
// character class `[^\r\n>]` excludes `\r` for the same reason: a CRLF
// fragment's reason text never carries a trailing `\r`.
//
// Bounded character class `[^\r\n>]` keeps the regex linear-time — no
// catastrophic backtracking on adversarial input. The leading `\S` anchor
// inside the capture group forces at least one non-whitespace character in
// the reason; trailing whitespace before `-->` is consumed by the outer
// `[ \t]*-->` and is not part of the captured reason.
const DOCS_EXEMPT_RE = /^[ \t]*<!--[ \t]*docs-exempt[ \t]*:[ \t]*(\S[^\r\n>]*?)[ \t]*-->[ \t]*\r?$/im;

function extractDocsExempt(body) {
  const m = body.match(DOCS_EXEMPT_RE);
  if (!m) return { docsExempt: null, body };
  const reason = (m[1] || '').trim();
  // Strip the marker line and tidy up the surrounding whitespace. The cleanup
  // is CRLF-aware so Windows-authored fragments don't leave residual `\r`
  // characters that would shift the `(#NNNN)` PR suffix to a blank line in
  // the rendered CHANGELOG.md / GitHub release-notes bullet.
  const cleaned = body
    .replace(DOCS_EXEMPT_RE, '')
    .replace(/[ \t\r]+$/gm, '')             // strip trailing \r/spaces on each line
    .replace(/(?:\r?\n){3,}/g, '\n\n')      // collapse 3+ blank lines (CRLF-aware)
    .replace(/[\r\n]+$/, '');               // strip every trailing line terminator
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
  // so render → serialize round-trips exactly. Strip the single trailing
  // line terminator added by editors so byte-equality holds for typical
  // fragments. CRLF-aware: a Windows-authored fragment trims `\r\n` so the
  // marker line in extractDocsExempt does not leave residual `\r` characters
  // for downstream serializers to attach `(#NNNN)` to (#3213).
  if (!body.trim()) return { ok: false, reason: FRAGMENT_ERROR.EMPTY_BODY };
  let verbatimBody;
  if (body.endsWith('\r\n')) verbatimBody = body.slice(0, -2);
  else if (body.endsWith('\n')) verbatimBody = body.slice(0, -1);
  else verbatimBody = body;
  const { docsExempt, body: visibleBody } = extractDocsExempt(verbatimBody);
  if (!visibleBody.trim()) return { ok: false, reason: FRAGMENT_ERROR.EMPTY_BODY };

  return { ok: true, fragment: { type: fields.type, pr, body: visibleBody, docsExempt } };
}

module.exports = { parseFragment, extractDocsExempt, FRAGMENT_ERROR, ALLOWED_TYPES, DOCS_EXEMPT_RE };
