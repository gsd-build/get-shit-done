import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { routeNextAction } from './route-next-action.js';

describe('routeNextAction', () => {
  it('suggests new-project when STATE.md is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-rna-'));
    await mkdir(join(dir, '.planning'), { recursive: true });
    const { data } = await routeNextAction([], dir);
    expect(data).toMatchObject({
      command: '/gsd-new-project',
      reason: expect.stringContaining('STATE.md'),
    });
  });

  it('routes to resume-work when paused', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-rna-'));
    await mkdir(join(dir, '.planning'), { recursive: true });
    await writeFile(
      join(dir, '.planning', 'STATE.md'),
      `---
milestone: v1.0
---

**Paused At:** Phase 2

`,
      'utf-8',
    );
    await writeFile(join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    const { data } = await routeNextAction([], dir);
    expect(data).toMatchObject({
      command: '/gsd-resume-work',
    });
  });

  it('blocks when .continue-here.md exists', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-rna-'));
    await mkdir(join(dir, '.planning'), { recursive: true });
    await writeFile(join(dir, '.planning', '.continue-here.md'), 'checkpoint\n', 'utf-8');
    await writeFile(
      join(dir, '.planning', 'STATE.md'),
      `---
milestone: v1.0
---

**Current Phase:** 3

`,
      'utf-8',
    );
    await writeFile(join(dir, '.planning', 'ROADMAP.md'), '# Roadmap\n', 'utf-8');
    const { data } = await routeNextAction([], dir);
    expect(data).toMatchObject({
      command: '',
      gates: expect.objectContaining({ continue_here: true }),
    });
  });
});
