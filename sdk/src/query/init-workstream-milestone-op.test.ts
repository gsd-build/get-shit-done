/**
 * Tests for workstream resolution in initMilestoneOp and roadmapAnalyze.
 *
 * Regression coverage for #3196: both handlers were ignoring the workstream
 * parameter and always reading from root `.planning/`, causing
 * `phase_count: 0` / `roadmap_exists: false` in workstream-scoped repos.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { initMilestoneOp } from './init.js';
import { roadmapAnalyze } from './roadmap.js';
import { resolveQueryRuntimeContext } from './query-runtime-context.js';

// ─── Shared fixture ────────────────────────────────────────────────────────

const ROADMAP_CONTENT = [
  '# Roadmap',
  '',
  '## v2.0: Test Milestone',
  '',
  '**Goal:** Run tests',
  '',
  '### Phase 1: Alpha',
  '',
  '**Goal:** First phase',
  '',
  '### Phase 2: Beta',
  '',
  '**Goal:** Second phase',
  '',
].join('\n');

const STATE_CONTENT = [
  '---',
  'milestone: v2.0',
  'milestone_name: Test Milestone',
  'status: executing',
  '---',
  '',
  '# Project State',
  '',
].join('\n');

const CONFIG_CONTENT = JSON.stringify({
  model_profile: 'balanced',
  commit_docs: false,
  git: {
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    quick_branch_template: null,
  },
  workflow: { research: false, plan_check: false, verifier: false, nyquist_validation: false },
});

// ─── initMilestoneOp workstream tests ─────────────────────────────────────

describe('initMilestoneOp workstream resolution (#3196)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-ws-milestone-op-'));

    // Root planning dir (has config, but no ROADMAP for the workstream)
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'config.json'), CONFIG_CONTENT);
    // Root STATE.md with a different milestone (should be ignored when ws is set)
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
      '---',
      'milestone: v0.0',
      'milestone_name: Root Milestone',
      'status: idle',
      '---',
    ].join('\n'));

    // Workstream dir
    const wsDir = join(tmpDir, '.planning', 'workstreams', 'test-ws');
    await mkdir(join(wsDir, 'phases', '01-alpha'), { recursive: true });
    await writeFile(join(wsDir, 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(wsDir, 'STATE.md'), STATE_CONTENT);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads phase_count from workstream ROADMAP when --ws is passed', async () => {
    const result = await initMilestoneOp([], tmpDir, 'test-ws');
    const data = result.data as Record<string, unknown>;

    expect(data.phase_count).toBe(2);
    expect(data.roadmap_exists).toBe(true);
    expect(data.state_exists).toBe(true);
    expect(data.milestone_version).toBe('v2.0');
  });

  it('returns phase_count 0 when reading root .planning/ (no workstream) that has no ROADMAP', async () => {
    // Root .planning has no ROADMAP — without the fix this was where milestone-op
    // always looked even when a workstream was active.
    const result = await initMilestoneOp([], tmpDir, undefined);
    const data = result.data as Record<string, unknown>;

    // Root has no ROADMAP so phase_count falls back to on-disk dirs (0)
    expect(data.roadmap_exists).toBe(false);
    expect(data.phase_count).toBe(0);
  });

  it('reads from active-workstream file when no explicit --ws is passed', async () => {
    // Write the active-workstream pointer
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'test-ws\n');

    // Resolve context as the CLI would (no --ws arg, no GSD_WORKSTREAM env)
    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBe('test-ws');

      const result = await initMilestoneOp([], ctx.projectDir, ctx.ws);
      const data = result.data as Record<string, unknown>;
      expect(data.phase_count).toBe(2);
      expect(data.roadmap_exists).toBe(true);
      expect(data.milestone_version).toBe('v2.0');
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('--ws flag overrides active-workstream file', async () => {
    // Write a different active-workstream
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'other-ws\n');

    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      // Explicitly pass --ws test-ws
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir, ws: 'test-ws' });
      expect(ctx.ws).toBe('test-ws');

      const result = await initMilestoneOp([], ctx.projectDir, ctx.ws);
      const data = result.data as Record<string, unknown>;
      expect(data.phase_count).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('GSD_WORKSTREAM env overrides active-workstream file', async () => {
    // File says other-ws, env says test-ws
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'other-ws\n');

    const prev = process.env.GSD_WORKSTREAM;
    process.env.GSD_WORKSTREAM = 'test-ws';
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBe('test-ws');
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });
});

// ─── roadmapAnalyze workstream tests ──────────────────────────────────────

describe('roadmapAnalyze workstream resolution (#3196)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-ws-roadmap-analyze-'));

    // Root planning dir — no ROADMAP
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
    await writeFile(join(tmpDir, '.planning', 'config.json'), CONFIG_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
      '---',
      'milestone: v0.0',
      'status: idle',
      '---',
    ].join('\n'));

    // Workstream dir
    const wsDir = join(tmpDir, '.planning', 'workstreams', 'test-ws');
    await mkdir(join(wsDir, 'phases'), { recursive: true });
    await writeFile(join(wsDir, 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(wsDir, 'STATE.md'), STATE_CONTENT);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('analyzes workstream ROADMAP when workstream is passed', async () => {
    const result = await roadmapAnalyze([], tmpDir, 'test-ws');
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Array<Record<string, unknown>>;

    expect(data.phase_count).toBe(2);
    expect(phases[0].number).toBe('1');
    expect(phases[1].number).toBe('2');
  });

  it('returns error when no ROADMAP in root .planning (no workstream)', async () => {
    const result = await roadmapAnalyze([], tmpDir, undefined);
    const data = result.data as Record<string, unknown>;

    // Root has no ROADMAP.md → error path
    expect(data.error).toBeDefined();
    expect(data.phase_count).toBeUndefined();
  });

  it('resolves workstream via active-workstream file for roadmapAnalyze', async () => {
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'test-ws\n');

    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBe('test-ws');

      const result = await roadmapAnalyze([], ctx.projectDir, ctx.ws);
      const data = result.data as Record<string, unknown>;
      expect(data.phase_count).toBe(2);
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });
});

// ─── resolveQueryRuntimeContext active-workstream file tests ──────────────

describe('resolveQueryRuntimeContext active-workstream file fallback (#3196)', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-rtctx-'));
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'my-ws'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reads ws from active-workstream file when no --ws and no GSD_WORKSTREAM', async () => {
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'my-ws\n');

    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBe('my-ws');
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('returns ws: undefined when active-workstream file is missing', async () => {
    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('returns ws: undefined when active-workstream names a non-existent dir', async () => {
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'nonexistent\n');

    const prev = process.env.GSD_WORKSTREAM;
    delete process.env.GSD_WORKSTREAM;
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBeUndefined();
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('GSD_WORKSTREAM env takes priority over active-workstream file', async () => {
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'my-ws\n');
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'env-ws'), { recursive: true });

    const prev = process.env.GSD_WORKSTREAM;
    process.env.GSD_WORKSTREAM = 'env-ws';
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir });
      expect(ctx.ws).toBe('env-ws');
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });

  it('--ws flag takes priority over both env and active-workstream file', async () => {
    await writeFile(join(tmpDir, '.planning', 'active-workstream'), 'my-ws\n');
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'env-ws'), { recursive: true });
    await mkdir(join(tmpDir, '.planning', 'workstreams', 'explicit-ws'), { recursive: true });

    const prev = process.env.GSD_WORKSTREAM;
    process.env.GSD_WORKSTREAM = 'env-ws';
    try {
      const ctx = resolveQueryRuntimeContext({ projectDir: tmpDir, ws: 'explicit-ws' });
      expect(ctx.ws).toBe('explicit-ws');
    } finally {
      if (prev === undefined) delete process.env.GSD_WORKSTREAM;
      else process.env.GSD_WORKSTREAM = prev;
    }
  });
});
