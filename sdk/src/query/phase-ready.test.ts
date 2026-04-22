import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { checkPhaseReady } from './phase-ready.js';

async function writeMinimalRoadmap(root: string): Promise<void> {
  await mkdir(join(root, '.planning'), { recursive: true });
  await writeFile(
    join(root, '.planning', 'STATE.md'),
    `---
milestone: v1.0
---

# State
`,
    'utf-8',
  );
  await writeFile(
    join(root, '.planning', 'ROADMAP.md'),
    `## Milestone v1.0 — Test

### Phase 3: Sample Phase

**Goal:** Test goal

`,
    'utf-8',
  );
}

describe('checkPhaseReady', () => {
  it('throws when phase is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-pr-'));
    await mkdir(join(dir, '.planning'), { recursive: true });
    await expect(checkPhaseReady([], dir)).rejects.toThrow(/phase number required/);
  });

  it('returns discuss next_step when phase directory is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-pr-'));
    await writeMinimalRoadmap(dir);
    const { data } = await checkPhaseReady(['3'], dir);
    expect(data).toMatchObject({
      found: false,
      next_step: 'discuss',
      ready: false,
    });
  });

  it('returns plan when context exists but no plans', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'gsd-pr-'));
    await writeMinimalRoadmap(dir);
    const phaseDir = join(dir, '.planning', 'phases', '03-sample-phase');
    await mkdir(phaseDir, { recursive: true });
    await writeFile(join(phaseDir, '03-CONTEXT.md'), '# Ctx\n', 'utf-8');
    const { data } = await checkPhaseReady(['3'], dir);
    expect(data).toMatchObject({
      found: true,
      has_context: true,
      plan_count: 0,
      next_step: 'plan',
      ready: true,
    });
  });
});
