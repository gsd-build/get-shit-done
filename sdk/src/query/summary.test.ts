/**
 * Tests for summary / history digest handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { summaryExtract, historyDigest } from './summary.js';

describe('summaryExtract', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-sum-'));
    await mkdir(join(tmpDir, '.planning', 'phases', '01-x'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns structured fields from SUMMARY frontmatter (CJS parity)', async () => {
    const rel = '.planning/phases/01-x/01-SUMMARY.md';
    await writeFile(
      join(tmpDir, '.planning', 'phases', '01-x', '01-SUMMARY.md'),
      [
        '---',
        'phase: "01"',
        'name: Test Phase',
        'one-liner: From YAML',
        'key-files:',
        '  - a.ts',
        'key-decisions:',
        '  - "Choice: because reasons"',
        'patterns-established:',
        '  - "Pattern one"',
        'tech-stack:',
        '  added:',
        '    - vitest',
        'requirements-completed:',
        '  - R1',
        '---',
        '',
        '# Summary',
        '',
        '**Body one-liner ignored when FM has one-liner**',
        '',
      ].join('\n'),
      'utf-8',
    );
    const r = await summaryExtract([rel], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.path).toBe(rel);
    expect(data.one_liner).toBe('From YAML');
    expect(data.key_files).toEqual(['a.ts']);
    expect(data.requirements_completed).toEqual(['R1']);
    expect(Array.isArray(data.decisions)).toBe(true);
  });

  it('filters with --fields', async () => {
    const rel = '.planning/phases/01-x/01-SUMMARY.md';
    await writeFile(
      join(tmpDir, '.planning', 'phases', '01-x', '01-SUMMARY.md'),
      ['---', 'phase: "01"', 'one-liner: X', 'key-files:', '  - z.ts', '---', ''].join('\n'),
      'utf-8',
    );
    const r = await summaryExtract([rel, '--fields', 'path,one_liner'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(['one_liner', 'path'].sort());
    expect(data.one_liner).toBe('X');
  });
});

describe('historyDigest', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-hist-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns digest object for project without phases', async () => {
    const r = await historyDigest([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.phases).toEqual({});
    expect(data.decisions).toEqual([]);
    expect(data.tech_stack).toEqual([]);
  });
});
