'use strict';

/**
 * Shared parser for CONTEXT.md `<decisions>` blocks.
 *
 * Used by:
 *   - gap-checker.cjs (#2493 post-planning gap analysis)
 *   - intended for #2492 (plan-phase decision gate, verify-phase decision validator)
 *
 * Format produced by discuss-phase.md:
 *
 *   <decisions>
 *   ## Implementation Decisions
 *
 *   ### Category
 *   - **D-01:** Decision text
 *   - **D-02:** Another decision
 *   </decisions>
 *
 * D-IDs outside the <decisions> block are ignored. Missing block returns [].
 */

/**
 * Parse the <decisions> section of a CONTEXT.md string.
 *
 * @param {string|null|undefined} contextMd - File contents, may be empty/missing.
 * @returns {Array<{id: string, text: string}>}
 */
function parseDecisions(contextMd) {
  if (!contextMd || typeof contextMd !== 'string') return [];
  const blockMatch = contextMd.match(/<decisions>([\s\S]*?)<\/decisions>/);
  if (!blockMatch) return [];
  const block = blockMatch[1];

  const decisionRe = /^\s*-\s*\*\*(D-[A-Za-z0-9_-]+):\*\*\s*(.+?)\s*$/gm;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = decisionRe.exec(block)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, text: m[2] });
  }
  return out;
}

module.exports = { parseDecisions };
