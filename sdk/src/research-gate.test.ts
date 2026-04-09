import { describe, it, expect } from 'vitest';
import { checkResearchGate } from './research-gate.js';

describe('checkResearchGate', () => {
  // ── Pass cases ──────────────────────────────────────────────────────────

  it('passes when no Open Questions section exists', () => {
    const content = `# Research

## Key Findings
Everything is clear.

## Recommendations
Use TypeScript.`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(true);
    expect(result.unresolvedQuestions).toEqual([]);
  });

  it('passes when Open Questions section has (RESOLVED) suffix', () => {
    const content = `# Research

## Open Questions (RESOLVED)

1. **Hash prefix** — RESOLVED: Use "guest_contract:"
2. **Cache TTL** — RESOLVED: 5 minutes`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(true);
    expect(result.unresolvedQuestions).toEqual([]);
  });

  it('passes when Open Questions section is empty', () => {
    const content = `# Research

## Open Questions

## Next Steps
Proceed to planning.`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(true);
    expect(result.unresolvedQuestions).toEqual([]);
  });

  it('passes when all individual questions are marked RESOLVED', () => {
    const content = `# Research

## Open Questions

1. **Hash prefix** — RESOLVED: Use "guest_contract:"
2. **Cache strategy** — RESOLVED: Use Redis with 5min TTL`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(true);
    expect(result.unresolvedQuestions).toEqual([]);
  });

  it('passes with empty research content', () => {
    const result = checkResearchGate('');
    expect(result.pass).toBe(true);
  });

  // ── Fail cases ──────────────────────────────────────────────────────────

  it('fails when Open Questions section has unresolved numbered items', () => {
    const content = `# Research

## Open Questions

1. **Hash prefix** — keep or change?
2. **Cache TTL** — what duration?

## Recommendations
Use TypeScript.`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(2);
    expect(result.unresolvedQuestions[0]).toContain('Hash prefix');
    expect(result.unresolvedQuestions[1]).toContain('Cache TTL');
  });

  it('fails when Open Questions has bullet-point items', () => {
    const content = `# Research

## Open Questions

- **Auth strategy** — OAuth vs API keys?
- **Database** — Postgres or SQLite?`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(2);
  });

  it('fails with mix of resolved and unresolved questions', () => {
    const content = `# Research

## Open Questions

1. **Hash prefix** — RESOLVED: Use "guest_contract:"
2. **Cache TTL** — what duration?
3. **Auth flow** — RESOLVED: OAuth2
4. **Rate limiting** — needs decision`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(2);
    expect(result.unresolvedQuestions[0]).toContain('Cache TTL');
    expect(result.unresolvedQuestions[1]).toContain('Rate limiting');
  });

  it('fails with prose-style open questions (no list formatting)', () => {
    const content = `# Research

## Open Questions

We still need to determine the hashing strategy and whether
the cache should be shared across instances.

## Recommendations
Use TypeScript.`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(1);
    expect(result.unresolvedQuestions[0]).toContain('unstructured');
  });

  it('fails when Open Questions is the last section (no next heading)', () => {
    const content = `# Research

## Key Findings
Good stuff.

## Open Questions

1. **Deployment strategy** — containers vs serverless?`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(1);
    expect(result.unresolvedQuestions[0]).toContain('Deployment strategy');
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('handles case-insensitive heading match', () => {
    const content = `# Research

## open questions

1. **Something** — unclear`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
  });

  it('does not match subsection headings (### Open Questions)', () => {
    // Only ## level headings should trigger the gate
    const content = `# Research

## Findings

### Open Questions
These are just notes, not blocking.

1. **Minor thing** — just a thought`;

    // ### level = subsection under Findings, not the formal gate section
    const result = checkResearchGate(content);
    expect(result.pass).toBe(true);
  });

  it('handles asterisk-style bullet points', () => {
    const content = `# Research

## Open Questions

* **Strategy A** — needs evaluation
* **Strategy B** — RESOLVED: go with B`;

    const result = checkResearchGate(content);
    expect(result.pass).toBe(false);
    expect(result.unresolvedQuestions).toHaveLength(1);
    expect(result.unresolvedQuestions[0]).toContain('Strategy A');
  });
});
