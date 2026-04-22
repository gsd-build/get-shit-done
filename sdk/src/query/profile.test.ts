/**
 * Tests for profile / learnings query handlers (filesystem writes use temp dirs).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { writeProfile } from './profile-output.js';
import { learningsCopy } from './profile.js';

describe('writeProfile', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-profile-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes USER-PROFILE.md from --input JSON (CJS template + dimensions shape)', async () => {
    const analysisPath = join(tmpDir, 'analysis.json');
    const outPath = join(tmpDir, '.planning', 'USER-PROFILE.md');
    await writeFile(
      analysisPath,
      JSON.stringify({
        profile_version: '1.0',
        data_source: 'test',
        dimensions: {
          communication_style: {
            rating: 'terse-direct',
            confidence: 'HIGH',
            claude_instruction: 'Keep it short.',
            summary: 'Test summary.',
            evidence: [],
          },
        },
      }),
      'utf-8',
    );
    const result = await writeProfile(['--input', analysisPath, '--output', outPath], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.profile_path).toBe(outPath);
    expect(data.dimensions_scored).toBe(1);
    const md = await readFile(outPath, 'utf-8');
    expect(md).toContain('Developer Profile');
    expect(md).toMatch(/Communication Style/i);
  });
});

describe('learningsCopy', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-learn-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns zero counts when LEARNINGS.md is missing (matches learnings.cjs)', async () => {
    const result = await learningsCopy([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.total).toBe(0);
    expect(data.created).toBe(0);
    expect(data.skipped).toBe(0);
  });
});
