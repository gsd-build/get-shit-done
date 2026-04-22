/**
 * Unit tests for frontmatter mutation handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  reconstructFrontmatter,
  spliceFrontmatter,
  frontmatterSet,
  frontmatterMerge,
  frontmatterValidate,
  FRONTMATTER_SCHEMAS,
} from './frontmatter-mutation.js';
import { extractFrontmatter } from './frontmatter.js';

// ─── reconstructFrontmatter ─────────────────────────────────────────────────

describe('reconstructFrontmatter', () => {
  it('serializes flat key-value pairs', () => {
    const result = reconstructFrontmatter({ phase: '10', plan: '01' });
    expect(result).toContain('phase: 10');
    expect(result).toContain('plan: 01');
  });

  it('serializes short arrays inline', () => {
    const result = reconstructFrontmatter({ tags: ['a', 'b', 'c'] });
    expect(result).toBe('tags: [a, b, c]');
  });

  it('serializes long arrays as dash items', () => {
    const result = reconstructFrontmatter({
      items: ['alpha', 'bravo', 'charlie', 'delta'],
    });
    expect(result).toContain('items:');
    expect(result).toContain('  - alpha');
    expect(result).toContain('  - delta');
  });

  it('serializes empty arrays as []', () => {
    const result = reconstructFrontmatter({ depends_on: [] });
    expect(result).toBe('depends_on: []');
  });

  it('serializes nested objects with 2-space indent', () => {
    const result = reconstructFrontmatter({ progress: { total: 5, done: 3 } });
    expect(result).toContain('progress:');
    expect(result).toContain('  total: 5');
    expect(result).toContain('  done: 3');
  });

  it('skips null and undefined values', () => {
    const result = reconstructFrontmatter({ a: 'yes', b: null, c: undefined });
    expect(result).toBe('a: yes');
  });

  it('quotes strings containing colons', () => {
    const result = reconstructFrontmatter({ label: 'key: value' });
    expect(result).toContain('"key: value"');
  });

  it('quotes strings containing hash', () => {
    const result = reconstructFrontmatter({ label: 'color #red' });
    expect(result).toContain('"color #red"');
  });

  it('quotes strings starting with [ or {', () => {
    const result = reconstructFrontmatter({ data: '[1,2,3]' });
    expect(result).toContain('"[1,2,3]"');
  });
});

// ─── spliceFrontmatter ──────────────────────────────────────────────────────

describe('spliceFrontmatter', () => {
  it('replaces existing frontmatter block', () => {
    const content = '---\nphase: 10\n---\n\n# Body';
    const result = spliceFrontmatter(content, { phase: '11', plan: '01' });
    expect(result).toMatch(/^---\nphase: 11\nplan: 01\n---/);
    expect(result).toContain('# Body');
  });

  it('prepends frontmatter when none exists', () => {
    const content = '# Just a body';
    const result = spliceFrontmatter(content, { phase: '10' });
    expect(result).toMatch(/^---\nphase: 10\n---\n\n# Just a body/);
  });
});

// ─── frontmatterSet ─────────────────────────────────────────────────────────

describe('frontmatterSet', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fm-set-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes a single field and round-trips through extractFrontmatter', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\nplan: 01\n---\n\n# Body\n');

    await frontmatterSet([filePath, 'status', 'executing'], tmpDir);

    const content = await readFile(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    expect(fm.status).toBe('executing');
    expect(fm.phase).toBe('10');
  });

  it('converts boolean string values', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\n---\n\n# Body\n');

    await frontmatterSet([filePath, 'autonomous', 'true'], tmpDir);

    const content = await readFile(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    expect(fm.autonomous).toBe('true');
  });

  it('handles numeric string values', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\n---\n\n# Body\n');

    await frontmatterSet([filePath, 'wave', '3'], tmpDir);

    const content = await readFile(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    // reconstructFrontmatter outputs the number, extractFrontmatter reads it back as string
    expect(String(fm.wave)).toBe('3');
  });

  it('rejects null bytes in file path', async () => {
    await expect(
      frontmatterSet(['/path/with\0null', 'key', 'val'], tmpDir)
    ).rejects.toThrow(/null bytes/);
  });
});

// ─── frontmatterMerge ───────────────────────────────────────────────────────

describe('frontmatterMerge', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fm-merge-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('deep merges JSON into existing frontmatter', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\nplan: 01\n---\n\n# Body\n');

    const result = await frontmatterMerge(
      [filePath, JSON.stringify({ status: 'done', wave: 2 })],
      tmpDir
    );

    const content = await readFile(filePath, 'utf-8');
    const fm = extractFrontmatter(content);
    expect(fm.phase).toBe('10');
    expect(fm.status).toBe('done');
    expect((result.data as Record<string, unknown>).merged).toBe(true);
  });

  it('rejects invalid JSON', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\n---\n\n# Body\n');

    await expect(
      frontmatterMerge([filePath, 'not-json'], tmpDir)
    ).rejects.toThrow();
  });
});

// ─── frontmatterValidate ────────────────────────────────────────────────────

describe('frontmatterValidate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-fm-validate-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('validates a valid plan file', async () => {
    const filePath = join(tmpDir, 'plan.md');
    const fm = '---\nphase: 10\nplan: 01\ntype: execute\nwave: 1\ndepends_on: []\nfiles_modified: []\nautonomous: true\nmust_haves:\n  truths:\n    - foo\n---\n\n# Plan\n';
    await writeFile(filePath, fm);

    const result = await frontmatterValidate([filePath, '--schema', 'plan'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(true);
    expect((data.missing as string[]).length).toBe(0);
  });

  it('detects missing fields', async () => {
    const filePath = join(tmpDir, 'plan.md');
    await writeFile(filePath, '---\nphase: 10\n---\n\n# Plan\n');

    const result = await frontmatterValidate([filePath, '--schema', 'plan'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.valid).toBe(false);
    expect((data.missing as string[]).length).toBeGreaterThan(0);
  });

  it('rejects unknown schema', async () => {
    const filePath = join(tmpDir, 'test.md');
    await writeFile(filePath, '---\nphase: 10\n---\n\n# Body\n');

    await expect(
      frontmatterValidate([filePath, '--schema', 'unknown'], tmpDir)
    ).rejects.toThrow(/Unknown schema/);
  });

  it('has plan, summary, and verification schemas', () => {
    expect(FRONTMATTER_SCHEMAS).toHaveProperty('plan');
    expect(FRONTMATTER_SCHEMAS).toHaveProperty('summary');
    expect(FRONTMATTER_SCHEMAS).toHaveProperty('verification');
  });
});

// ─── Round-trip (extract → reconstruct → splice) ───────────────────────────

describe('frontmatter round-trip', () => {
  it('preserves scalar and list fields through extract + splice', () => {
    const original = `---
phase: "01"
plan: "02"
type: execute
wave: 1
depends_on: []
tags: [a, b]
---
# Title
`;
    const fm = extractFrontmatter(original) as Record<string, unknown>;
    const spliced = spliceFrontmatter('# Title\n', fm);
    expect(spliced.startsWith('---\n')).toBe(true);
    const round = extractFrontmatter(spliced) as Record<string, unknown>;
    expect(String(round.phase)).toBe('01');
    // YAML may round-trip wave as number or string depending on parser output
    expect(Number(round.wave)).toBe(1);
    expect(Array.isArray(round.tags)).toBe(true);
  });
});
