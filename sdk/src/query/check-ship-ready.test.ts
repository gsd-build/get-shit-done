/**
 * Unit tests for `check.ship-ready` (decision-routing audit §3.9).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkShipReady } from './check-ship-ready.js';

describe('checkShipReady', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `gsd-check-ship-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, '.planning', 'phases'), { recursive: true });
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('throws when phase arg is missing', async () => {
    await expect(checkShipReady([], projectDir)).rejects.toThrow();
  });

  it('returns all expected shape keys', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    expect(typeof d.ready).toBe('boolean');
    expect(typeof d.verification_passed).toBe('boolean');
    expect(typeof d.clean_tree).toBe('boolean');
    expect(typeof d.on_feature_branch).toBe('boolean');
    expect(typeof d.remote_configured).toBe('boolean');
    expect(typeof d.gh_available).toBe('boolean');
    expect(typeof d.gh_authenticated).toBe('boolean');
    expect(Array.isArray(d.blockers)).toBe(true);
  });

  it('returns current_branch and base_branch fields', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;

    // current_branch is either a string (when in a git repo) or null (temp dir not a repo)
    expect(d.current_branch === null || typeof d.current_branch === 'string').toBe(true);
    expect(d.base_branch === null || typeof d.base_branch === 'string').toBe(true);
  });

  it('never throws — returns false fields on git errors', async () => {
    // Use a directory that is not a git repo
    const nonGitDir = join(tmpdir(), `gsd-non-git-${Date.now()}`);
    await mkdir(join(nonGitDir, '.planning', 'phases', '01-test'), { recursive: true });

    try {
      const { data } = await checkShipReady(['1'], nonGitDir);
      const d = data as Record<string, unknown>;
      // All git-based fields should be false/null when not a git repo
      expect(d.ready).toBe(false);
    } finally {
      await rm(nonGitDir, { recursive: true, force: true });
    }
  });

  it('gh_authenticated is always false (advisory — no network call)', async () => {
    await mkdir(join(projectDir, '.planning', 'phases', '01-foundation'), { recursive: true });

    const { data } = await checkShipReady(['1'], projectDir);
    const d = data as Record<string, unknown>;
    // Per spec: gh_authenticated is advisory — skip actual auth check to avoid slow network call
    expect(d.gh_authenticated).toBe(false);
  });
});
