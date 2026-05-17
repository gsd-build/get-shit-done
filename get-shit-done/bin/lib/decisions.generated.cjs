'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/decisions.ts
 * Regenerate: cd sdk && npm run gen:decisions
 *
 * Shared parser for CONTEXT.md <decisions> blocks.
 * Accepts both numeric (D-42) and alphanumeric (D-INFRA-01) IDs.
 * Returns {id, text, category, tags, trackable} per decision.
 * CJS callers that only use {id, text} safely ignore the extra fields.
 */

const DISCRETION_HEADINGS = new Set([
    "claude's discretion",
    'claudes discretion',
    'claude discretion',
]);
const NON_TRACKABLE_TAGS = new Set(['informational', 'folded', 'deferred']);
/**
 * Strip fenced code blocks from `content` so example `<decisions>` snippets
 * inside ```` ``` ```` do not pollute the parser (review F11).
 */
function stripFencedCode(content) {
    return content.replace(/```[\s\S]*?```/g, ' ').replace(/~~~[\s\S]*?~~~/g, ' ');
}
/**
 * Extract the inner text of EVERY `<decisions>...</decisions>` block in
 * order, concatenated by `\n\n`. Returns null when no block is present.
 *
 * CONTEXT.md may legitimately contain more than one block (for example, a
 * "current decisions" block plus a "carry-over from prior phase" block);
 * dropping all-but-the-first silently lost the second batch (review F13).
 */
function extractDecisionsBlock(content) {
    const cleaned = stripFencedCode(content);
    const matches = [...cleaned.matchAll(/<decisions>([\s\S]*?)<\/decisions>/g)];
    if (matches.length === 0)
        return null;
    return matches.map((m) => m[1]).join('\n\n');
}
/**
 * Parse trackable decisions from CONTEXT.md content.
 *
 * Returns ALL D-NN decisions found inside `<decisions>` (including
 * non-trackable ones, with `trackable: false`). Callers that only want the
 * gate-enforced decisions should filter `.filter(d => d.trackable)`.
 */
function parseDecisions(content) {
    if (!content || typeof content !== 'string')
        return [];
    const block = extractDecisionsBlock(content);
    if (block === null)
        return [];
    const lines = block.split(/\r?\n/);
    const out = [];
    let category = '';
    let inDiscretion = false;
    // Bullet line: `- **D-NN[ [tags]]:** text`
    // Phase 6 (#3575): aligned to CJS regex — accepts alphanumeric IDs (D-01, D-INFRA-01, D-FOO_BAR)
    // in addition to numeric-only IDs (D-42). The first character after `D-` must
    // be alphanumeric, so malformed shapes like `D--foo` or `D-_bar` are rejected.
    // CJS callers consume {id, text} and ignore the optional extras.
    const bulletRe = /^\s*-\s+\*\*D-([A-Za-z0-9][A-Za-z0-9_-]*)(?:\s*\[([^\]]+)\])?\s*:\*\*\s*(.*)$/;
    let current = null;
    const flush = () => {
        if (current) {
            current.text = current.text.trim();
            out.push(current);
            current = null;
        }
    };
    for (const line of lines) {
        const trimmed = line.trim();
        // Track category headings (`### Heading`)
        const headingMatch = trimmed.match(/^###\s+(.+?)\s*$/);
        if (headingMatch) {
            flush();
            category = headingMatch[1];
            // Strip the full unicode-quote family so any rendering of "Claude's
            // Discretion" (ASCII apostrophe, curly U+2019, U+2018, U+201A, U+201B,
            // double-quote variants U+201C/D/E/F, etc.) collapses to the same key
            // (review F20).
            const normalized = category
                .toLowerCase()
                .replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F'"`]/g, '')
                .trim();
            inDiscretion = DISCRETION_HEADINGS.has(normalized);
            continue;
        }
        const bulletMatch = line.match(bulletRe);
        if (bulletMatch) {
            flush();
            const id = `D-${bulletMatch[1]}`;
            const tags = bulletMatch[2]
                ? bulletMatch[2]
                    .split(',')
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean)
                : [];
            const trackable = !inDiscretion && !tags.some((t) => NON_TRACKABLE_TAGS.has(t));
            current = { id, text: bulletMatch[3], category, tags, trackable };
            continue;
        }
        // Continuation line for current decision (indented with space OR tab,
        // non-bullet, non-empty) — tab indentation must work too (review F12).
        if (current && trimmed !== '' && !trimmed.startsWith('-') && /^[ \t]/.test(line)) {
            current.text += ' ' + trimmed;
            continue;
        }
        // Blank line or unrelated content terminates the current decision
        if (trimmed === '') {
            flush();
        }
    }
    flush();
    return out;
}

module.exports = { parseDecisions };
