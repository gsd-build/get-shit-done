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
let previousGsdAgentsDir: string | undefined;

beforeEach(async () => {
  previousGsdAgentsDir = process.env.GSD_AGENTS_DIR;
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
  if (previousGsdAgentsDir === undefined) delete process.env.GSD_AGENTS_DIR;
  else process.env.GSD_AGENTS_DIR = previousGsdAgentsDir;
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

  it('separates required agent registration from skill payload availability (#3388)', async () => {
    const emptyAgentsDir = join(tmpDir, 'empty-agents');
    await mkdir(emptyAgentsDir, { recursive: true });
    process.env.GSD_AGENTS_DIR = emptyAgentsDir;

    const requiredAgents = [
      'gsd-project-researcher',
      'gsd-research-synthesizer',
      'gsd-roadmapper',
    ];
    for (const agent of requiredAgents) {
      await mkdir(join(tmpDir, '.claude', 'skills', agent), { recursive: true });
      await writeFile(join(tmpDir, '.claude', 'skills', agent, 'SKILL.md'), `# ${agent}\n`);
    }
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      commit_docs: false,
      agent_skills: {
        'gsd-project-researcher': ['.claude/skills/gsd-project-researcher'],
        'gsd-research-synthesizer': ['.claude/skills/gsd-research-synthesizer'],
        'gsd-roadmapper': ['.claude/skills/gsd-roadmapper'],
      },
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
    }));

    const result = await initNewProject([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.agents_installed).toBe(false);
    expect(data.required_agents).toEqual(requiredAgents);
    expect(data.required_agents_installed).toBe(false);
    expect(data.missing_required_agents).toEqual(requiredAgents);
    expect(data.agent_skill_payloads_available).toBe(true);
    expect(data.agent_skill_payload_agents).toEqual(requiredAgents);
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

  it('reports Codex runtime override models when resolve_model_ids is omit (#3358)', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      runtime: 'codex',
      resolve_model_ids: 'omit',
      model_profile_overrides: {
        codex: {
          opus: { model: 'gpt-5.5', reasoning_effort: 'high' },
          sonnet: 'gpt-5.3-codex',
          haiku: 'gpt-5.4-mini',
        },
      },
      commit_docs: false,
      git: {
        branching_strategy: 'none',
        phase_branch_template: 'gsd/phase-{phase}-{slug}',
        milestone_branch_template: 'gsd/{milestone}-{slug}',
        quick_branch_template: null,
      },
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
    }));

    const result = await initProgress([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.planner_model).toBe('gpt-5.5');
    expect(data.executor_model).toBe('gpt-5.3-codex');
  });

  // ── #2646: ROADMAP checkbox fallback when no phases/ directory ─────────
  it('derives completed_count from ROADMAP [x] checkboxes when phases/ is absent', async () => {
    // Fresh fixture: NO phases/ directory at all, checkbox-driven ROADMAP.
    const tmp = await mkdtemp(join(tmpdir(), 'gsd-init-complex-2646-'));
    try {
      await mkdir(join(tmp, '.planning'), { recursive: true });
      await writeFile(join(tmp, '.planning', 'config.json'), JSON.stringify({
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
      await writeFile(join(tmp, '.planning', 'STATE.md'), [
        '---',
        'milestone: v1.0',
        '---',
      ].join('\n'));
      await writeFile(join(tmp, '.planning', 'ROADMAP.md'), [
        '# Roadmap',
        '',
        '## v1.0: Checkbox-Driven',
        '',
        '- [x] Phase 1: Scaffold',
        '- [ ] Phase 2: Build',
        '',
        '### Phase 1: Scaffold',
        '',
        '**Goal:** Scaffold the thing',
        '',
        '### Phase 2: Build',
        '',
        '**Goal:** Build the thing',
        '',
      ].join('\n'));

      const result = await initProgress([], tmp);
      const data = result.data as Record<string, unknown>;
      const phases = data.phases as Record<string, unknown>[];

      expect(data.phase_count).toBe(2);
      expect(data.completed_count).toBe(1);
      const phase1 = phases.find(p => p.number === '1');
      const phase2 = phases.find(p => p.number === '2');
      expect(phase1?.status).toBe('complete');
      expect(phase2?.status).toBe('not_started');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('treats terminal heading labels as complete when selecting next_phase (#3472)', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'gsd-init-complex-3472-'));
    try {
      await mkdir(join(tmp, '.planning'), { recursive: true });
      await writeFile(join(tmp, '.planning', 'config.json'), JSON.stringify({
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
      await writeFile(join(tmp, '.planning', 'STATE.md'), [
        '---',
        'milestone: v1.0',
        '---',
      ].join('\n'));
      await writeFile(join(tmp, '.planning', 'ROADMAP.md'), [
        '# Roadmap',
        '',
        '## v1.0: Current',
        '',
        '## Phase 4.12: Old Work (COMPLETE)',
        '',
        '## Phase 4.13: Another old one (SHIPPED 2026-05-12)',
        '',
        '## Phase 4.17: Human Auth (DEFERRED)',
        '',
        '## Phase 4.23: New pending work',
        '',
        '## Phase 4.24: Follow-up item (PROMOTED)',
        '',
        '## Phase 4.25: Another follow-up (REGISTERED)',
        '',
        '## Phase 4.26: Triage marker (INSERTED)',
        '',
      ].join('\n'));

      const result = await initProgress([], tmp);
      const data = result.data as Record<string, unknown>;
      const phases = data.phases as Record<string, unknown>[];
      const phase412 = phases.find(p => p.number === '4.12');
      const phase413 = phases.find(p => p.number === '4.13');
      const phase417 = phases.find(p => p.number === '4.17');
      const phase424 = phases.find(p => p.number === '4.24');
      const phase425 = phases.find(p => p.number === '4.25');
      const phase426 = phases.find(p => p.number === '4.26');

      expect(phase412?.status).toBe('complete');
      expect(phase413?.status).toBe('complete');
      expect(phase417?.status).toBe('complete');
      expect(phase424?.status).not.toBe('complete');
      expect(phase425?.status).not.toBe('complete');
      expect(phase426?.status).not.toBe('complete');
      expect(data.completed_count).toBe(3);
      expect((data.next_phase as Record<string, unknown>).number).toBe('4.23');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
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

  // ── queued_phases (#2497) ─────────────────────────────────────────────
  describe('queued_phases (#2497)', () => {
    const MULTI_MILESTONE = [
      '# Roadmap',
      '',
      '## Milestone v1.0: Old — ✅ SHIPPED 2026-01-01',
      '',
      'Shipped.',
      '',
      '## Milestone v2.0.5: Current',
      '',
      '### Phase 35: Audit',
      '**Goal**: Audit schemas.',
      '**Depends on**: None',
      '',
      '## Milestone v2.1: Daily Emails',
      '',
      '### Phase 31: Schema',
      '**Goal**: Build schema.',
      '**Depends on**: None',
      '',
      '### Phase 32: Sending',
      '**Goal**: Send emails.',
      '**Depends on**: Phase 31',
      '',
      '## Milestone v2.2: Later',
      '',
      '### Phase 99: Future',
      '**Goal**: Later work.',
    ].join('\n');

    beforeEach(async () => {
      await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), MULTI_MILESTONE);
      await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
        '---',
        'milestone: v2.0.5',
        'milestone_name: Current',
        '---',
      ].join('\n'));
    });

    it('surfaces the next milestone in queued_phases with metadata', async () => {
      const result = await initManager([], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.queued_milestone_version).toBe('v2.1');
      expect(data.queued_milestone_name).toBe('Daily Emails');
      const queued = data.queued_phases as Record<string, unknown>[];
      expect(queued.map(p => p.number)).toEqual(['31', '32']);
      // Only the NEXT milestone's phases appear — not v2.2's Phase 99.
      expect(queued.find(p => p.number === '99')).toBeUndefined();
    });

    it('queued_phases entries carry name, deps_display, and display_name', async () => {
      const result = await initManager([], tmpDir);
      const data = result.data as Record<string, unknown>;
      const queued = data.queued_phases as Record<string, unknown>[];
      const p32 = queued.find(p => p.number === '32');
      expect(p32).toBeDefined();
      expect(p32!.name).toBe('Sending');
      expect(p32!.deps_display).toBe('31');
      expect(typeof p32!.display_name).toBe('string');
    });

    it('does NOT mix queued phases into the active phases list', async () => {
      const result = await initManager([], tmpDir);
      const data = result.data as Record<string, unknown>;
      const active = (data.phases as Record<string, unknown>[]).map(p => p.number);
      // Active milestone is v2.0.5 → only Phase 35 belongs here.
      expect(active).toContain('35');
      expect(active).not.toContain('31');
      expect(active).not.toContain('32');
    });

    it('returns empty queued_phases and null metadata when active is last milestone', async () => {
      await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
        '## Milestone v2.0.5: Only Milestone',
        '',
        '### Phase 35: Audit',
        '**Goal**: Final.',
      ].join('\n'));
      const result = await initManager([], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.queued_phases).toEqual([]);
      expect(data.queued_milestone_version).toBeNull();
      expect(data.queued_milestone_name).toBeNull();
    });
  });
});

// ─── Workstream path threading tests (#2731) ─────────────────────────────────

const WORKSTREAM_CONFIG = JSON.stringify({
  model_profile: 'balanced',
  commit_docs: false,
  git: {
    branching_strategy: 'none',
    phase_branch_template: 'gsd/phase-{phase}-{slug}',
    milestone_branch_template: 'gsd/{milestone}-{slug}',
    quick_branch_template: null,
  },
  workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
});

const WORKSTREAM_STATE = [
  '---',
  'milestone: v1.0',
  'status: executing',
  '---',
  '',
  '# Project State',
].join('\n');

const WORKSTREAM_ROADMAP = [
  '# Roadmap',
  '',
  '## v1.0: Ops Milestone',
  '',
  '### Phase 1: Weave Cron',
  '',
  '**Goal:** Set up cron jobs',
  '',
  '### Phase 2: Alerts',
  '',
  '**Goal:** Set up alerting',
  '',
].join('\n');

describe('initProgress workstream (#2731)', () => {
  it('scans phases from workstream subdirectory, not root', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'gsd-ws-progress-'));
    try {
      const wsBase = join(tmp, '.planning', 'workstreams', 'production-support');

      // Root .planning has NO phases — if workstream ignored, result will be empty
      await mkdir(join(tmp, '.planning'), { recursive: true });
      await writeFile(join(tmp, '.planning', 'config.json'), WORKSTREAM_CONFIG);

      // Workstream-scoped structure
      await mkdir(join(wsBase, 'phases', '01-weave-cron'), { recursive: true });
      await mkdir(join(wsBase, 'phases', '02-alerts'), { recursive: true });
      await writeFile(join(wsBase, 'config.json'), WORKSTREAM_CONFIG);
      await writeFile(join(wsBase, 'STATE.md'), WORKSTREAM_STATE);
      await writeFile(join(wsBase, 'ROADMAP.md'), WORKSTREAM_ROADMAP);

      // Phase 01: plan + summary (complete)
      await writeFile(join(wsBase, 'phases', '01-weave-cron', '01-01-PLAN.md'), '# Plan');
      await writeFile(join(wsBase, 'phases', '01-weave-cron', '01-01-SUMMARY.md'), '# Done');

      // Phase 02: plan only (in_progress)
      await writeFile(join(wsBase, 'phases', '02-alerts', '02-01-PLAN.md'), '# Plan');

      const result = await initProgress([], tmp, 'production-support');
      const data = result.data as Record<string, unknown>;
      const phases = data.phases as Record<string, unknown>[];

      expect(phases.length).toBeGreaterThan(0);
      const phase1 = phases.find(p => (p.number as string).startsWith('01') || p.number === '1');
      expect(phase1).toBeDefined();
      expect(phase1?.status).toBe('complete');
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});

describe('initManager workstream (#2731)', () => {
  it('reads ROADMAP.md from workstream subdirectory, not root', async () => {
    const tmp = await mkdtemp(join(tmpdir(), 'gsd-ws-manager-'));
    try {
      const wsBase = join(tmp, '.planning', 'workstreams', 'production-support');

      // Root .planning has no ROADMAP — if workstream ignored, initManager errors
      await mkdir(join(tmp, '.planning'), { recursive: true });
      await writeFile(join(tmp, '.planning', 'config.json'), WORKSTREAM_CONFIG);

      // Workstream-scoped structure
      await mkdir(join(wsBase, 'phases', '01-weave-cron'), { recursive: true });
      await writeFile(join(wsBase, 'config.json'), WORKSTREAM_CONFIG);
      await writeFile(join(wsBase, 'STATE.md'), WORKSTREAM_STATE);
      await writeFile(join(wsBase, 'ROADMAP.md'), WORKSTREAM_ROADMAP);
      await writeFile(join(wsBase, 'phases', '01-weave-cron', '01-01-PLAN.md'), '# Plan');

      const result = await initManager([], tmp, 'production-support');
      const data = result.data as Record<string, unknown>;

      // Should NOT return error (no ROADMAP found at root)
      expect(data.error).toBeUndefined();
      // Should find phases from the workstream ROADMAP
      const phases = data.phases as Record<string, unknown>[];
      expect(phases.length).toBeGreaterThan(0);
      const phase1 = phases.find(p => p.number === '1');
      expect(phase1).toBeDefined();
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
