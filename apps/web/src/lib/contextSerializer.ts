/**
 * Context Serializer - Converts structured state back to CONTEXT.md format
 */

import type { ContextMdState, Decision } from './contextParser';

/**
 * Serialize a list of decisions to markdown bullet points
 */
function serializeDecisions(decisions: Decision[]): string {
  if (decisions.length === 0) {
    return '- None';
  }

  return decisions
    .map(d => {
      const lockedComment = d.locked ? ' <!-- locked -->' : '';
      return `- ${d.content}${lockedComment}`;
    })
    .join('\n');
}

/**
 * Serialize the full CONTEXT.md state back to markdown
 */
export function serializeContextMd(state: ContextMdState): string {
  const { domain, decisions, specifics, deferred } = state;

  return `# Context

<domain>
${domain}
</domain>

<decisions>
## Implementation Decisions

${serializeDecisions(decisions)}
</decisions>

<specifics>
## Specific Ideas

${serializeDecisions(specifics)}
</specifics>

<deferred>
## Deferred Ideas

${serializeDecisions(deferred)}
</deferred>
`;
}

/**
 * Create an empty CONTEXT.md state
 */
export function createEmptyContextState(): ContextMdState {
  return {
    domain: '## Phase Boundary\n\n[Phase scope will appear here as discussion progresses...]',
    decisions: [],
    specifics: [],
    deferred: [],
    raw: '',
  };
}
