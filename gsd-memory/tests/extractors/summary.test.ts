import { describe, it, expect } from 'vitest';
import { extractSummary, type SummaryData } from '../../src/extractors/summary.js';
import { readFixture } from '../setup.js';

describe('summary extractor', () => {
  it('extracts decisions from frontmatter', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.decisions.length).toBeGreaterThan(0);
    expect(result.decisions[0]).toHaveProperty('decision');
    expect(result.decisions[0].decision).toContain('jose');
  });

  it('extracts tech stack additions', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.techStack.length).toBeGreaterThan(0);
    expect(result.techStack).toContainEqual(
      expect.objectContaining({
        library: 'jose',
        version: '5.2.0'
      })
    );
  });

  it('extracts patterns established', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns[0]).toContain('Token rotation');
  });

  it('extracts requires/provides for dependency graph', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.requires).toBeDefined();
    expect(result.provides).toBeDefined();
    expect(result.provides.length).toBeGreaterThan(0);
  });

  it('extracts phase and plan identifiers', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.phase).toBe('01-foundation');
    expect(result.plan).toBe(1);
  });

  it('extracts subsystem and tags', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.subsystem).toBe('auth');
    expect(result.tags).toContain('jwt');
    expect(result.tags).toContain('prisma');
  });

  it('extracts affects list', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.affects).toBeDefined();
    expect(result.affects).toContain('02-features');
  });

  it('extracts key files', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.keyFiles).toBeDefined();
    expect(result.keyFiles.created).toContain('src/lib/auth.ts');
  });

  it('extracts duration and completion date', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.duration).toBe('28min');
    expect(result.completed).toBe('2025-01-15');
  });

  it('handles summary without optional fields', () => {
    const minimalSummary = `---
phase: 01-test
plan: 01
subsystem: testing
tags: [test]
---
# Phase 1 Summary

**Test phase**`;

    const result = extractSummary(minimalSummary);

    expect(result.phase).toBe('01-test');
    expect(result.decisions).toEqual([]);
    expect(result.techStack).toEqual([]);
    expect(result.patterns).toEqual([]);
  });

  it('extracts one-liner from content', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractSummary(summary);

    expect(result.oneLiner).toBeDefined();
    expect(result.oneLiner).toContain('JWT auth');
  });
});
