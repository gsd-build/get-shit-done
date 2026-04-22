/**
 * Tests for UAT query handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { uatRenderCheckpoint, auditUat } from './uat.js';

const SAMPLE_UAT = `---
status: draft
---
# UAT

## Current Test

number: 1
name: Login flow
expected: |
  User can sign in

## Other
`;

describe('uatRenderCheckpoint', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-uat-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns error when --file is missing', async () => {
    const r = await uatRenderCheckpoint([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('renders checkpoint for valid UAT file', async () => {
    const f = join(tmpDir, '01-UAT.md');
    await writeFile(f, SAMPLE_UAT, 'utf-8');
    const r = await uatRenderCheckpoint(['--file', '01-UAT.md'], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(data.checkpoint).toBeDefined();
    expect(String(data.checkpoint)).toContain('CHECKPOINT');
    expect(data.test_number).toBe(1);
  });
});

describe('auditUat', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-uat-audit-'));
    await mkdir(join(tmpDir, '.planning', 'phases', '01-x'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns empty results when no UAT files', async () => {
    const r = await auditUat([], tmpDir);
    const data = r.data as Record<string, unknown>;
    expect(Array.isArray(data.results)).toBe(true);
    const summary = data.summary as Record<string, unknown>;
    expect(summary.total_files).toBe(0);
    expect(summary.total_items).toBe(0);
    expect(summary.by_category).toEqual({});
    expect(summary.by_phase).toEqual({});
  });
});
