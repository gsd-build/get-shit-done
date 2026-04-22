/**
 * Tests for validation query handlers — verifyKeyLinks, validateConsistency, validateHealth.
 *
 * Uses temp directories with fixture files to test verification logic.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { GSDError } from '../errors.js';

import { verifyKeyLinks, validateConsistency, validateHealth, regexForKeyLinkPattern } from './validate.js';

// ─── regexForKeyLinkPattern ────────────────────────────────────────────────

describe('regexForKeyLinkPattern', () => {
  it('preserves normal regex patterns used in key_links', () => {
    const re = regexForKeyLinkPattern('import.*foo.*from.*target');
    expect(re.test("import { foo } from './target.js';")).toBe(true);
  });

  it('falls back to literal match for nested-quantifier patterns', () => {
    const re = regexForKeyLinkPattern('(a+)+');
    expect(re.source).toContain('\\');
  });
});

// ─── verifyKeyLinks ────────────────────────────────────────────────────────

describe('verifyKeyLinks', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-validate-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('throws GSDError Validation when no args', async () => {
    let caught: unknown;
    try {
      await verifyKeyLinks([], tmpDir);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(GSDError);
    expect((caught as GSDError).classification).toBe('validation');
  });

  it('returns all_verified true when pattern found in source', async () => {
    // Create source file with an import statement
    await writeFile(join(tmpDir, 'source.ts'), "import { foo } from './target.js';");
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    // Create plan with key_links
    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo.*from.*target"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_verified).toBe(true);
    expect(data.verified).toBe(1);
    expect(data.total).toBe(1);
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].detail).toBe('Pattern found in source');
  });

  it('returns verified true with "Pattern found in target" when not in source but in target', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), "import { foo } from './other.js';");

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(true);
    expect(links[0].detail).toBe('Pattern found in target');
  });

  it('returns verified false when pattern not found in source or target', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), 'const y = 2;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import foo"
      pattern: "import.*foo"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.all_verified).toBe(false);
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(false);
  });

  it('returns Source file not found when source missing', async () => {
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: missing.ts
      to: target.ts
      via: "import"
      pattern: "import"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].detail).toBe('Source file not found');
    expect(links[0].verified).toBe(false);
  });

  it('checks target reference in source when no pattern specified', async () => {
    await writeFile(join(tmpDir, 'source.ts'), "import { foo } from './target.ts';");
    await writeFile(join(tmpDir, 'target.ts'), 'export const foo = 1;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "import"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(true);
    expect(links[0].detail).toBe('Target referenced in source');
  });

  it('reports invalid regex like gsd-tools.cjs (try/catch on new RegExp)', async () => {
    await writeFile(join(tmpDir, 'source.ts'), 'const x = 1;');
    await writeFile(join(tmpDir, 'target.ts'), 'const y = 2;');

    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true

must_haves:
  key_links:
    - from: source.ts
      to: target.ts
      via: "bad regex"
      pattern: "[invalid"
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const links = data.links as Array<Record<string, unknown>>;
    expect(links[0].verified).toBe(false);
    expect((links[0].detail as string)).toMatch(/Invalid regex pattern/);
  });

  it('returns error when no must_haves.key_links in plan', async () => {
    const planContent = `---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
---

# Plan
`;
    await writeFile(join(tmpDir, 'plan.md'), planContent);

    const result = await verifyKeyLinks(['plan.md'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('No must_haves.key_links found in frontmatter');
  });
});

// ─── validateConsistency ──────────────────────────────────────────────────

describe('validateConsistency', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-consistency-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /** Helper: create a .planning directory structure */
  async function createPlanning(opts: {
    roadmap?: string;
    phases?: Array<{ dir: string; plans?: string[]; summaries?: string[]; planContents?: Record<string, string> }>;
    config?: Record<string, unknown>;
  }): Promise<void> {
    const planning = join(tmpDir, '.planning');
    await mkdir(planning, { recursive: true });

    if (opts.roadmap !== undefined) {
      await writeFile(join(planning, 'ROADMAP.md'), opts.roadmap);
    }

    if (opts.config) {
      await writeFile(join(planning, 'config.json'), JSON.stringify(opts.config));
    }

    if (opts.phases) {
      const phasesDir = join(planning, 'phases');
      await mkdir(phasesDir, { recursive: true });
      for (const phase of opts.phases) {
        const phaseDir = join(phasesDir, phase.dir);
        await mkdir(phaseDir, { recursive: true });
        if (phase.plans) {
          for (const plan of phase.plans) {
            const content = phase.planContents?.[plan] ?? `---\nphase: ${phase.dir}\nplan: 01\ntype: execute\nwave: 1\ndepends_on: []\nfiles_modified: []\nautonomous: true\n---\n\n# Plan\n`;
            await writeFile(join(phaseDir, plan), content);
          }
        }
        if (phase.summaries) {
          for (const summary of phase.summaries) {
            await writeFile(join(phaseDir, summary), '# Summary\n');
          }
        }
      }
    }
  }

  it('returns passed true when ROADMAP phases match disk', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\nGoal here.\n\n## Phase 2: Features\n\nMore goals.\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], summaries: ['01-01-SUMMARY.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'], summaries: ['02-01-SUMMARY.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.passed).toBe(true);
    expect((data.errors as string[]).length).toBe(0);
    expect((data.warnings as string[]).length).toBe(0);
  });

  it('warns when phase in ROADMAP but not on disk', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\n## Phase 2: Features\n\n## Phase 3: Polish\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Phase 3') && w.includes('ROADMAP') && w.includes('no directory'))).toBe(true);
  });

  it('warns when phase on disk but not in ROADMAP', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '02-features', plans: ['02-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('02') && w.includes('disk') && w.includes('not in ROADMAP'))).toBe(true);
  });

  it('warns on gap in sequential phase numbering', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n\n## Phase 3: Polish\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'] },
        { dir: '03-polish', plans: ['03-01-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Gap in phase numbering'))).toBe(true);
  });

  it('warns on plan numbering gap within phase', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md', '01-03-PLAN.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Gap in plan numbering'))).toBe(true);
  });

  it('warns on summary without matching plan', async () => {
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], summaries: ['01-01-SUMMARY.md', '01-02-SUMMARY.md'] },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('Summary') && w.includes('no matching PLAN'))).toBe(true);
  });

  it('warns when plan missing wave in frontmatter', async () => {
    const noWavePlan = `---\nphase: 01\nplan: 01\ntype: execute\ndepends_on: []\nfiles_modified: []\nautonomous: true\n---\n\n# Plan\n`;
    await createPlanning({
      roadmap: '# Roadmap\n\n## Phase 1: Foundation\n',
      phases: [
        { dir: '01-foundation', plans: ['01-01-PLAN.md'], planContents: { '01-01-PLAN.md': noWavePlan } },
      ],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as string[];
    expect(warnings.some(w => w.includes('wave') && w.includes('frontmatter'))).toBe(true);
  });

  it('returns passed false with error when ROADMAP.md missing', async () => {
    await createPlanning({
      phases: [{ dir: '01-foundation', plans: ['01-01-PLAN.md'] }],
      config: { phase_naming: 'sequential' },
    });

    const result = await validateConsistency([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.passed).toBe(false);
    expect((data.errors as string[])).toContain('ROADMAP.md not found');
  });
});

// ─── validateHealth ─────────────────────────────────────────────────────────

describe('validateHealth', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-health-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  /** Helper: create a healthy .planning directory structure */
  async function createHealthyPlanning(): Promise<void> {
    const planning = join(tmpDir, '.planning');
    await mkdir(join(planning, 'phases', '01-foundation'), { recursive: true });

    await writeFile(join(planning, 'PROJECT.md'), '# Project\n\n## What This Is\n\nA project.\n\n## Core Value\n\nValue here.\n\n## Requirements\n\n- Req 1\n');
    await writeFile(join(planning, 'ROADMAP.md'), '# Roadmap\n\n## Phase 1: Foundation\n\nGoals.\n');
    await writeFile(join(planning, 'STATE.md'), '---\nstatus: executing\n---\n\n# State\n\n**Current Phase:** 1\n**Status:** executing\n');
    await writeFile(join(planning, 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      workflow: { nyquist_validation: true },
    }, null, 2));

    await writeFile(join(planning, 'phases', '01-foundation', '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\ntype: execute\nwave: 1\ndepends_on: []\nfiles_modified: []\nautonomous: true\n---\n\n# Plan\n');
    await writeFile(join(planning, 'phases', '01-foundation', '01-01-SUMMARY.md'), '# Summary\n');
  }

  it('returns healthy status when all files present', async () => {
    await createHealthyPlanning();

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.status).toBe('healthy');
    expect((data.errors as unknown[]).length).toBe(0);
    expect((data.warnings as unknown[]).length).toBe(0);
  });

  it('returns broken with E001 when no .planning/ directory', async () => {
    // tmpDir has no .planning/ — already the case

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.status).toBe('broken');
    const errors = data.errors as Array<Record<string, unknown>>;
    expect(errors.some(e => e.code === 'E001')).toBe(true);
  });

  it('returns error E002 when PROJECT.md missing', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'PROJECT.md'));

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const errors = data.errors as Array<Record<string, unknown>>;
    expect(errors.some(e => e.code === 'E002')).toBe(true);
  });

  it('returns error E003 when ROADMAP.md missing', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'ROADMAP.md'));

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const errors = data.errors as Array<Record<string, unknown>>;
    expect(errors.some(e => e.code === 'E003')).toBe(true);
  });

  it('returns error E004 when STATE.md missing (repairable)', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'STATE.md'));

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const errors = data.errors as Array<Record<string, unknown>>;
    const e004 = errors.find(e => e.code === 'E004');
    expect(e004).toBeDefined();
    expect(e004!.repairable).toBe(true);
  });

  it('returns error E005 when config.json has invalid JSON (repairable)', async () => {
    await createHealthyPlanning();
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{invalid json!!!');

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const errors = data.errors as Array<Record<string, unknown>>;
    const e005 = errors.find(e => e.code === 'E005');
    expect(e005).toBeDefined();
    expect(e005!.repairable).toBe(true);
  });

  it('returns warning W003 when config.json missing (repairable)', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'config.json'));

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as Array<Record<string, unknown>>;
    const w003 = warnings.find(w => w.code === 'W003');
    expect(w003).toBeDefined();
    expect(w003!.repairable).toBe(true);
  });

  it('returns warning W005 for bad phase directory naming', async () => {
    await createHealthyPlanning();
    await mkdir(join(tmpDir, '.planning', 'phases', 'bad_name'), { recursive: true });

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as Array<Record<string, unknown>>;
    expect(warnings.some(w => w.code === 'W005')).toBe(true);
  });

  it('returns early with E010 when CWD equals home directory', async () => {
    const result = await validateHealth([], homedir());
    const data = result.data as Record<string, unknown>;
    expect(data.status).toBe('error');
    const errors = data.errors as Array<Record<string, unknown>>;
    expect(errors.some(e => e.code === 'E010')).toBe(true);
  });

  it('returns warning W008 when config.json missing workflow.nyquist_validation', async () => {
    await createHealthyPlanning();
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      workflow: { research: true },
    }, null, 2));

    const result = await validateHealth([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const warnings = data.warnings as Array<Record<string, unknown>>;
    expect(warnings.some(w => w.code === 'W008')).toBe(true);
  });

  it('derives status from errors (broken), warnings (degraded), none (healthy)', async () => {
    // broken: no .planning/
    const r1 = await validateHealth([], tmpDir);
    expect((r1.data as Record<string, unknown>).status).toBe('broken');

    // degraded: missing config.json (warning only, not error)
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'config.json'));
    const r2 = await validateHealth([], tmpDir);
    expect((r2.data as Record<string, unknown>).status).toBe('degraded');

    // healthy: all present
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      workflow: { nyquist_validation: true },
    }, null, 2));
    const r3 = await validateHealth([], tmpDir);
    expect((r3.data as Record<string, unknown>).status).toBe('healthy');
  });

  // ─── Repair tests ───────────────────────────────────────────────────────

  it('--repair with missing config.json creates config.json with defaults', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'config.json'));

    const result = await validateHealth(['--repair'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.repairs_performed).toBeDefined();
    const repairs = data.repairs_performed as Array<Record<string, unknown>>;
    expect(repairs.some(r => r.action === 'createConfig' && r.success === true)).toBe(true);

    // Verify file was created
    const config = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(config.model_profile).toBe('balanced');
    expect(config.workflow.nyquist_validation).toBe(true);
  });

  it('--repair with missing STATE.md generates minimal STATE.md', async () => {
    await createHealthyPlanning();
    const { unlink } = await import('node:fs/promises');
    await unlink(join(tmpDir, '.planning', 'STATE.md'));

    const result = await validateHealth(['--repair'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const repairs = data.repairs_performed as Array<Record<string, unknown>>;
    expect(repairs.some(r => r.action === 'regenerateState' && r.success === true)).toBe(true);

    // Verify file was created
    const stateContent = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(stateContent).toContain('# Session State');
    expect(stateContent).toContain('regenerated by');
  });

  it('--repair with missing nyquist key adds workflow.nyquist_validation', async () => {
    await createHealthyPlanning();
    await writeFile(join(tmpDir, '.planning', 'config.json'), JSON.stringify({
      model_profile: 'balanced',
      workflow: { research: true },
    }, null, 2));

    const result = await validateHealth(['--repair'], tmpDir);
    const data = result.data as Record<string, unknown>;
    const repairs = data.repairs_performed as Array<Record<string, unknown>>;
    expect(repairs.some(r => r.action === 'addNyquistKey' && r.success === true)).toBe(true);

    // Verify key was added
    const config = JSON.parse(await readFile(join(tmpDir, '.planning', 'config.json'), 'utf-8'));
    expect(config.workflow.nyquist_validation).toBe(true);
  });
});
