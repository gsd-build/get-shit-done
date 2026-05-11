/**
 * Unit tests for init composition handlers.
 *
 * Tests all 13 init handlers plus the withProjectRoot helper.
 * Uses mkdtemp temp directories to simulate .planning/ layout.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  withProjectRoot,
  initExecutePhase,
  initPlanPhase,
  initNewMilestone,
  initQuick,
  initResume,
  initVerifyWork,
  initPhaseOp,
  initTodos,
  initMilestoneOp,
  initMapCodebase,
  initNewWorkspace,
  initListWorkspaces,
  initRemoveWorkspace,
  initIngestDocs,
} from './init.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-init-'));
  // Create minimal .planning structure
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-read-only-queries'), { recursive: true });
  // Create config.json
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
  // Create STATE.md
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), [
    '---',
    'milestone: v3.0',
    'status: executing',
    '---',
    '',
    '# Project State',
    '',
    '## Current Position',
    '',
    'Phase: 9 (foundation)',
    'Plan: 1 of 3',
    'Status: Executing',
    '',
  ].join('\n'));
  // Create ROADMAP.md with phase sections
  await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
    '# Roadmap',
    '',
    '## v3.0: SDK-First Migration',
    '',
    '### Phase 9: Foundation',
    '',
    '**Goal:** Build foundation',
    '',
    '### Phase 10: Read-Only Queries',
    '',
    '**Goal:** Implement queries',
    '',
  ].join('\n'));
  // Create plan and summary files in phase 09
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), [
    '---',
    'phase: 09-foundation',
    'plan: 01',
    'wave: 1',
    '---',
    '<objective>Test plan</objective>',
  ].join('\n'));
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '# Summary');
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-CONTEXT.md'), '# Context');
  await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-RESEARCH.md'), '# Research');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('withProjectRoot', () => {
  it('injects project_root, agents_installed, missing_agents into result', () => {
    const result: Record<string, unknown> = { foo: 'bar' };
    const enriched = withProjectRoot(tmpDir, result);
    expect(enriched.project_root).toBe(tmpDir);
    expect(typeof enriched.agents_installed).toBe('boolean');
    expect(Array.isArray(enriched.missing_agents)).toBe(true);
    // Original field preserved
    expect(enriched.foo).toBe('bar');
  });

  it('injects response_language when config has it', () => {
    const result: Record<string, unknown> = {};
    const enriched = withProjectRoot(tmpDir, result, { response_language: 'ja' });
    expect(enriched.response_language).toBe('ja');
  });

  it('does not inject response_language when not in config', () => {
    const result: Record<string, unknown> = {};
    const enriched = withProjectRoot(tmpDir, result, {});
    expect(enriched.response_language).toBeUndefined();
  });

  // Regression: #2400 — checkAgentsInstalled was looking at the wrong default
  // directory (~/.claude/get-shit-done/agents) while the installer writes to
  // ~/.claude/agents, causing agents_installed: false even on clean installs.
  it('reports agents_installed: true when all expected agents exist in GSD_AGENTS_DIR', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const agentsDir = join(tmpDir, 'fake-agents');
    await mkdir(agentsDir, { recursive: true });
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(agentsDir, `${name}.md`), '# stub');
    }
    const prev = process.env.GSD_AGENTS_DIR;
    process.env.GSD_AGENTS_DIR = agentsDir;
    try {
      const enriched = withProjectRoot(tmpDir, {});
      expect(enriched.agents_installed).toBe(true);
      expect(enriched.missing_agents).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prev;
    }
  });

  it('reports missing agents when GSD_AGENTS_DIR is empty', async () => {
    const agentsDir = join(tmpDir, 'empty-agents');
    await mkdir(agentsDir, { recursive: true });
    const prev = process.env.GSD_AGENTS_DIR;
    process.env.GSD_AGENTS_DIR = agentsDir;
    try {
      const enriched = withProjectRoot(tmpDir, {}) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(false);
      expect((enriched.missing_agents as string[]).length).toBeGreaterThan(0);
    } finally {
      if (prev === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prev;
    }
  });

  // Regression: #2400 follow-up — installer honors CLAUDE_CONFIG_DIR for custom
  // Claude install roots. The SDK check must follow the same precedence or it
  // false-negatives agent presence on non-default installs.
  it('honors CLAUDE_CONFIG_DIR when GSD_AGENTS_DIR is unset', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const configDir = join(tmpDir, 'custom-claude');
    const agentsDir = join(configDir, 'agents');
    await mkdir(agentsDir, { recursive: true });
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(agentsDir, `${name}.md`), '# stub');
    }
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevClaude = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.GSD_AGENTS_DIR;
    process.env.CLAUDE_CONFIG_DIR = configDir;
    try {
      const enriched = withProjectRoot(tmpDir, {}) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(true);
      expect(enriched.missing_agents).toEqual([]);
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevClaude === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = prevClaude;
    }
  });

  // #2402 — runtime-aware resolution: GSD_RUNTIME selects which runtime's
  // config-dir env chain to consult, so non-Claude installs stop
  // false-negating.
  it('GSD_RUNTIME=codex resolves agents under CODEX_HOME/agents', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const codexHome = join(tmpDir, 'codex-home');
    const agentsDir = join(codexHome, 'agents');
    await mkdir(agentsDir, { recursive: true });
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(agentsDir, `${name}.md`), '# stub');
    }
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevRuntime = process.env.GSD_RUNTIME;
    const prevCodex = process.env.CODEX_HOME;
    delete process.env.GSD_AGENTS_DIR;
    process.env.GSD_RUNTIME = 'codex';
    process.env.CODEX_HOME = codexHome;
    try {
      const enriched = withProjectRoot(tmpDir, {}) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(true);
      expect(enriched.missing_agents).toEqual([]);
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevRuntime === undefined) delete process.env.GSD_RUNTIME;
      else process.env.GSD_RUNTIME = prevRuntime;
      if (prevCodex === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevCodex;
    }
  });

  it('config.runtime drives detection when GSD_RUNTIME is unset', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const geminiHome = join(tmpDir, 'gemini-home');
    const agentsDir = join(geminiHome, 'agents');
    await mkdir(agentsDir, { recursive: true });
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(agentsDir, `${name}.md`), '# stub');
    }
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevRuntime = process.env.GSD_RUNTIME;
    const prevGemini = process.env.GEMINI_CONFIG_DIR;
    delete process.env.GSD_AGENTS_DIR;
    delete process.env.GSD_RUNTIME;
    process.env.GEMINI_CONFIG_DIR = geminiHome;
    try {
      const enriched = withProjectRoot(tmpDir, {}, { runtime: 'gemini' }) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(true);
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevRuntime === undefined) delete process.env.GSD_RUNTIME;
      else process.env.GSD_RUNTIME = prevRuntime;
      if (prevGemini === undefined) delete process.env.GEMINI_CONFIG_DIR;
      else process.env.GEMINI_CONFIG_DIR = prevGemini;
    }
  });

  it('GSD_RUNTIME wins over config.runtime', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const codexHome = join(tmpDir, 'codex-win');
    const agentsDir = join(codexHome, 'agents');
    await mkdir(agentsDir, { recursive: true });
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(agentsDir, `${name}.md`), '# stub');
    }
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevRuntime = process.env.GSD_RUNTIME;
    const prevCodex = process.env.CODEX_HOME;
    delete process.env.GSD_AGENTS_DIR;
    process.env.GSD_RUNTIME = 'codex';
    process.env.CODEX_HOME = codexHome;
    try {
      // config says gemini, env says codex — codex should win and find agents.
      const enriched = withProjectRoot(tmpDir, {}, { runtime: 'gemini' }) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(true);
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevRuntime === undefined) delete process.env.GSD_RUNTIME;
      else process.env.GSD_RUNTIME = prevRuntime;
      if (prevCodex === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = prevCodex;
    }
  });

  it('unknown GSD_RUNTIME falls through to config/Claude default', () => {
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevRuntime = process.env.GSD_RUNTIME;
    delete process.env.GSD_AGENTS_DIR;
    process.env.GSD_RUNTIME = 'not-a-runtime';
    try {
      // Should not throw; falls back to Claude — missing_agents on a blank tmpDir.
      const enriched = withProjectRoot(tmpDir, {}) as Record<string, unknown>;
      expect(typeof enriched.agents_installed).toBe('boolean');
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevRuntime === undefined) delete process.env.GSD_RUNTIME;
      else process.env.GSD_RUNTIME = prevRuntime;
    }
  });

  it('GSD_AGENTS_DIR takes precedence over CLAUDE_CONFIG_DIR', async () => {
    const { MODEL_PROFILES } = await import('./config-query.js');
    const winningDir = join(tmpDir, 'winning-agents');
    const losingDir = join(tmpDir, 'losing-config', 'agents');
    await mkdir(winningDir, { recursive: true });
    await mkdir(losingDir, { recursive: true });
    // Only populate the winning dir.
    for (const name of Object.keys(MODEL_PROFILES)) {
      await writeFile(join(winningDir, `${name}.md`), '# stub');
    }
    const prevAgents = process.env.GSD_AGENTS_DIR;
    const prevClaude = process.env.CLAUDE_CONFIG_DIR;
    process.env.GSD_AGENTS_DIR = winningDir;
    process.env.CLAUDE_CONFIG_DIR = join(tmpDir, 'losing-config');
    try {
      const enriched = withProjectRoot(tmpDir, {}) as Record<string, unknown>;
      expect(enriched.agents_installed).toBe(true);
    } finally {
      if (prevAgents === undefined) delete process.env.GSD_AGENTS_DIR;
      else process.env.GSD_AGENTS_DIR = prevAgents;
      if (prevClaude === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = prevClaude;
    }
  });
});

describe('initExecutePhase', () => {
  it('returns flat JSON with expected keys for existing phase', async () => {
    const result = await initExecutePhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase_found).toBe(true);
    expect(data.phase_number).toBe('09');
    expect(data.executor_model).toBeDefined();
    expect(data.commit_docs).toBeDefined();
    expect(data.project_root).toBe(tmpDir);
    expect(data.plans).toBeDefined();
    expect(data.summaries).toBeDefined();
    expect(data.milestone_version).toBeDefined();
  });

  it('returns error when phase arg missing', async () => {
    const result = await initExecutePhase([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('honors legacy top-level branching_strategy in config for execute-phase init (#3055)', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      commit_docs: false,
      branching_strategy: 'phase',
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
    }));

    const result = await initExecutePhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.branching_strategy).toBe('phase');
    expect(typeof data.branch_name).toBe('string');
  });
});

describe('initPlanPhase', () => {
  it('returns flat JSON with expected keys', async () => {
    const result = await initPlanPhase(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase_found).toBe(true);
    expect(data.researcher_model).toBeDefined();
    expect(data.planner_model).toBeDefined();
    expect(data.checker_model).toBeDefined();
    expect(data.research_enabled).toBeDefined();
    expect(data.has_research).toBe(true);
    expect(data.has_context).toBe(true);
    expect(data.project_root).toBe(tmpDir);
  });

  it('returns error when phase arg missing', async () => {
    const result = await initPlanPhase([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  // #2769: extractReqIds must accept all bold/colon variants of the
  // Requirements header. The forms render identically in markdown but differ
  // textually; the previous regex only matched **Requirements**: (colon
  // outside bold) and silently returned null for **Requirements:** (colon
  // inside bold) and **Requirements** : (spaced).
  describe.each([
    { name: 'colon inside bold', header: '**Requirements:** RV-01, RV-02' },
    { name: 'colon outside bold', header: '**Requirements**: RV-01, RV-02' },
    { name: 'space before colon', header: '**Requirements** : RV-01, RV-02' },
  ])('phase_req_ids extraction (#2769)', ({ name, header }) => {
    it(`parses Requirements header with ${name}`, async () => {
      // Overwrite ROADMAP.md so phase 9 carries the variant header.
      await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), [
        '# Roadmap',
        '',
        '## v3.0: SDK-First Migration',
        '',
        '### Phase 9: Foundation',
        '',
        '**Goal:** Build foundation',
        header,
        '',
        '### Phase 10: Read-Only Queries',
        '',
        '**Goal:** Implement queries',
        '',
      ].join('\n'));

      const result = await initPlanPhase(['9'], tmpDir);
      const data = result.data as Record<string, unknown>;
      expect(data.phase_req_ids).toBe('RV-01, RV-02');
    });
  });
});

describe('initNewMilestone', () => {
  it('returns flat JSON with milestone info', async () => {
    const result = await initNewMilestone([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.current_milestone).toBeDefined();
    expect(data.current_milestone_name).toBeDefined();
    expect(data.phase_dir_count).toBeGreaterThanOrEqual(0);
    expect(data.project_root).toBe(tmpDir);
  });
});

describe('initQuick', () => {
  it('returns flat JSON with task info', async () => {
    const result = await initQuick(['my-task'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.quick_id).toBeDefined();
    expect(data.slug).toBe('my-task');
    expect(data.description).toBe('my-task');
    expect(data.planner_model).toBeDefined();
    expect(data.executor_model).toBeDefined();
    expect(data.quick_dir).toBe('.planning/quick');
    expect(data.project_root).toBe(tmpDir);
  });
});

describe('initResume', () => {
  it('returns flat JSON with state info', async () => {
    const result = await initResume([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.state_exists).toBe(true);
    expect(data.roadmap_exists).toBe(true);
    expect(data.project_root).toBe(tmpDir);
    expect(data.commit_docs).toBeDefined();
  });
});

describe('initVerifyWork', () => {
  it('returns flat JSON with expected keys', async () => {
    const result = await initVerifyWork(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase_found).toBe(true);
    expect(data.phase_number).toBe('09');
    expect(data.planner_model).toBeDefined();
    expect(data.checker_model).toBeDefined();
    expect(data.project_root).toBe(tmpDir);
  });

  it('resolves workstream-scoped phases when workstream is provided', async () => {
    const wsDir = join(tmpDir, '.planning', 'workstreams', 'delivery');
    await mkdir(join(wsDir, 'phases', '32-shipment-creation-tracking-numbers-print-forms'), { recursive: true });
    await writeFile(join(wsDir, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '## v1.0: Delivery',
      '',
      '### Phase 32: Shipment Creation Tracking Numbers Print Forms',
      '',
      '**Goal:** Ship orders.',
      '',
    ].join('\n'));

    const result = await initVerifyWork(['32'], tmpDir, 'delivery');
    const data = result.data as Record<string, unknown>;

    expect(data.phase_found).toBe(true);
    expect(data.phase_number).toBe('32');
    expect(data.phase_dir).toBe(
      '.planning/workstreams/delivery/phases/32-shipment-creation-tracking-numbers-print-forms',
    );
  });

  it('returns error when phase arg missing', async () => {
    const result = await initVerifyWork([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });
});

describe('initPhaseOp', () => {
  it('returns flat JSON with phase artifacts', async () => {
    const result = await initPhaseOp(['9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase_found).toBe(true);
    expect(data.phase_number).toBe('09');
    expect(data.has_research).toBe(true);
    expect(data.has_context).toBe(true);
    expect(data.plan_count).toBeGreaterThanOrEqual(1);
    expect(data.project_root).toBe(tmpDir);
  });
});

describe('initTodos', () => {
  it('returns flat JSON with todo inventory', async () => {
    const result = await initTodos([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.todo_count).toBe(0);
    expect(Array.isArray(data.todos)).toBe(true);
    expect(data.area_filter).toBeNull();
    expect(data.project_root).toBe(tmpDir);
  });

  it('filters by area when provided', async () => {
    const result = await initTodos(['code'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.area_filter).toBe('code');
  });
});

describe('initMilestoneOp', () => {
  it('returns flat JSON with milestone info', async () => {
    const result = await initMilestoneOp([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.milestone_version).toBeDefined();
    expect(data.milestone_name).toBeDefined();
    expect(data.phase_count).toBeGreaterThanOrEqual(0);
    expect(data.completed_phases).toBeGreaterThanOrEqual(0);
    expect(data.project_root).toBe(tmpDir);
  });

  // Regression: #2633 — ROADMAP.md is the authority for current-milestone
  // phase count, not on-disk phase directories. After `phases clear` a new
  // milestone's roadmap may list phases 3/4/5 while only 03 and 04 exist on
  // disk yet. Deriving phase_count from disk yields 2 and falsely flags
  // all_phases_complete=true once both on-disk phases have summaries.
  it('derives phase_count from ROADMAP current milestone, not on-disk dirs (#2633)', async () => {
    // Custom fixture overriding the shared beforeEach: simulate post-cleanup
    // start of v1.1 where roadmap declares phases 3, 4, 5 but only 03 and 04
    // have been materialized on disk (both with summaries).
    const fresh = await mkdtemp(join(tmpdir(), 'gsd-init-2633-'));
    try {
      await mkdir(join(fresh, '.planning', 'phases', '03-alpha'), { recursive: true });
      await mkdir(join(fresh, '.planning', 'phases', '04-beta'), { recursive: true });
      await writeFile(join(fresh, '.planning', 'config.json'), JSON.stringify({
        model_profile: 'balanced',
        workflow: { nyquist_validation: true },
      }));
      await writeFile(join(fresh, '.planning', 'STATE.md'), [
        '---', 'milestone: v1.1', 'milestone_name: Next', 'status: executing', '---', '',
      ].join('\n'));
      await writeFile(join(fresh, '.planning', 'ROADMAP.md'), [
        '# Roadmap', '',
        '## v1.1: Next',
        '',
        '### Phase 3: Alpha', '**Goal:** A', '',
        '### Phase 4: Beta', '**Goal:** B', '',
        '### Phase 5: Gamma', '**Goal:** C', '',
      ].join('\n'));
      // Both on-disk phases have summaries (completed).
      await writeFile(join(fresh, '.planning', 'phases', '03-alpha', '03-01-SUMMARY.md'), '# S');
      await writeFile(join(fresh, '.planning', 'phases', '04-beta', '04-01-SUMMARY.md'), '# S');

      const result = await initMilestoneOp([], fresh);
      const data = result.data as Record<string, unknown>;
      // Roadmap declares 3 phases for the current milestone.
      expect(data.phase_count).toBe(3);
      // Only 2 are materialized + summarized on disk.
      expect(data.completed_phases).toBe(2);
      // Therefore milestone is NOT complete — phase 5 is still outstanding.
      expect(data.all_phases_complete).toBe(false);
    } finally {
      await rm(fresh, { recursive: true, force: true });
    }
  });
});

describe('initMapCodebase', () => {
  it('returns flat JSON with mapper info', async () => {
    const result = await initMapCodebase([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.mapper_model).toBeDefined();
    expect(Array.isArray(data.existing_maps)).toBe(true);
    expect(data.codebase_dir).toBe('.planning/codebase');
    expect(data.project_root).toBe(tmpDir);
  });
});

describe('initNewWorkspace', () => {
  it('returns flat JSON with workspace info', async () => {
    const result = await initNewWorkspace([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.default_workspace_base).toBeDefined();
    expect(typeof data.worktree_available).toBe('boolean');
    expect(data.project_root).toBe(tmpDir);
  });

  it('detects git availability', async () => {
    const result = await initNewWorkspace([], tmpDir);
    const data = result.data as Record<string, unknown>;
    // worktree_available depends on whether git is installed
    expect(typeof data.worktree_available).toBe('boolean');
  });
});

describe('initListWorkspaces', () => {
  it('returns flat JSON with workspaces array', async () => {
    const result = await initListWorkspaces([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(Array.isArray(data.workspaces)).toBe(true);
    expect(data.workspace_count).toBeGreaterThanOrEqual(0);
  });
});

describe('initRemoveWorkspace', () => {
  it('returns error when name arg missing', async () => {
    const result = await initRemoveWorkspace([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });

  it('rejects path separator in workspace name (T-14-01)', async () => {
    const result = await initRemoveWorkspace(['../../bad'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });
});

describe('initIngestDocs', () => {
  it('returns flat JSON with ingest-docs branching fields', async () => {
    const result = await initIngestDocs([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.project_exists).toBe(false);
    expect(data.planning_exists).toBe(true);
    expect(typeof data.has_git).toBe('boolean');
    expect(data.project_path).toBe('.planning/PROJECT.md');
    expect(data.commit_docs).toBeDefined();
    expect(data.project_root).toBe(tmpDir);
  });

  it('reports project_exists true when PROJECT.md is present', async () => {
    await writeFile(join(tmpDir, '.planning', 'PROJECT.md'), '# project');
    const result = await initIngestDocs([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.project_exists).toBe(true);
    expect(data.planning_exists).toBe(true);
  });
});
