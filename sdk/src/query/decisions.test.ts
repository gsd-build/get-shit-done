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
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

  // ─── Adversarial-review regressions ────────────────────────────────────

  it('ignores `<decisions>` blocks inside fenced code (review F11)', () => {
    const content = `# Doc

\`\`\`
<decisions>
### Example
- **D-99:** Should not be parsed
</decisions>
\`\`\`

<decisions>
### Real
- **D-01:** Real decision text long enough to soft match
</decisions>`;
    const decisions = parseDecisions(content);
    const ids = decisions.map((d) => d.id);
    expect(ids).toContain('D-01');
    expect(ids).not.toContain('D-99');
  });

  it('captures continuation lines indented with TABS (review F12)', () => {
    const content = '<decisions>\n### Cat\n- **D-07:** First line\n\tcontinued via tab\n</decisions>';
    const decisions = parseDecisions(content);
    const d07 = decisions.find((d) => d.id === 'D-07');
    expect(d07?.text).toMatch(/continued via tab/);
  });

  it('parses ALL `<decisions>` blocks, not just the first (review F13)', () => {
    const content = `<decisions>
### One
- **D-01:** First batch
</decisions>

Some prose.

<decisions>
### Two
- **D-02:** Second batch
</decisions>`;
    const ids = parseDecisions(content).map((d) => d.id);
    expect(ids).toContain('D-01');
    expect(ids).toContain('D-02');
  });

  it('treats curly-quote variants of "Claude\u2019s Discretion" as non-trackable (review F20)', () => {
    // U+201B (single high-reversed-9 quotation mark) — uncommon but legal unicode.
    const content =
      '<decisions>\n### Claude\u201Bs Discretion\n- **D-50:** Should be non-trackable\n</decisions>';
    const decisions = parseDecisions(content);
    const d50 = decisions.find((d) => d.id === 'D-50');
    expect(d50?.trackable).toBe(false);
  });
});

// ─── decisions.parse query handler ────────────────────────────────────────

import { decisionsParse } from './decisions.js';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('decisionsParse handler (review F14 — accepts relative path via projectDir)', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await mkdtemp(join(tmpdir(), 'gsd-decparse-'));
  });
  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('resolves a relative file path against projectDir', async () => {
    await mkdir(join(tmp, '.planning', 'phases', '17'), { recursive: true });
    await writeFile(
      join(tmp, '.planning', 'phases', '17', '17-CONTEXT.md'),
      '<decisions>\n### Cat\n- **D-01:** Hello\n</decisions>',
      'utf-8',
    );
    const result = await decisionsParse(['.planning/phases/17/17-CONTEXT.md'], tmp);
    expect((result.data as { trackable: number }).trackable).toBe(1);
    expect((result.data as { missing: boolean }).missing).toBe(false);
  });

  it('still accepts an absolute path', async () => {
    const abs = join(tmp, 'CONTEXT.md');
    await writeFile(abs, '<decisions>\n### Cat\n- **D-02:** Bye\n</decisions>', 'utf-8');
    const result = await decisionsParse([abs], tmp);
    expect((result.data as { trackable: number }).trackable).toBe(1);
  });
});
