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
 * Extract the inner text of the first `<decisions>...</decisions>` block.
 * Returns null when the block is absent.
 */
function extractDecisionsBlock(content: string): string | null {
  const match = content.match(/<decisions>([\s\S]*?)<\/decisions>/);
  return match ? match[1] : null;
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
      const normalized = category.toLowerCase().replace(/[’']/g, '').trim();
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

    // Continuation line for current decision (indented, non-bullet, non-empty)
    if (current && trimmed !== '' && !trimmed.startsWith('-') && line.startsWith(' ')) {
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
 * spawning a full Node process.
 */
export const decisionsParse: QueryHandler = async (args) => {
  const filePath = args[0];
  if (!filePath) {
    return { data: { decisions: [], trackable: 0, total: 0, missing: true } };
  }
  let raw = '';
  try {
    raw = await readFile(filePath, 'utf-8');
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
