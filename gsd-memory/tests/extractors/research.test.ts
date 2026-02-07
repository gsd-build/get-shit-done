import { describe, it, expect } from 'vitest';
import { extractResearch, type ResearchData } from '../../src/extractors/research.js';
import { readFixture } from '../setup.js';

describe('research extractor', () => {
  it('extracts metadata from frontmatter', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.domain).toBe('WebSocket and Server-Sent Events for real-time updates');
    expect(result.confidence).toBe('HIGH');
    expect(result.researched).toBe('2025-01-20');
  });

  it('extracts pitfalls section', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.pitfalls.length).toBeGreaterThan(0);
    expect(result.pitfalls[0]).toHaveProperty('name');
    expect(result.pitfalls[0]).toHaveProperty('description');
    expect(result.pitfalls[0]).toHaveProperty('prevention');
  });

  it('extracts standard stack table', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.standardStack.length).toBeGreaterThan(0);
    expect(result.standardStack[0]).toHaveProperty('library');
    expect(result.standardStack[0]).toHaveProperty('purpose');
  });

  it('extracts dont-hand-roll items', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.dontHandRoll.length).toBeGreaterThan(0);
    expect(result.dontHandRoll[0]).toHaveProperty('problem');
    expect(result.dontHandRoll[0]).toHaveProperty('useInstead');
  });

  it('extracts anti-patterns', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.antiPatterns.length).toBeGreaterThan(0);
  });

  it('extracts user constraints if present', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.userConstraints).toBeDefined();
    expect(result.userConstraints.locked.length).toBeGreaterThan(0);
  });

  it('extracts primary recommendation', () => {
    const research = readFixture('sample-research.md');
    const result = extractResearch(research);

    expect(result.primaryRecommendation).toBeDefined();
    expect(result.primaryRecommendation).toContain('SSE');
  });

  it('handles research without optional sections', () => {
    const minimalResearch = `---
domain: testing
confidence: LOW
researched: 2025-01-20
---

# Research

## Summary

Basic research document.

**Primary recommendation:** Use standard tools.
`;

    const result = extractResearch(minimalResearch);

    expect(result.domain).toBe('testing');
    expect(result.pitfalls).toEqual([]);
    expect(result.standardStack).toEqual([]);
    expect(result.dontHandRoll).toEqual([]);
  });
});
