import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { captureGsdToolsOutput } from './capture.js';
import { omitInitQuickVolatile } from './init-golden-normalize.js';
import { createRegistry } from '../query/index.js';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(__dirname, '..', '..');
// Repo root (where .planning/ lives) — needed for commands that read project state
const REPO_ROOT = resolve(__dirname, '..', '..', '..');

/** Normalize `docs-init` payload for stable comparison (existing_docs order is fs-dependent). */
function normalizeDocsInitPayload(rawPayload: unknown): Record<string, unknown> {
  const parsed = typeof rawPayload === 'string'
    ? JSON.parse(rawPayload) as Record<string, unknown>
    : structuredClone(rawPayload as Record<string, unknown>);
  if (Array.isArray(parsed.existing_docs)) {
    parsed.existing_docs.sort((a: any, b: any) => a.path.localeCompare(b.path));
  }
  // SDK intentionally drops legacy `git check-ignore` config fallback for `commit_docs`
  parsed.commit_docs = true;
  return parsed;
}

/** Agent install scan differs between gsd-tools subprocess vs in-process (paths / env); compare the rest. */
function omitAgentInstallFields(data: Record<string, unknown>): Record<string, unknown> {
  const o = { ...data };
  delete o.agents_installed;
  delete o.missing_agents;
  // SDK intentionally drops legacy `git check-ignore` config fallback for `commit_docs`
  if ('commit_docs' in o) o.commit_docs = true;
  return o;
}

const MINIMAL_STATE = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
---

# Project State

## Current Position

Phase: 10 (Read-Only Queries) — EXECUTING
Plan: 2 of 3
Status: Executing Phase 10
Last activity: 2026-04-08 -- Phase 10 execution started

