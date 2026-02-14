import { describe, it, expect } from 'vitest';
import { extractFrontmatter } from '../../src/extractors/frontmatter.js';
import { readFixture } from '../setup.js';

describe('frontmatter extractor', () => {
  it('extracts YAML frontmatter from markdown', () => {
    const md = `---
phase: 01-foundation
plan: "01"
tags: [auth, jwt]
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result.phase).toBe('01-foundation');
    expect(result.plan).toBe('01');
    expect(result.tags).toEqual(['auth', 'jwt']);
  });

  it('parses numeric plan values as numbers', () => {
    const md = `---
phase: 01-foundation
plan: 01
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result.plan).toBe(1); // YAML parses 01 as number
  });

  it('returns empty object for no frontmatter', () => {
    const result = extractFrontmatter('# Just content');
    expect(result).toEqual({});
  });

  it('returns empty object for markdown starting with heading', () => {
    const md = `# Title

Some content here.`;
    const result = extractFrontmatter(md);
    expect(result).toEqual({});
  });

  it('handles malformed YAML gracefully', () => {
    const md = `---
invalid: [unclosed
broken: yaml: here
---
# Content`;
    expect(() => extractFrontmatter(md)).not.toThrow();
    const result = extractFrontmatter(md);
    expect(result).toEqual({});
  });

  it('handles empty frontmatter', () => {
    const md = `---
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result).toEqual({});
  });

  it('extracts nested objects', () => {
    const md = `---
tech-stack:
  added:
    - jose: 5.2.0
    - bcrypt: 5.1.1
  patterns:
    - httpOnly cookies
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result['tech-stack']).toBeDefined();
    // YAML parses these as objects with key-value pairs
    expect(result['tech-stack'].added).toHaveLength(2);
    expect(result['tech-stack'].added[0]).toHaveProperty('jose', '5.2.0');
    expect(result['tech-stack'].patterns).toContain('httpOnly cookies');
  });

  it('extracts requires/provides structure', () => {
    const md = `---
requires:
  - phase: 01-auth
    provides: User model
provides:
  - Dashboard component
  - Real-time updates
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result.requires).toHaveLength(1);
    expect(result.requires[0].phase).toBe('01-auth');
    expect(result.provides).toContain('Dashboard component');
  });

  it('extracts from real SUMMARY.md fixture', () => {
    const summary = readFixture('sample-summary.md');
    const result = extractFrontmatter(summary);

    expect(result.phase).toBe('01-foundation');
    expect(result.plan).toBe(1); // YAML parses 01 as number
    expect(result.subsystem).toBe('auth');
    expect(result.tags).toContain('jwt');
    expect(result['key-decisions']).toBeDefined();
    expect(result['key-decisions'].length).toBeGreaterThan(0);
  });

  it('extracts from real RESEARCH.md fixture', () => {
    const research = readFixture('sample-research.md');
    const result = extractFrontmatter(research);

    // Research frontmatter structure (lowercase keys)
    expect(result).toHaveProperty('researched');
    expect(result).toHaveProperty('domain');
    expect(result).toHaveProperty('confidence');
    expect(result.confidence).toBe('HIGH');
  });

  it('handles multiline strings in frontmatter', () => {
    const md = `---
description: |
  This is a multiline
  description that spans
  multiple lines
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result.description).toContain('multiline');
    expect(result.description).toContain('multiple lines');
  });

  it('handles special characters in values', () => {
    const md = `---
decision: "Used jose instead of jsonwebtoken - ESM native"
path: src/lib/auth.ts
---
# Content`;
    const result = extractFrontmatter(md);
    expect(result.decision).toBe('Used jose instead of jsonwebtoken - ESM native');
    expect(result.path).toBe('src/lib/auth.ts');
  });
});
