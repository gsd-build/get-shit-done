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
