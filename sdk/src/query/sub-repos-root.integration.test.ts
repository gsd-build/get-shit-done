/**
 * Regression: issue #2623 — `gsd-sdk query` must resolve the parent
 * `.planning/` root when invoked from a `sub_repos`-listed child repo.
 *
 * Exercises the end-to-end path: findProjectRoot(startDir) -> registry dispatch
 * of `init.new-milestone`, and asserts the handler reports the parent workspace
 * as `project_root` with `project_exists: true`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findProjectRoot } from './helpers.js';
import { createRegistry } from './index.js';

describe('issue #2623 — sub_repos project-root resolution through query dispatch', () => {
  let workspace: string;
  let appDir: string;

  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'gsd-2623-'));
    await mkdir(join(workspace, '.planning'), { recursive: true });
    await mkdir(join(workspace, '.planning', 'phases'), { recursive: true });
    await writeFile(
      join(workspace, '.planning', 'config.json'),
      JSON.stringify({ sub_repos: ['app'] }),
      'utf-8',
    );
    await writeFile(join(workspace, '.planning', 'PROJECT.md'), '# Project\n', 'utf-8');
    await writeFile(
      join(workspace, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## Milestone v1.0.0 — Bootstrap\n',
      'utf-8',
    );
    await writeFile(
      join(workspace, '.planning', 'STATE.md'),
      '---\ncurrent_phase: 01-bootstrap\n---\n',
      'utf-8',
    );

    appDir = join(workspace, 'app');
    await mkdir(join(appDir, '.git'), { recursive: true });
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('findProjectRoot(app) resolves to the parent workspace that owns .planning/', () => {
    expect(findProjectRoot(appDir)).toBe(workspace);
  });

  it('init.new-milestone dispatched with resolved root reports project_exists:true', async () => {
    // Simulate the CLI path: user starts inside the sub_repo.
    const resolved = findProjectRoot(appDir);
    expect(resolved).toBe(workspace);

    const registry = createRegistry();
    const result = await registry.dispatch('init.new-milestone', [], resolved, undefined);
    const data = result.data as Record<string, unknown>;

    expect(data.project_exists).toBe(true);
    expect(data.roadmap_exists).toBe(true);
    expect(data.state_exists).toBe(true);
    expect(data.project_root).toBe(workspace);
  });

  it('without findProjectRoot walk-up, the same handler reports project_exists:false (baseline)', async () => {
    // Proves the walk-up is load-bearing — invoking from the child directly
    // reproduces the bug described in #2623.
    const registry = createRegistry();
    const result = await registry.dispatch('init.new-milestone', [], appDir, undefined);
    const data = result.data as Record<string, unknown>;

    expect(data.project_exists).toBe(false);
    expect(data.project_root).toBe(appDir);
  });
});
