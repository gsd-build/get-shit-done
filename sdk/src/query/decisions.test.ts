/**
 * Unit tests for CONTEXT.md `<decisions>` parser.
 *
 * Decision format (from `discuss-phase.md` lines 1035–1048):
 *
 *   <decisions>
 *   ## Implementation Decisions
 *
 *   ### Category A
 *   - **D-01:** First decision text
 *   - **D-02 [folded]:** Second decision text
 *
 *   ### Claude's Discretion
 *   - free-form, never tracked
 *
 *   ### Folded Todos
 *   - **D-03 [folded]:** ...
 *   </decisions>
 *
 * Issue #2492.
 */
import { describe, it, expect } from 'vitest';
import { parseDecisions } from './decisions.js';

const MINIMAL = `# Phase 17 Context

<decisions>
## Implementation Decisions

### API Surface
- **D-01:** Use bit offsets, not byte offsets
- **D-02:** Display TArray element type alongside count

### Storage
- **D-03 [informational]:** Backing store is on disk
- **D-04:** Persist via SQLite WAL mode

### Claude's Discretion
- Naming of internal helpers is up to the implementer
- **D-99:** This should be ignored — it lives under Discretion

### Folded Todos
- **D-05 [folded]:** Add a CLI flag for verbose mode
</decisions>
`;

describe('parseDecisions (#2492)', () => {
  it('extracts D-NN decisions with id, text, and category', () => {
    const decisions = parseDecisions(MINIMAL);
    const ids = decisions.map((d) => d.id);
    expect(ids).toContain('D-01');
    expect(ids).toContain('D-02');
    expect(ids).toContain('D-04');
    const d01 = decisions.find((d) => d.id === 'D-01');
    expect(d01?.text).toBe('Use bit offsets, not byte offsets');
    expect(d01?.category).toBe('API Surface');
  });

  it('captures bracketed tags', () => {
    const decisions = parseDecisions(MINIMAL);
    const d05 = decisions.find((d) => d.id === 'D-05');
    expect(d05?.tags).toContain('folded');
    const d03 = decisions.find((d) => d.id === 'D-03');
    expect(d03?.tags).toContain('informational');
  });

  it('marks Claude\'s Discretion entries as non-trackable', () => {
    const decisions = parseDecisions(MINIMAL);
    const d99 = decisions.find((d) => d.id === 'D-99');
    expect(d99).toBeDefined();
    expect(d99?.trackable).toBe(false);
    // And it must NOT appear in the trackable filter
    const trackableIds = decisions.filter((d) => d.trackable).map((d) => d.id);
    expect(trackableIds).not.toContain('D-99');
  });

  it('marks [informational] entries as opt-out (excluded from trackable by default)', () => {
    const trackable = parseDecisions(MINIMAL).filter((d) => d.trackable);
    const ids = trackable.map((d) => d.id);
    expect(ids).toContain('D-01');
    expect(ids).toContain('D-02');
    expect(ids).toContain('D-04');
    expect(ids).not.toContain('D-03'); // [informational] tag
    expect(ids).not.toContain('D-05'); // [folded] tag — not user-facing decision
  });

  it('returns empty array when CONTEXT.md has no <decisions> block', () => {
    expect(parseDecisions('# Phase 1\n\nNo decisions here.\n')).toEqual([]);
  });

  it('returns empty array when content is empty', () => {
    expect(parseDecisions('')).toEqual([]);
  });

  it('returns empty array when <decisions> block is empty', () => {
    expect(parseDecisions('<decisions>\n</decisions>')).toEqual([]);
  });

  it('does not crash on malformed bullet lines', () => {
    const malformed = `<decisions>
- not a decision (no D-NN)
- **D-bogus:** wrong id format
- **D-7:** single digit allowed
- **D-10:** ten
</decisions>`;
    const decisions = parseDecisions(malformed);
    const ids = decisions.map((d) => d.id);
    expect(ids).toContain('D-7');
    expect(ids).toContain('D-10');
    expect(ids).not.toContain('D-bogus');
  });

  it('preserves multi-line decision text continuations', () => {
    const multi = `<decisions>
### Cat
- **D-01:** First line
  continues here
- **D-02:** Second
</decisions>`;
    const decisions = parseDecisions(multi);
    const d01 = decisions.find((d) => d.id === 'D-01');
    expect(d01?.text).toMatch(/First line/);
  });
});
