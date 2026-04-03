import { describe, it, expect } from 'vitest';
import {
  truncateMarkdown,
  extractCurrentMilestone,
  DEFAULT_TRUNCATION_OPTIONS,
} from './context-truncation.js';

// ─── truncateMarkdown ───────────────────────────────────────────────────────

describe('truncateMarkdown', () => {
  it('returns content unchanged when below threshold', () => {
    const content = '# Title\n\nShort content.';
    const result = truncateMarkdown(content, 'TEST.md');
    expect(result).toBe(content);
  });

  it('truncates content above threshold, keeping headings and first paragraphs', () => {
    const sections = [];
    for (let i = 0; i < 20; i++) {
      sections.push(`## Section ${i}\n\nFirst paragraph of section ${i}.\n\nSecond paragraph with lots of detail.\nMore detail here.\nEven more detail.`);
    }
    const content = `# Title\n\n${sections.join('\n\n')}`;
    const result = truncateMarkdown(content, 'BIG.md', { maxContentLength: 100 });

    // Headings preserved
    expect(result).toContain('# Title');
    expect(result).toContain('## Section 0');
    expect(result).toContain('## Section 19');

    // First paragraphs preserved
    expect(result).toContain('First paragraph of section 0.');
    expect(result).toContain('First paragraph of section 19.');

    // Second paragraphs omitted
    expect(result).not.toContain('Second paragraph');
    expect(result).not.toContain('More detail here.');

    // Truncation markers present
    expect(result).toContain('[...');
    expect(result).toContain('lines omitted]');
    expect(result).toContain('[Truncated: read .planning/BIG.md for full content]');
  });

  it('preserves YAML frontmatter entirely', () => {
    const content = `---\nphase: "01"\nstatus: active\n---\n\n# Title\n\nParagraph 1.\n\nParagraph 2.\n${'x'.repeat(10000)}`;
    const result = truncateMarkdown(content, 'STATE.md', { maxContentLength: 100 });

    expect(result).toContain('---\nphase: "01"\nstatus: active\n---');
    expect(result).toContain('# Title');
    expect(result).toContain('Paragraph 1.');
  });

  it('is smaller than original when truncated', () => {
    const longContent = Array.from({ length: 200 }, (_, i) =>
      `## Section ${i}\n\nFirst paragraph.\n\nLong detail paragraph ${'x'.repeat(100)}.`
    ).join('\n\n');

    const result = truncateMarkdown(longContent, 'HUGE.md', { maxContentLength: 100 });
    expect(result.length).toBeLessThan(longContent.length);
  });

  it('handles content with no headings', () => {
    const content = `First line.\n\nSecond paragraph.\n\nThird paragraph.\n${'x'.repeat(10000)}`;
    const result = truncateMarkdown(content, 'FLAT.md', { maxContentLength: 100 });

    // Should still truncate — first paragraph kept
    expect(result).toContain('First line.');
    expect(result.length).toBeLessThan(content.length);
  });

  it('default threshold is 8192 characters', () => {
    expect(DEFAULT_TRUNCATION_OPTIONS.maxContentLength).toBe(8192);
  });
});

// ─── extractCurrentMilestone ────────────────────────────────────────────────

describe('extractCurrentMilestone', () => {
  const makeRoadmap = () => `# Project Roadmap

## Milestone 1: Foundation
### Phase 01: Setup
Requirements for setup.
### Phase 02: Core
Requirements for core.

## Milestone 2: Features
### Phase 03: Auth
Requirements for auth.
### Phase 04: API
Requirements for API.

## Milestone 3: Polish
### Phase 05: UI
Requirements for UI.`;

  it('returns full roadmap when no state provided', () => {
    const roadmap = makeRoadmap();
    expect(extractCurrentMilestone(roadmap)).toBe(roadmap);
  });

  it('returns full roadmap when milestone not found in state', () => {
    const roadmap = makeRoadmap();
    const state = '# State\nstatus: active';
    expect(extractCurrentMilestone(roadmap, state)).toBe(roadmap);
  });

  it('extracts current milestone section by name', () => {
    const roadmap = makeRoadmap();
    const state = 'Current Milestone: Features';
    const result = extractCurrentMilestone(roadmap, state);

    expect(result).toContain('## Milestone 2: Features');
    expect(result).toContain('### Phase 03: Auth');
    expect(result).toContain('### Phase 04: API');

    // Other milestones omitted
    expect(result).not.toContain('### Phase 01: Setup');
    expect(result).not.toContain('### Phase 05: UI');
    expect(result).toContain('other milestone(s) omitted');
  });

  it('matches milestone name case-insensitively', () => {
    const roadmap = makeRoadmap();
    const state = 'current milestone: features';
    const result = extractCurrentMilestone(roadmap, state);

    expect(result).toContain('## Milestone 2: Features');
    expect(result).not.toContain('### Phase 01: Setup');
  });

  it('matches milestone from "milestone:" field in state', () => {
    const roadmap = makeRoadmap();
    const state = '# State\nmilestone: Foundation\nphase: 01';
    const result = extractCurrentMilestone(roadmap, state);

    expect(result).toContain('## Milestone 1: Foundation');
    expect(result).toContain('### Phase 01: Setup');
    expect(result).not.toContain('### Phase 03: Auth');
  });

  it('matches milestone from Current Position block', () => {
    const roadmap = makeRoadmap();
    const state = `# State

## Current Position
milestone: Polish
phase: 05`;
    const result = extractCurrentMilestone(roadmap, state);

    expect(result).toContain('## Milestone 3: Polish');
    expect(result).toContain('### Phase 05: UI');
    expect(result).not.toContain('### Phase 01: Setup');
  });

  it('preserves roadmap title in output', () => {
    const roadmap = makeRoadmap();
    const state = 'Current Milestone: Features';
    const result = extractCurrentMilestone(roadmap, state);

    expect(result).toContain('# Project Roadmap');
  });
});
