/**
 * Unit tests for frontmatter parser and query handler.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  splitInlineArray,
  extractFrontmatter,
  extractFrontmatterLeading,
  stripFrontmatter,
  frontmatterGet,
  parseMustHavesBlock,
} from './frontmatter.js';

// ─── splitInlineArray ───────────────────────────────────────────────────────

describe('splitInlineArray', () => {
  it('splits simple CSV', () => {
    expect(splitInlineArray('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted strings with commas', () => {
    expect(splitInlineArray('"a, b", c')).toEqual(['a, b', 'c']);
  });

  it('handles single-quoted strings', () => {
    expect(splitInlineArray("'a, b', c")).toEqual(['a, b', 'c']);
  });

  it('trims whitespace', () => {
    expect(splitInlineArray('  a  ,  b  ')).toEqual(['a', 'b']);
  });

  it('returns empty array for empty string', () => {
    expect(splitInlineArray('')).toEqual([]);
  });
});

// ─── extractFrontmatter ─────────────────────────────────────────────────────

describe('extractFrontmatter', () => {
  it('parses simple key-value pairs', () => {
    const content = '---\nkey: value\n---\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'value' });
  });

  it('parses nested objects', () => {
    const content = '---\nparent:\n  child: value\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ parent: { child: 'value' } });
  });

  it('parses inline arrays', () => {
    const content = '---\ntags: [a, b, c]\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ tags: ['a', 'b', 'c'] });
  });

  it('parses dash arrays', () => {
    const content = '---\nitems:\n  - one\n  - two\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ items: ['one', 'two'] });
  });

  it('uses the LAST block when multiple stacked blocks exist', () => {
    const content = '---\nold: data\n---\n---\nnew: data\n---\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ new: 'data' });
  });

  it('handles empty-object-to-array conversion', () => {
    const content = '---\nlist:\n  - item1\n  - item2\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ list: ['item1', 'item2'] });
  });

  it('returns empty object when no frontmatter', () => {
    const result = extractFrontmatter('no frontmatter here');
    expect(result).toEqual({});
  });

  it('strips surrounding quotes from values', () => {
    const content = '---\nkey: "quoted"\n---\n';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'quoted' });
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\nkey: value\r\n---\r\nbody';
    const result = extractFrontmatter(content);
    expect(result).toEqual({ key: 'value' });
  });
});

// ─── extractFrontmatterLeading ─────────────────────────────────────────────

describe('extractFrontmatterLeading', () => {
  it('parses only the first leading block (gsd-tools.cjs / frontmatter.cjs parity)', () => {
    const content = '---\nfirst: 1\n---\n---\nsecond: 2\n---\nbody';
    expect(extractFrontmatterLeading(content)).toEqual({ first: '1' });
  });

  it('matches extractFrontmatter when a single block starts the file', () => {
    const content = '---\na: b\n---\n';
    expect(extractFrontmatterLeading(content)).toEqual(extractFrontmatter(content));
  });
});

// ─── stripFrontmatter ───────────────────────────────────────────────────────

describe('stripFrontmatter', () => {
  it('strips single frontmatter block', () => {
    const result = stripFrontmatter('---\nk: v\n---\nbody');
    expect(result).toBe('body');
  });

  it('strips multiple stacked blocks', () => {
    const result = stripFrontmatter('---\na: 1\n---\n---\nb: 2\n---\nbody');
    expect(result).toBe('body');
  });

  it('returns content unchanged when no frontmatter', () => {
    expect(stripFrontmatter('just body')).toBe('just body');
  });

  it('handles leading whitespace after strip', () => {
    const result = stripFrontmatter('---\nk: v\n---\n\nbody');
    // After stripping, leading whitespace/newlines may remain
    expect(result.trim()).toBe('body');
  });
});

// ─── frontmatterGet ─────────────────────────────────────────────────────────

describe('frontmatterGet', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fm-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns parsed frontmatter from a file', async () => {
    await writeFile(join(tmpDir, 'test.md'), '---\nkey: value\n---\nbody');
    const result = await frontmatterGet(['test.md'], tmpDir);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns single field when field arg provided', async () => {
    await writeFile(join(tmpDir, 'test.md'), '---\nkey: value\n---\nbody');
    const result = await frontmatterGet(['test.md', 'key'], tmpDir);
    expect(result.data).toEqual({ key: 'value' });
  });

  it('returns error for missing file', async () => {
    const result = await frontmatterGet(['missing.md'], tmpDir);
    expect(result.data).toEqual({ error: 'File not found', path: 'missing.md' });
  });

  it('throws GSDError for null bytes in path', async () => {
    const { GSDError } = await import('../errors.js');
    await expect(frontmatterGet(['bad\0path.md'], tmpDir)).rejects.toThrow(GSDError);
  });
});

// ─── parseMustHavesBlock ───────────────────────────────────────────────────

describe('parseMustHavesBlock', () => {
  it('parses artifacts block with path, provides, min_lines, contains, exports', () => {
    const content = `---
phase: 12
must_haves:
  artifacts:
    - path: sdk/src/foo.ts
      provides: Foo handler
      min_lines: 50
      contains: export function foo
      exports:
        - foo
        - bar
---
body`;
    const result = parseMustHavesBlock(content, 'artifacts');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      path: 'sdk/src/foo.ts',
      provides: 'Foo handler',
      min_lines: 50,
      contains: 'export function foo',
      exports: ['foo', 'bar'],
    });
  });

  it('parses key_links block with from, to, via, pattern', () => {
    const content = `---
phase: 12
must_haves:
  key_links:
    - from: src/a.ts
      to: src/b.ts
      via: import something
      pattern: import.*something.*from.*b
---
body`;
    const result = parseMustHavesBlock(content, 'key_links');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      from: 'src/a.ts',
      to: 'src/b.ts',
      via: 'import something',
      pattern: 'import.*something.*from.*b',
    });
  });

  it('parses simple string items (truths)', () => {
    const content = `---
phase: 12
must_haves:
  truths:
    - Running verify returns valid
    - Running check returns true
---
body`;
    const result = parseMustHavesBlock(content, 'truths');
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toBe('Running verify returns valid');
    expect(result.items[1]).toBe('Running check returns true');
  });

  it('preserves nested array values (exports: [a, b])', () => {
    const content = `---
must_haves:
  artifacts:
    - path: foo.ts
      exports:
        - alpha
        - beta
---
`;
    const result = parseMustHavesBlock(content, 'artifacts');
    expect(result.items[0]).toMatchObject({ exports: ['alpha', 'beta'] });
  });

  it('returns empty items for missing block', () => {
    const content = `---
must_haves:
  truths:
    - something
---
`;
    const result = parseMustHavesBlock(content, 'artifacts');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns empty items for no frontmatter', () => {
    const result = parseMustHavesBlock('no frontmatter here', 'artifacts');
    expect(result.items).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('emits diagnostic warning when content lines exist but 0 items parsed', () => {
    const content = `---
must_haves:
  artifacts:
  some badly formatted content
---
`;
    const result = parseMustHavesBlock(content, 'artifacts');
    expect(result.items).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('artifacts');
  });
});
