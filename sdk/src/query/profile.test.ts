/**
 * Tests for profile / learnings query handlers (filesystem writes use temp dirs).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { generateDevPreferences, writeProfile } from './profile-output.js';
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

describe('generateDevPreferences', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-dev-preferences-'));
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes to runtime-global skills dir by default', async () => {
    const analysisPath = join(tmpDir, 'analysis.json');
    const codexHome = join(tmpDir, 'codex-home');
    await writeFile(
      analysisPath,
      JSON.stringify({
        data_source: 'test',
        dimensions: {
          communication_style: { rating: 'terse', confidence: 'HIGH', claude_instruction: 'Keep it short.' },
        },
      }),
      'utf-8',
    );
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({ runtime: 'codex' }), 'utf-8');

    const prevCodexHome = process.env.CODEX_HOME;
    process.env.CODEX_HOME = codexHome;
    try {
      const result = await generateDevPreferences(['--analysis', analysisPath], tmpDir);
      const data = result.data as Record<string, unknown>;
      const expectedPath = join(codexHome, 'skills', 'gsd-dev-preferences', 'SKILL.md');
      expect(data.command_path).toBe(expectedPath);
      const md = await readFile(expectedPath, 'utf-8');
      expect(md).toContain('Behavioral Directives');
    } finally {
      if (prevCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevCodexHome;
    }
  });

  it('requires --output when runtime has no skills dir', async () => {
    const analysisPath = join(tmpDir, 'analysis.json');
    await writeFile(
      analysisPath,
      JSON.stringify({
        data_source: 'test',
        dimensions: {
          communication_style: { rating: 'terse', confidence: 'HIGH', claude_instruction: 'Keep it short.' },
        },
      }),
      'utf-8',
    );
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({ runtime: 'cline' }), 'utf-8');

    await expect(generateDevPreferences(['--analysis', analysisPath], tmpDir)).rejects.toThrow(
      'Runtime "cline" does not use a skills directory; pass --output to choose a path explicitly.',
    );
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
