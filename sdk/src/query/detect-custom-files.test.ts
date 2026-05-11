/**
 * Regression test for #3317 — SDK detect-custom-files omits `skills/` from
 * GSD_MANAGED_DIRS. Mirrors the CJS-side coverage in
 * `tests/bug-2942-detect-custom-skills.test.cjs`.
 *
 * Without the fix, user-added skills under `<config-dir>/skills/<name>/`
 * are not detected and get silently wiped on `/gsd-update`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { detectCustomFiles } from './detect-custom-files.js';

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

async function writeManifest(configDir: string, files: Record<string, string>): Promise<void> {
  const manifest = {
    version: '1.41.1',
    timestamp: new Date().toISOString(),
    files: {} as Record<string, string>,
  };
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(configDir, relPath);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, content);
    manifest.files[relPath] = sha256(content);
  }
  await writeFile(
    join(configDir, 'gsd-file-manifest.json'),
    JSON.stringify(manifest, null, 2),
  );
}

async function writeCustomFile(configDir: string, relPath: string, content: string): Promise<void> {
  const fullPath = join(configDir, relPath);
  await mkdir(join(fullPath, '..'), { recursive: true });
  await writeFile(fullPath, content);
}

interface DetectResult {
  custom_files: string[];
  custom_count: number;
  manifest_found: boolean;
}

describe('detectCustomFiles — skills/ parity with CJS port (#3317)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-3317-skills-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('detects custom skill at skills/<name>/SKILL.md', async () => {
    await writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });
    await writeCustomFile(tmpDir, 'skills/test-custom/SKILL.md', '# My Custom Skill\n');

    const { data } = await detectCustomFiles(['--config-dir', tmpDir], tmpDir);
    const result = data as DetectResult;

    expect(Array.isArray(result.custom_files)).toBe(true);
    expect(result.custom_files).toContain('skills/test-custom/SKILL.md');
    expect(result.custom_count).toBeGreaterThanOrEqual(1);
  });

  it('does not flag GSD-owned skill listed in manifest', async () => {
    await writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });

    const { data } = await detectCustomFiles(['--config-dir', tmpDir], tmpDir);
    const result = data as DetectResult;

    expect(result.custom_files).not.toContain('skills/gsd-planner/SKILL.md');
  });

  it('still detects custom files in get-shit-done/workflows/ (regression guard)', async () => {
    await writeManifest(tmpDir, {
      'get-shit-done/workflows/plan-phase.md': '# Plan Phase\n',
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });
    await writeCustomFile(tmpDir, 'get-shit-done/workflows/custom-workflow.md', '# Custom\n');

    const { data } = await detectCustomFiles(['--config-dir', tmpDir], tmpDir);
    const result = data as DetectResult;

    expect(result.custom_files).toContain('get-shit-done/workflows/custom-workflow.md');
  });

  it('custom_count matches custom_files.length across multiple skills', async () => {
    await writeManifest(tmpDir, {
      'skills/gsd-planner/SKILL.md': '# GSD Planner Skill\n',
    });
    await writeCustomFile(tmpDir, 'skills/test-custom/SKILL.md', '# Custom One\n');
    await writeCustomFile(tmpDir, 'skills/another-custom/SKILL.md', '# Custom Two\n');

    const { data } = await detectCustomFiles(['--config-dir', tmpDir], tmpDir);
    const result = data as DetectResult;

    expect(result.custom_count).toBe(result.custom_files.length);
    const skillEntries = result.custom_files.filter(f => f.startsWith('skills/'));
    expect(skillEntries).toHaveLength(2);
  });
});
