/**
 * Unit tests for complex init composition handlers.
 *
 * Tests the 3 complex handlers: initNewProject, initProgress, initManager.
 * Uses mkdtemp temp directories to simulate .planning/ layout.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initNewProject, initProgress, initManager } from './init-complex.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-init-complex-'));

  // Create minimal .planning structure
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-queries'), { recursive: true });

  // config.json
  await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
    model_profile: 'balanced',
    commit_docs: false,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gsd/phase-{phase}-{slug}',
      milestone_branch_template: 'gsd/{milestone}-{slug}',
      quick_branch_template: null,
    },
    workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
  }));

  // STATE.md
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
    '---',
    'milestone: v3.0',
    'status: executing',
    '---',
    '',
    '# Project State',
  ].join('\n'));

  // ROADMAP.md
  await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '',
    '## v3.0: SDK-First Migration',
    '',
    '### Phase 9: Foundation',
    '',
    '**Goal:** Build foundation',
    '',
    '**Depends on:** None',
    '',
    '### Phase 10: Read-Only Queries',
    '',
    '**Goal:** Implement queries',
    '',
    '**Depends on:** Phase 9',
    '',
  ].join('\n'));

  // Phase 09: has plan + summary (complete)
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), [
    '---',
    'phase: 09-foundation',
    'plan: 01',
    '---',
  ].join('\n'));
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '# Done');
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-RESEARCH.md'), '# Research');

  // Phase 10: only plan, no summary (in_progress)
  await writeFile(join(tmpDir, '.planning', 'phases', '10-queries', '10-01-PLAN.md'), [
    '---',
    'phase: 10-queries',
    'plan: 01',
    '---',
  ].join('\n'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('initNewProject', () => {
  it('returns flat JSON with expected shape', async () => {
    const result = await initNewProject([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.researcher_model).toBeDefined();
    expect(data.synthesizer_model).toBeDefined();
    expect(data.roadmapper_model).toBeDefined();
    expect(typeof data.is_brownfield).toBe('boolean');
    expect(typeof data.has_existing_code).toBe('boolean');
    expect(typeof data.has_package_file).toBe('boolean');
    expect(typeof data.has_git).toBe('boolean');
    expect(typeof data.brave_search_available).toBe('boolean');
    expect(typeof data.firecrawl_available).toBe('boolean');
    expect(typeof data.exa_search_available).toBe('boolean');
    expect(data.project_path).toBe('.planning/PROJECT.md');
    expect(data.project_root).toBe(tmpDir);
    expect(typeof data.agents_installed).toBe('boolean');
    expect(Array.isArray(data.missing_agents)).toBe(true);
  });

  it('detects brownfield when package.json exists', async () => {
    await writeFile(join(tmpDir, 'package.json'), '{"name":"test"}');
    const result = await initNewProject([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.has_package_file).toBe(true);
    expect(data.is_brownfield).toBe(true);
  });

  it('detects planning_exists when .planning exists', async () => {
    const result = await initNewProject([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.planning_exists).toBe(true);
  });
});

describe('initProgress', () => {
  it('returns flat JSON with phases array', async () => {
    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.phases)).toBe(true);
    expect(data.milestone_version).toBeDefined();
    expect(data.milestone_name).toBeDefined();
    expect(typeof data.phase_count).toBe('number');
    expect(typeof data.completed_count).toBe('number');
    expect(data.project_root).toBe(tmpDir);
  });

  it('correctly identifies complete vs in_progress phases', async () => {
    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Record<string, unknown>[];

    const phase9 = phases.find(p => p.number === '9' || (p.number as string).startsWith('09'));
    const phase10 = phases.find(p => p.number === '10' || (p.number as string).startsWith('10'));

    // Phase 09 has plan+summary → complete
    expect(phase9?.status).toBe('complete');
    // Phase 10 has plan but no summary → in_progress
    expect(phase10?.status).toBe('in_progress');
  });

  it('returns null paused_at when STATE.md has no pause', async () => {
    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.paused_at).toBeNull();
  });

  it('extracts paused_at when STATE.md has pause marker', async () => {
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
      '---',
      'milestone: v3.0',
      '---',
      '**Paused At:** Phase 10, Plan 2',
    ].join('\n'));
    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.paused_at).toBe('Phase 10, Plan 2');
  });

  it('includes state/roadmap path fields', async () => {
    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(typeof data.state_path).toBe('string');
    expect(typeof data.roadmap_path).toBe('string');
    expect(typeof data.config_path).toBe('string');
  });
});

describe('initManager', () => {
  it('returns flat JSON with phases and recommended_actions', async () => {
    const result = await initManager([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.phases)).toBe(true);
    expect(Array.isArray(data.recommended_actions)).toBe(true);
    expect(data.milestone_version).toBeDefined();
    expect(data.milestone_name).toBeDefined();
    expect(typeof data.phase_count).toBe('number');
    expect(typeof data.completed_count).toBe('number');
    expect(typeof data.all_complete).toBe('boolean');
    expect(data.project_root).toBe(tmpDir);
  });

  it('includes disk_status for each phase', async () => {
    const result = await initManager([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Record<string, unknown>[];
    expect(phases.length).toBeGreaterThan(0);
    for (const p of phases) {
      expect(typeof p.disk_status).toBe('string');
      expect(typeof p.deps_satisfied).toBe('boolean');
    }
  });

  it('returns error when ROADMAP.md missing', async () => {
    await rm(join(tmpDir, '.planning', 'ROADMAP.md'));
    const result = await initManager([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('includes display_name truncated to 20 chars', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
      '# Roadmap',
      '## v3.0: Test',
      '### Phase 9: A Very Long Phase Name That Should Be Truncated',
      '**Goal:** Something',
    ].join('\n'));
    const result = await initManager([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Record<string, unknown>[];
    const phase9 = phases.find(p => p.number === '9');
    expect(phase9).toBeDefined();
    expect((phase9!.display_name as string).length).toBeLessThanOrEqual(20);
  });

  it('includes manager_flags in result', async () => {
    const result = await initManager([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const flags = data.manager_flags as Record<string, string>;
    expect(typeof flags.discuss).toBe('string');
    expect(typeof flags.plan).toBe('string');
    expect(typeof flags.execute).toBe('string');
  });
});