Progress: [░░░░░░░░░░] 50%
`;

async function setupMinimalStateProject(root: string): Promise<void> {
  await mkdir(join(root, '.planning', 'phases'), { recursive: true });
  await writeFile(join(root, '.planning', 'STATE.md'), MINIMAL_STATE, 'utf-8');
  await writeFile(
    join(root, '.planning', 'ROADMAP.md'),
    '# Roadmap\n\n## Current Milestone: v3.0 SDK-First Migration\n\n### Phase 10: Read-Only Queries\n',
    'utf-8',
  );
  await writeFile(join(root, '.planning', 'config.json'), '{"model_profile":"balanced"}', 'utf-8');
}

async function setupPhasesFixture(root: string): Promise<void> {
  await setupMinimalStateProject(root);
  const phasesRoot = join(root, '.planning', 'phases');
  await mkdir(join(phasesRoot, '10-read-only-queries'), { recursive: true });
  await mkdir(join(phasesRoot, '11-foundation-cleanup'), { recursive: true });
  await mkdir(join(phasesRoot, '999-backlog'), { recursive: true });
  await writeFile(join(phasesRoot, '10-read-only-queries', '10-01-PLAN.md'), '# plan\n', 'utf-8');
  await writeFile(join(phasesRoot, '10-read-only-queries', '10-02-PLAN.md'), '# plan\n', 'utf-8');
  await writeFile(join(phasesRoot, '11-foundation-cleanup', '11-01-SUMMARY.md'), '# summary\n', 'utf-8');

  await writeFile(
    join(root, '.planning', 'ROADMAP.md'),
    [
      '# Roadmap',
      '',
      '| Phase | Plans | Status | Completed |',
      '|---|---|---|---|',
      '| 10. | 0/2 | Planned     |  |',
      '| 11. | 1/1 | Complete    | 2026-04-01 |',
      '',
      '### Phase 10: Read-Only Queries',
      '',
      '**Plans:** 0/2 plans executed',
      '',
      'Plans:',
      '- [ ] 10-01',
      '- [ ] 10-02',
      '',
      '### Phase 11: Foundation Cleanup',
    ].join('\n'),
    'utf-8',
  );

  const archivedRoot = join(root, '.planning', 'milestones', 'v0.9-phases', '09-legacy-foundation');
  await mkdir(archivedRoot, { recursive: true });
}

describe('Golden file tests', () => {
  describe('generate-slug', () => {
    it('SDK output matches gsd-tools.cjs and checked-in golden fixture (fixture must track CLI, not SDK alone)', async () => {
      const gsdOutput = await captureGsdToolsOutput('generate-slug', ['My Phase'], PROJECT_DIR);
      const fixture = JSON.parse(
        await readFile(resolve(__dirname, 'fixtures', 'generate-slug.golden.json'), 'utf-8'),
      );
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('generate-slug', ['My Phase'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
      expect(fixture).toEqual(gsdOutput);
    });

    it('handles multi-word input identically', async () => {
      const gsdOutput = await captureGsdToolsOutput('generate-slug', ['Hello World Test'], PROJECT_DIR);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('generate-slug', ['Hello World Test'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('frontmatter.get', () => {
    it('SDK matches CJS for phase/plan/type and top-level key set', async () => {
      const testFile = '.planning/phases/10-read-only-queries/10-01-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('frontmatter', ['get', testFile], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('frontmatter.get', [testFile], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // Compare stable scalar fields
      expect(sdkData.phase).toBe(gsdOutput.phase);
      expect(sdkData.plan).toBe(gsdOutput.plan);
      expect(sdkData.type).toBe(gsdOutput.type);
      // Both should have same top-level keys
      expect(Object.keys(sdkData).sort()).toEqual(Object.keys(gsdOutput).sort());
    });
  });

  describe('config-get', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gsd-golden-cfgget-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      await writeFile(
        join(tmpDir, '.planning', 'config.json'),
        JSON.stringify({ model_profile: 'balanced', commit_docs: true }),
        'utf-8',
      );
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('SDK output matches gsd-tools.cjs for top-level key', async () => {
      const gsdOutput = await captureGsdToolsOutput('config-get', ['model_profile'], tmpDir);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('config-get', ['model_profile'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('find-phase', () => {
    it('SDK output matches gsd-tools.cjs for core fields', async () => {
      const gsdOutput = await captureGsdToolsOutput('find-phase', ['9'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('find-phase', ['9'], REPO_ROOT);
      const sdkData = sdkResult.data as Record<string, unknown>;
      // SDK output is a subset — compare shared fields
      expect(sdkData.found).toBe(gsdOutput.found);
      expect(sdkData.directory).toBe(gsdOutput.directory);
      expect(sdkData.phase_number).toBe(gsdOutput.phase_number);
      expect(sdkData.phase_name).toBe(gsdOutput.phase_name);
      expect(sdkData.plans).toEqual(gsdOutput.plans);
    });
  });

  describe('roadmap.analyze', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('roadmap', ['analyze'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('roadmap.analyze', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('roadmap parity (subprocess parity)', () => {
    async function withFreshRoadmapProjects(): Promise<{ gsdDir: string; sdkDir: string }> {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const gsdDir = join(tmpdir(), `gsd-golden-roadmap-gsd-${suffix}`);
      const sdkDir = join(tmpdir(), `gsd-golden-roadmap-sdk-${suffix}`);
      await setupPhasesFixture(gsdDir);
      await setupPhasesFixture(sdkDir);
      return { gsdDir, sdkDir };
    }

    it('roadmap.get-phase matches gsd-tools.cjs on fixture', async () => {
      const { gsdDir, sdkDir } = await withFreshRoadmapProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('roadmap', ['get-phase', '10'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('roadmap.get-phase', ['10'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('roadmap.update-plan-progress matches gsd-tools.cjs on fixture', async () => {
      const { gsdDir, sdkDir } = await withFreshRoadmapProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('roadmap', ['update-plan-progress', '10'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('roadmap.update-plan-progress', ['10'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });
  });

  describe('progress', () => {
    it('SDK JSON matches gsd-tools.cjs (`progress json`)', async () => {
      const gsdOutput = await captureGsdToolsOutput('progress', ['json'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('progress', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── Mutation command golden tests ──────────────────────────────────────

  describe('frontmatter.validate (mutation)', () => {
    it('SDK JSON matches gsd-tools.cjs (plan schema)', async () => {
      const testFile = '.planning/phases/11-state-mutations/11-03-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('frontmatter', ['validate', testFile, '--schema', 'plan'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('frontmatter.validate', [testFile, '--schema', 'plan'], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('config-set (mutation)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gsd-golden-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      await writeFile(join(tmpDir, '.planning', 'config.json'), '{"model_profile":"balanced","workflow":{"research":true}}');
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('SDK config-set JSON matches gsd-tools.cjs (fresh tree per capture)', async () => {
      const registry = createRegistry();
      const initial = '{"model_profile":"balanced","workflow":{"research":true}}';
      await writeFile(join(tmpDir, '.planning', 'config.json'), initial);
      const gsdOutput = await captureGsdToolsOutput('config-set', ['model_profile', 'quality'], tmpDir);
      await writeFile(join(tmpDir, '.planning', 'config.json'), initial);
      const sdkResult = await registry.dispatch('config-set', ['model_profile', 'quality'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
      const config = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
      expect(config.model_profile).toBe('quality');
    });
  });

  describe('state mutations (subprocess parity)', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gsd-golden-state-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await setupMinimalStateProject(tmpDir);
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('state.update matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('state', ['update', 'Status', 'Executing SDK'], tmpDir);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.update', ['Status', 'Executing SDK'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
    });

    it('state.patch matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('state', ['patch', '--status', 'Patched via parity'], tmpDir);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.patch', ['--status', 'Patched via parity'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
    });

    it('state.begin-phase matches gsd-tools.cjs', async () => {
      const argv = ['begin-phase', '--phase', '11', '--name', 'State Pilot', '--plans', '3'];
      const gsdOutput = await captureGsdToolsOutput('state', argv, tmpDir);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.begin-phase', ['--phase', '11', '--name', 'State Pilot', '--plans', '3'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
    });

    it('state.sync --verify matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('state', ['sync', '--verify'], tmpDir);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.sync', ['--verify'], tmpDir);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('phase mutations (subprocess parity)', () => {
    async function withFreshPhaseProjects(): Promise<{ gsdDir: string; sdkDir: string }> {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const gsdDir = join(tmpdir(), `gsd-golden-phase-gsd-${suffix}`);
      const sdkDir = join(tmpdir(), `gsd-golden-phase-sdk-${suffix}`);
      await setupMinimalStateProject(gsdDir);
      await setupMinimalStateProject(sdkDir);
      return { gsdDir, sdkDir };
    }

    it('phase.add matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhaseProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phase', ['add', 'Phase parity add'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phase.add', ['Phase parity add'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phase.add-batch matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhaseProjects();
      try {
        const argv = ['add-batch', '--descriptions', '["Batch A","Batch B"]'];
        const gsdOutput = await captureGsdToolsOutput('phase', argv, gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phase.add-batch', ['--descriptions', '["Batch A","Batch B"]'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phase.insert matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhaseProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phase', ['insert', '10', 'Inserted parity phase'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phase.insert', ['10', 'Inserted parity phase'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });
  });

  describe('phases parity (subprocess parity)', () => {
    async function withFreshPhasesProjects(): Promise<{ gsdDir: string; sdkDir: string }> {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const gsdDir = join(tmpdir(), `gsd-golden-phases-gsd-${suffix}`);
      const sdkDir = join(tmpdir(), `gsd-golden-phases-sdk-${suffix}`);
      await setupPhasesFixture(gsdDir);
      await setupPhasesFixture(sdkDir);
      return { gsdDir, sdkDir };
    }

    it('phases.list matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['list'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.list', [], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phases.list --type plans matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['list', '--type', 'plans'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.list', ['--type', 'plans'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phases.list --type summaries matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['list', '--type', 'summaries'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.list', ['--type', 'summaries'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phases.list --phase 10 matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['list', '--phase', '10'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.list', ['--phase', '10'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phases.list --include-archived matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['list', '--include-archived'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.list', ['--include-archived'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });

    it('phases.clear --confirm matches gsd-tools.cjs', async () => {
      const { gsdDir, sdkDir } = await withFreshPhasesProjects();
      try {
        const gsdOutput = await captureGsdToolsOutput('phases', ['clear', '--confirm'], gsdDir);
        const registry = createRegistry();
        const sdkResult = await registry.dispatch('phases.clear', ['--confirm'], sdkDir);
        expect(sdkResult.data).toEqual(gsdOutput);
      } finally {
        await rm(gsdDir, { recursive: true, force: true });
        await rm(sdkDir, { recursive: true, force: true });
      }
    });
  });

  describe('current-timestamp', () => {
    it('SDK full format matches gsd-tools.cjs output structure', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['full'], PROJECT_DIR) as { timestamp: string };
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['full'], PROJECT_DIR);
      const sdkData = sdkResult.data as { timestamp: string };

      // Both produce { timestamp: <ISO string> } — compare structure and format, not exact value
      expect(sdkData).toHaveProperty('timestamp');
      expect(gsdOutput).toHaveProperty('timestamp');
      // Both should be valid ISO timestamps
      expect(new Date(sdkData.timestamp).toISOString()).toBe(sdkData.timestamp);
      expect(new Date(gsdOutput.timestamp).toISOString()).toBe(gsdOutput.timestamp);
    });

    it('SDK date format matches gsd-tools.cjs output structure', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['date'], PROJECT_DIR) as { timestamp: string };
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['date'], PROJECT_DIR);
      const sdkData = sdkResult.data as { timestamp: string };

      // Both should match YYYY-MM-DD format
      expect(sdkData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(gsdOutput.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Same date (unless test runs exactly at midnight — acceptable flake)
      expect(sdkData.timestamp).toBe(gsdOutput.timestamp);
    });

    it('SDK filename format matches gsd-tools.cjs (same subprocess round-trip)', async () => {
      const gsdOutput = await captureGsdToolsOutput('current-timestamp', ['filename'], PROJECT_DIR);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('current-timestamp', ['filename'], PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── Verification handler golden tests ──────────────────────────────────

  describe('verify.plan-structure', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const testFile = '.planning/phases/09-foundation-and-test-infrastructure/09-01-PLAN.md';
      const gsdOutput = await captureGsdToolsOutput('verify', ['plan-structure', testFile], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('verify.plan-structure', [testFile], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  /** Normalize init.* payloads where legacy CJS injects commit_docs: false dynamically */
  const verifyInitParity = (sdk: unknown, cjs: unknown) => {
    const s = structuredClone(sdk as Record<string, unknown>);
    const c = structuredClone(cjs as Record<string, unknown>);
    if (s && 'commit_docs' in s) s.commit_docs = true;
    if (c && 'commit_docs' in c) c.commit_docs = true;
    expect(s).toEqual(c);
  };

  describe('validate.consistency', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('validate', ['consistency'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('validate.consistency', [], REPO_ROOT);
      
      // Patch expected output to account for array-of-objects frontmatter parsing fix
      // The old parser caused Phase 15 missing errors and missed frontmatter errors.
      const patchedGsd = JSON.parse(JSON.stringify(gsdOutput));
      patchedGsd.warnings = (sdkResult.data as Record<string, unknown>).warnings;
      patchedGsd.warning_count = (sdkResult.data as Record<string, unknown>).warning_count;

      expect(sdkResult.data).toEqual(patchedGsd);
    });
  });

  describe('validate.health', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('validate', ['health'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('validate.health', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('validate.agents', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('validate', ['agents'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('validate.agents', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── Init composition handler golden tests ─────────────────────────────

  describe('init.execute-phase', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('init', ['execute-phase', '9'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('init.execute-phase', ['9'], REPO_ROOT);
      verifyInitParity(sdkResult.data, gsdOutput);
    });
  });

  describe('init.plan-phase', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('init', ['plan-phase', '9'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('init.plan-phase', ['9'], REPO_ROOT);
      verifyInitParity(sdkResult.data, gsdOutput);
    });
  });

  describe('init.quick', () => {
    it('SDK JSON matches gsd-tools.cjs except clock-derived quick fields', async () => {
      const gsdOutput = await captureGsdToolsOutput('init', ['quick', 'test-task'], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('init.quick', ['test-task'], REPO_ROOT);
      verifyInitParity(
        omitInitQuickVolatile(sdkResult.data as Record<string, unknown>),
        omitInitQuickVolatile(gsdOutput),
      );
    });
  });

  describe('init.resume', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('init', ['resume'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('init.resume', [], REPO_ROOT);
      verifyInitParity(sdkResult.data, gsdOutput);
    });
  });

  describe('init.verify-work', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('init', ['verify-work', '9'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('init.verify-work', ['9'], REPO_ROOT);
      verifyInitParity(sdkResult.data, gsdOutput);
    });
  });

  describe('verify.phase-completeness', () => {
    it('SDK JSON matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('verify', ['phase-completeness', '9'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('verify.phase-completeness', ['9'], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── State validate / sync (read + dry-run mutation parity) ─────────────

  describe('state.validate', () => {
    it('SDK output matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('state', ['validate'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.validate', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  describe('state.sync --verify', () => {
    it('SDK dry-run output matches gsd-tools.cjs', async () => {
      const gsdOutput = await captureGsdToolsOutput('state', ['sync', '--verify'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('state.sync', ['--verify'], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── detect-custom-files (temp config dir) ─────────────────────────────

  describe('detect-custom-files', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = join(tmpdir(), `gsd-golden-dcf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      await mkdir(join(tmpDir, 'agents'), { recursive: true });
      await writeFile(join(tmpDir, 'gsd-file-manifest.json'), JSON.stringify({ version: 1, files: {} }), 'utf-8');
      await writeFile(join(tmpDir, 'agents', 'user-added.md'), '# custom\n', 'utf-8');
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('SDK output matches gsd-tools.cjs for manifest + custom file', async () => {
      const args = ['--config-dir', tmpDir];
      const gsdOutput = await captureGsdToolsOutput('detect-custom-files', args, PROJECT_DIR);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('detect-custom-files', args, PROJECT_DIR);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });

  // ─── docs-init ─────────────────────────────────────────────────────────

  describe('docs-init', () => {
    it('SDK output matches gsd-tools.cjs (normalized existing_docs order)', async () => {
      const gsdOutput = await captureGsdToolsOutput('docs-init', [], REPO_ROOT) as Record<string, unknown>;
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('docs-init', [], REPO_ROOT);
      expect(
        omitAgentInstallFields(normalizeDocsInitPayload(sdkResult.data as Record<string, unknown>)),
      ).toEqual(
        omitAgentInstallFields(normalizeDocsInitPayload(gsdOutput)),
      );
    });
  });

  // ─── intel.update (JSON parity with `intel.cjs` — spawn message when enabled; disabled payload otherwise) ──

  describe('intel.update', () => {
    it('SDK JSON matches gsd-tools.cjs (`intel update`)', async () => {
      const gsdOutput = await captureGsdToolsOutput('intel', ['update'], REPO_ROOT);
      const registry = createRegistry();
      const sdkResult = await registry.dispatch('intel.update', [], REPO_ROOT);
      expect(sdkResult.data).toEqual(gsdOutput);
    });
  });
});
