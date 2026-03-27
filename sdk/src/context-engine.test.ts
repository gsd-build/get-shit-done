import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ContextEngine, PHASE_FILE_MANIFEST } from './context-engine.js';
import { PhaseType } from './types.js';
import type { GSDLogger } from './logger.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createTempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'gsd-ctx-'));
}

async function createPlanningDir(projectDir: string, files: Record<string, string>): Promise<void> {
  const planningDir = join(projectDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  for (const [filename, content] of Object.entries(files)) {
    await writeFile(join(planningDir, filename), content, 'utf-8');
  }
}

function makeMockLogger(): GSDLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setPhase: vi.fn(),
    setPlan: vi.fn(),
    setSessionId: vi.fn(),
  } as unknown as GSDLogger;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ContextEngine', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await createTempProject();
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  describe('resolveContextFiles', () => {
    it('returns all files for plan phase when all exist', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State\nproject: test',
        'ROADMAP.md': '# Roadmap\nphase 01',
        'CONTEXT.md': '# Context\nstack: node',
        'RESEARCH.md': '# Research\nfindings here',
        'REQUIREMENTS.md': '# Requirements\nR1: auth',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Plan);

      expect(files.state).toBe('# State\nproject: test');
      expect(files.roadmap).toBe('# Roadmap\nphase 01');
      expect(files.context).toBe('# Context\nstack: node');
      expect(files.research).toBe('# Research\nfindings here');
      expect(files.requirements).toBe('# Requirements\nR1: auth');
    });

    it('returns minimal files for execute phase', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State',
        'config.json': '{"model":"claude"}',
        'ROADMAP.md': '# Roadmap — should not be read',
        'CONTEXT.md': '# Context — should not be read',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Execute);

      expect(files.state).toBe('# State');
      expect(files.config).toBe('{"model":"claude"}');
      expect(files.roadmap).toBeUndefined();
      expect(files.context).toBeUndefined();
    });

    it('returns state + roadmap + context for research phase', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State',
        'ROADMAP.md': '# Roadmap',
        'CONTEXT.md': '# Context',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Research);

      expect(files.state).toBe('# State');
      expect(files.roadmap).toBe('# Roadmap');
      expect(files.context).toBe('# Context');
      expect(files.requirements).toBeUndefined();
    });

    it('returns state + roadmap + requirements for verify phase', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State',
        'ROADMAP.md': '# Roadmap',
        'REQUIREMENTS.md': '# Requirements',
        'PLAN.md': '# Plan',
        'SUMMARY.md': '# Summary',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Verify);

      expect(files.state).toBe('# State');
      expect(files.roadmap).toBe('# Roadmap');
      expect(files.requirements).toBe('# Requirements');
      expect(files.plan).toBe('# Plan');
      expect(files.summary).toBe('# Summary');
    });

    it('returns state + optional files for discuss phase', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State',
        'ROADMAP.md': '# Roadmap',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Discuss);

      expect(files.state).toBe('# State');
      expect(files.roadmap).toBe('# Roadmap');
      expect(files.context).toBeUndefined();
    });

    it('returns undefined for missing optional files without warning', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '# State',
        'ROADMAP.md': '# Roadmap',
        'CONTEXT.md': '# Context',
      });

      const logger = makeMockLogger();
      const engine = new ContextEngine(projectDir, logger);
      const files = await engine.resolveContextFiles(PhaseType.Plan);

      // research and requirements are optional for plan — no warning
      expect(files.research).toBeUndefined();
      expect(files.requirements).toBeUndefined();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('warns for missing required files', async () => {
      // Empty .planning dir — STATE.md is required for all phases
      await createPlanningDir(projectDir, {});

      const logger = makeMockLogger();
      const engine = new ContextEngine(projectDir, logger);
      await engine.resolveContextFiles(PhaseType.Execute);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('STATE.md'),
        expect.objectContaining({ phase: PhaseType.Execute }),
      );
    });

    it('handles missing .planning directory gracefully', async () => {
      // No .planning dir at all
      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Execute);

      expect(files.state).toBeUndefined();
      expect(files.config).toBeUndefined();
    });

    it('handles empty file content', async () => {
      await createPlanningDir(projectDir, {
        'STATE.md': '',
      });

      const engine = new ContextEngine(projectDir);
      const files = await engine.resolveContextFiles(PhaseType.Execute);

      // Empty string is still defined — the file exists
      expect(files.state).toBe('');
    });
  });

  describe('PHASE_FILE_MANIFEST', () => {
    it('covers all phase types', () => {
      for (const phase of Object.values(PhaseType)) {
        expect(PHASE_FILE_MANIFEST[phase]).toBeDefined();
        expect(PHASE_FILE_MANIFEST[phase].length).toBeGreaterThan(0);
      }
    });

    it('execute phase has fewest files', () => {
      const executeCount = PHASE_FILE_MANIFEST[PhaseType.Execute].length;
      const planCount = PHASE_FILE_MANIFEST[PhaseType.Plan].length;
      expect(executeCount).toBeLessThan(planCount);
    });

    it('every spec has required key, filename, and required flag', () => {
      for (const specs of Object.values(PHASE_FILE_MANIFEST)) {
        for (const spec of specs) {
          expect(spec.key).toBeDefined();
          expect(spec.filename).toBeDefined();
          expect(typeof spec.required).toBe('boolean');
        }
      }
    });
  });
});
