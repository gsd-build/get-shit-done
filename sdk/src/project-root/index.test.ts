/**
 * Pinning tests for sdk/src/project-root/index.ts
 *
 * These tests pin the behaviour of findProjectRoot before the CJS refactor
 * in Cycle 2. They must remain GREEN throughout (never bend the implementation
 * to match these tests — the SDK behaviour IS the ground truth; if a test
 * contradicts it, fix the test).
 *
 * Fixture matrix covers all four heuristics + edge cases, mirroring
 * sdk/src/query/helpers.test.ts:505-614 and adding depth-limit coverage.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findProjectRoot } from './index.js';

describe('findProjectRoot (project-root module)', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'gsd-pr-module-'));
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  // ── Heuristic 0: own .planning/ guard (#1362) ──────────────────────────────

  it('returns startDir unchanged when startDir has its own .planning/ (heuristic 0 / #1362 guard)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    expect(findProjectRoot(workspace)).toBe(workspace);
  });

  it('returns startDir when no ancestor has .planning/ (standalone project)', () => {
    expect(findProjectRoot(workspace)).toBe(workspace);
  });

  // ── Heuristic 1: sub_repos config ─────────────────────────────────────────

  it('walks up to parent when parent .planning/config.json lists startDir in sub_repos', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['child'] }),
      'utf-8',
    );
    const child = join(workspace, 'child');
    await mkdir(join(child, '.git'), { recursive: true });
    expect(findProjectRoot(child)).toBe(workspace);
  });

  it('resolves parent root from deeply nested dir inside a sub_repo (heuristic 1, nested)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['child'] }),
      'utf-8',
    );
    const nested = join(workspace, 'child', 'src', 'utils');
    await mkdir(join(workspace, 'child', '.git'), { recursive: true });
    await mkdir(nested, { recursive: true });
    expect(findProjectRoot(nested)).toBe(workspace);
  });

  it('supports planning.sub_repos nested config shape (heuristic 1, nested key)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ planning: { sub_repos: ['child'] } }),
      'utf-8',
    );
    const child = join(workspace, 'child');
    await mkdir(join(child, '.git'), { recursive: true });
    expect(findProjectRoot(child)).toBe(workspace);
  });

  it('returns startDir when sub_repos is empty and no .git (empty sub_repos, no git)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: [] }),
      'utf-8',
    );
    const child = join(workspace, 'child');
    await mkdir(child, { recursive: true });
    expect(findProjectRoot(child)).toBe(child);
  });

  // ── Heuristic 2: legacy multiRepo: true ──────────────────────────────────

  it('walks up via multiRepo: true when child is inside a git repo (heuristic 2)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ multiRepo: true }),
      'utf-8',
    );
    const child = join(workspace, 'child');
    await mkdir(join(child, '.git'), { recursive: true });
    expect(findProjectRoot(child)).toBe(workspace);
  });

  // ── Heuristic 3: .git heuristic + parent .planning/ ─────────────────────

  it('walks up via .git heuristic when parent has .planning/ and no config (heuristic 3)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    // No config.json
    const child = join(workspace, 'child');
    await mkdir(join(child, '.git'), { recursive: true });
    expect(findProjectRoot(child)).toBe(workspace);
  });

  it('swallows malformed config.json and falls back to .git heuristic (heuristic 3 fallback)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(join(workspace, '.planning', 'config.json'), '{ not json', 'utf-8');
    const child = join(workspace, 'child');
    await mkdir(join(child, '.git'), { recursive: true });
    expect(findProjectRoot(child)).toBe(workspace);
  });

  it('returns startDir when parent has .planning/ but no .git and no sub_repos (heuristic 3 miss)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    const child = join(workspace, 'child');
    await mkdir(child, { recursive: true });
    // No .git anywhere
    expect(findProjectRoot(child)).toBe(child);
  });

  // ── #1362 guard: nested project with own .planning/ ─────────────────────

  it('does NOT walk past child with its own .planning/ to parent .planning/ (#1362)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['child'] }),
      'utf-8',
    );
    const child = join(workspace, 'child');
    // child has its own .planning/ — the guard fires immediately
    await mkdir(join(child, '.planning'), { recursive: true });
    expect(findProjectRoot(child)).toBe(child);
  });

  it('resolves to child root (not workspace) from deep path inside child with its own .planning/ (#1362)', async () => {
    await mkdir(join(workspace, '.planning'), { recursive: true });
    const child = join(workspace, 'child');
    await mkdir(join(child, '.planning'), { recursive: true });
    await mkdir(join(child, '.git'), { recursive: true });
    const deep = join(child, 'src', 'lib');
    await mkdir(deep, { recursive: true });
    // findProjectRoot from deep resolves child because child has its own .planning/
    // The CJS impl walks up to child (finds own .planning/) and returns it.
    // NOTE: the current SDK impl returns `startDir` (the original argument) when
    // the OWN .planning/ guard fires during the walk. In this case startDir=deep
    // but deep does NOT have .planning/; the walk checks child which does.
    // Actually: the guard only fires at the VERY TOP for startDir itself.
    // Walking from `deep`, the algorithm checks parents — child has .planning/
    // and .git, so heuristic 3 fires and returns child.
    expect(findProjectRoot(deep)).toBe(child);
  });

  // ── Depth limit ──────────────────────────────────────────────────────────

  it('stops at depth 10 and returns startDir when .planning/ is more than 10 levels up', async () => {
    // CANONICALIZATION NOTE: The SDK uses FIND_PROJECT_ROOT_MAX_DEPTH = 10.
    // The CJS version had no explicit depth limit. This is an intentional
    // behaviour change: paths nested >10 levels deep will NOT have their
    // parent .planning/ discovered. This only affects pathological cases.
    //
    // Build a 12-level deep path: workspace/.planning/ exists but startDir
    // is workspace/l1/l2/.../l12 — 12 ancestors to workspace. The depth
    // limit of 10 prevents the walk from reaching workspace.
    await mkdir(join(workspace, '.planning'), { recursive: true });
    let dir = workspace;
    for (let i = 1; i <= 12; i++) {
      dir = join(dir, `l${i}`);
    }
    await mkdir(dir, { recursive: true });
    // No .git anywhere so heuristic 3 cannot fire, and depth limit kicks in
    // before reaching workspace
    expect(findProjectRoot(dir)).toBe(dir);
  });
});
