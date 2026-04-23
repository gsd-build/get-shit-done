/**
 * CONTEXT.md `<decisions>` parser — shared helper for issue #2492 (decision
 * coverage gates) and #2493 (post-planning gap checker).
 *
 * Decision format (produced by `discuss-phase.md`):
 *
 *   <decisions>
 *   ## Implementation Decisions
 *
 *   ### Category Heading
 *   - **D-01:** Decision text
 *   - **D-02 [tag1, tag2]:** Tagged decision
 *
 *   ### Claude's Discretion
 *   - free-form, never tracked
 *   </decisions>
 *
 * A decision is "trackable" when:
 *   - it has a valid D-NN id
 *   - it is NOT under the "Claude's Discretion" category
 *   - it is NOT tagged `informational` or `folded`
 *
 * Trackable decisions are the ones the plan-phase translation gate and the
 * verify-phase validation gate enforce.
 */

import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { QueryHandler } from './utils.js';

export interface ParsedDecision {
  /** Stable id: `D-01`, `D-7`, `D-42`. */
  id: string;
  /** Body text (everything after `**D-NN[ tags]:**` up to next bullet/blank). */
  text: string;
  /** Most recent `### ` heading inside the decisions block. */
  category: string;
  /** Bracketed tags from `**D-NN [tag1, tag2]:**`. Lower-cased. */
  tags: string[];
  /**
   * False when under "Claude's Discretion" or tagged `informational` /
   * `folded`. Trackable decisions are subject to the coverage gates.
   */
  trackable: boolean;
}

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
function stripFencedCode(content: string): string {
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
function extractDecisionsBlock(content: string): string | null {
  const cleaned = stripFencedCode(content);
  const matches = [...cleaned.matchAll(/<decisions>([\s\S]*?)<\/decisions>/g)];
  if (matches.length === 0) return null;
  return matches.map((m) => m[1]).join('\n\n');
}

/**
 * Parse trackable decisions from CONTEXT.md content.
 *
 * Returns ALL D-NN decisions found inside `<decisions>` (including
 * non-trackable ones, with `trackable: false`). Callers that only want the
 * gate-enforced decisions should filter `.filter(d => d.trackable)`.
 */
export function parseDecisions(content: string): ParsedDecision[] {
  if (!content || typeof content !== 'string') return [];
  const block = extractDecisionsBlock(content);
  if (block === null) return [];

  const lines = block.split(/\r?\n/);
  const out: ParsedDecision[] = [];
  let category = '';
  let inDiscretion = false;

  // Bullet line: `- **D-NN[ [tags]]:** text`
  const bulletRe = /^\s*-\s+\*\*D-(\d+)(?:\s*\[([^\]]+)\])?\s*:\*\*\s*(.*)$/;

  let current: ParsedDecision | null = null;

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
      const trackable =
        !inDiscretion && !tags.some((t) => NON_TRACKABLE_TAGS.has(t));
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

// ─── Query handler ────────────────────────────────────────────────────────

/**
 * `decisions.parse <path>` — parse CONTEXT.md and return decisions array.
 *
 * Used by workflow shell snippets that need to enumerate decisions without
 * spawning a full Node process. Accepts either an absolute path or a path
 * relative to `projectDir` — symmetric with the gate handlers (review F14).
 */
export const decisionsParse: QueryHandler = async (args, projectDir) => {
  const filePath = args[0];
  if (!filePath) {
    return { data: { decisions: [], trackable: 0, total: 0, missing: true } };
  }
  const resolved = isAbsolute(filePath) ? filePath : join(projectDir, filePath);
  let raw = '';
  try {
    raw = await readFile(resolved, 'utf-8');
  } catch {
    return { data: { decisions: [], trackable: 0, total: 0, missing: true } };
  }
  const decisions = parseDecisions(raw);
  const trackable = decisions.filter((d) => d.trackable);
  return {
    data: {
      decisions,
      trackable: trackable.length,
      total: decisions.length,
      missing: false,
    },
  };
};
