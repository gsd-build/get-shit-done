/**
 * Unit tests for phase lifecycle handlers.
 *
 * Tests phaseAdd, phaseAddBatch, phaseInsert, phaseScaffold, replaceInCurrentMilestone,
 * and readModifyWriteRoadmapMd.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

// ─── Fixtures ─────────────────────────────────────────────────────────────

const MINIMAL_ROADMAP = `# Roadmap

## Current Milestone: v3.0 SDK-First Migration

### Phase 9: Foundation

**Goal:** Build foundation
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 3 plans

Plans:
- [x] 09-01 (Foundation setup)

### Phase 10: Read-Only Queries

**Goal:** Port queries.
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 3 plans

Plans:
- [x] 10-01 (Query setup)

---
*Last updated: 2026-04-08*
`;

const ROADMAP_WITH_DETAILS = `# Roadmap

<details>
<summary>v1.0 (shipped)</summary>

### Phase 1: Old Phase

**Goal:** Shipped already
**Plans:** 2 plans

</details>

## Current Milestone: v3.0 SDK-First Migration

### Phase 9: Foundation

**Goal:** Build foundation
**Requirements**: TBD
**Plans:** 3 plans

### Phase 10: Read-Only Queries

**Goal:** Port queries.
**Requirements**: TBD
**Plans:** 3 plans

---
*Last updated: 2026-04-08*
`;

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

## Session Continuity

Last session: 2026-04-07T10:00:00.000Z
Stopped at: Completed 10-02-PLAN.md
`;

/** Create a test project with .planning structure. */
async function setupTestProject(
  tmpDir: string,
  opts?: { roadmap?: string; state?: string; config?: Record<string, unknown>; phases?: string[] }
): Promise<string> {
  const planningDir = join(tmpDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  const phasesDir = join(planningDir, 'phases');
  await mkdir(phasesDir, { recursive: true });
  await writeFile(join(planningDir, 'ROADMAP.md'), opts?.roadmap || MINIMAL_ROADMAP, 'utf-8');
  await writeFile(join(planningDir, 'STATE.md'), opts?.state || MINIMAL_STATE, 'utf-8');
  await writeFile(
    join(planningDir, 'config.json'),
    JSON.stringify(opts?.config || { model_profile: 'balanced', phase_naming: 'sequential' }),
    'utf-8'
  );
  // Create phase directories if requested
  if (opts?.phases) {
    for (const phase of opts.phases) {
      await mkdir(join(phasesDir, phase), { recursive: true });
      await writeFile(join(phasesDir, phase, '.gitkeep'), '', 'utf-8');
    }
  }
  return tmpDir;
}

// ─── Tests ────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-lifecycle-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── replaceInCurrentMilestone ──────────────────────────────────────────

describe('replaceInCurrentMilestone', () => {
  it('replaces in full content when no details blocks', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    const content = '### Phase 9: Foundation\n**Plans:** 3 plans\n';
    const result = replaceInCurrentMilestone(content, /3 plans/, '4 plans');
    expect(result).toContain('4 plans');
  });

  it('only replaces after last </details> block', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    const content = '<details>\n### Phase 1: Old\n**Plans:** 3 plans\n</details>\n\n### Phase 9: Current\n**Plans:** 3 plans\n';
    const result = replaceInCurrentMilestone(content, /3 plans/, '4 plans');
    // Should only replace in the current milestone section (after </details>)
    const before = result.slice(0, result.indexOf('</details>') + '</details>'.length);
    const after = result.slice(result.indexOf('</details>') + '</details>'.length);
    expect(before).toContain('3 plans'); // old milestone untouched
    expect(after).toContain('4 plans'); // current milestone updated
  });

  it('replaces only in current milestone when older milestones are wrapped in <details>', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    const content = [
      '# Roadmap',
      '',
      '<details>',
      '<summary>✅ v1.18 (shipped)</summary>',
      '',
      '### Phase 1: Old Phase',
      '',
      '- [ ] Phase 1: Old Phase',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>✅ v1.19 (shipped)</summary>',
      '',
      '### Phase 2: Another Old Phase',
      '',
      '</details>',
      '',
      '## Current Milestone: v1.20',
      '',
      '- [ ] Phase 3: Current work',
      '',
      '### Phase 3: Current work',
      '',
      '**Plans:** 0/2 plans',
      '',
    ].join('\n');

    const pattern = /\*\*Plans:\*\* [^\n]+/;
    const result = replaceInCurrentMilestone(content, pattern, '**Plans:** 2/2 plans complete');

    // Should update Phase 3's Plans line (current milestone)
    expect(result).toContain('**Plans:** 2/2 plans complete');
    // Should NOT touch v1.18 or v1.19 sections
    expect(result).toContain('✅ v1.18');
    expect(result).toContain('✅ v1.19');
  });

  it('replaces inside active milestone when it is wrapped in a <details> block', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    // Scenario: active milestone is collapsed in <details> (e.g. user collapsed it)
    const content = [
      '# Roadmap',
      '',
      '<details>',
      '<summary>✅ v1.18 (shipped)</summary>',
      '',
      '### Phase 1: Old Phase',
      '',
      '**Plans:** 1/1 plans',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>🚧 v1.19 in-progress</summary>',
      '',
      '### Phase 2: Current Work',
      '',
      '**Plans:** 1/2 plans',
      '',
      '</details>',
      '',
    ].join('\n');

    const pattern = /\*\*Plans:\*\* [^\n]+/g;
    const result = replaceInCurrentMilestone(content, pattern, '**Plans:** 2/2 plans complete');

    // The replacement should happen somewhere in the content (not silently dropped)
    expect(result).toContain('**Plans:** 2/2 plans complete');
    // v1.18 old plans line should remain untouched
    expect(result).toContain('**Plans:** 1/1 plans');
  });

  it('replaces inside active <details> even when footer text exists after </details>', async () => {
    const { replaceInCurrentMilestone } = await import('./phase-lifecycle.js');
    // Scenario: active milestone is the last <details> block, but a footer
    // (e.g. "---\n*Last updated*") follows it. The fast-path sees after.trim()
    // non-empty and replaces in the footer instead of inside the active block.
    const content = [
      '# Roadmap',
      '',
      '<details>',
      '<summary>v1.0 (Archived)</summary>',
      '',
      '**Plans:** 1/1 plans',
      '',
      '</details>',
      '',
      '<details>',
      '<summary>v2.0 (Active)</summary>',
      '',
      '**Plans:** 1/2 plans',
      '',
      '</details>',
      '',
      '---',
      '*Last updated: 2026-01-01*',
    ].join('\n');

    const pattern = /\*\*Plans:\*\* [^\n]+/g;
    const result = replaceInCurrentMilestone(content, pattern, '**Plans:** 2/2 plans complete');

    // Active milestone inside last <details> should be updated
    expect(result).toContain('**Plans:** 2/2 plans complete');
    // Archived milestone should remain untouched
    expect(result).toContain('**Plans:** 1/1 plans');
    // Footer should be preserved verbatim
    expect(result).toContain('---');
    expect(result).toContain('*Last updated: 2026-01-01*');
  });
});

// ─── readModifyWriteRoadmapMd ───────────────────────────────────────────

describe('readModifyWriteRoadmapMd', () => {
  it('reads, modifies, and writes ROADMAP.md atomically', async () => {
    const { readModifyWriteRoadmapMd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);
    const result = await readModifyWriteRoadmapMd(tmpDir, (content) => {
      return content.replace('Port queries.', 'Port all queries.');
    });
    expect(result).toContain('Port all queries.');
    const ondisk = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(ondisk).toContain('Port all queries.');
  });

  it('creates and releases lockfile', async () => {
    const { readModifyWriteRoadmapMd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);
    await readModifyWriteRoadmapMd(tmpDir, (c) => c);
    // Lock should be released after operation
    const lockPath = join(tmpDir, '.planning', 'ROADMAP.md.lock');
    expect(existsSync(lockPath)).toBe(false);
  });
});

// ─── phaseAdd ──────────────────────────────────────────────────────────

describe('phaseAdd', () => {
  it('creates directory and updates ROADMAP.md for sequential phase', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phaseAdd(['New Feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe(11);
    expect(data.padded).toBe('11');
    expect(data.name).toBe('New Feature');
    expect(data.slug).toBe('new-feature');
    expect(data.naming_mode).toBe('sequential');

    // Verify directory was created
    const dir = data.directory as string;
    expect(dir).toContain('11-new-feature');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const newDir = entries.find(e => e.isDirectory() && e.name.includes('11-new-feature'));
    expect(newDir).toBeTruthy();

    // Verify .gitkeep
    expect(existsSync(join(phasesDir, newDir!.name, '.gitkeep'))).toBe(true);

    // Verify ROADMAP.md updated
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(roadmap).toContain('### Phase 11: New Feature');
    expect(roadmap).toContain('**Goal:** [To be planned]');
  });

  it('skips phases >= 999 when calculating next number (backlog exclusion)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    const roadmapWith999 = MINIMAL_ROADMAP.replace(
      '---\n*Last updated',
      '### Phase 999: Backlog\n\n**Goal:** Backlog items\n**Plans:** 0 plans\n\n---\n*Last updated'
    );
    await setupTestProject(tmpDir, { roadmap: roadmapWith999 });

    const result = await phaseAdd(['After Ten'], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Should be 11, not 1000
    expect(data.phase_number).toBe(11);
  });

  it('throws GSDError with Validation for empty description', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseAdd([], tmpDir)).rejects.toThrow('description required');
  });

  it('inserts phase entry before last --- separator', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await phaseAdd(['Inserted Phase'], tmpDir);
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // The new phase should appear before the trailing ---
    const phaseIdx = roadmap.indexOf('### Phase 11: Inserted Phase');
    const sepIdx = roadmap.lastIndexOf('\n---');
    expect(phaseIdx).toBeLessThan(sepIdx);
    expect(phaseIdx).toBeGreaterThan(0);
  });

  it('detects max phase from bullet checklist format (regression #2726)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');

    const roadmap = [
      '# Roadmap',
      '',
      '## Current Milestone: v5.0',
      '',
      '- [x] Phase 76: Data Import',
      '- [x] Phase 77: Data Transform',
      '- [ ] Phase 88: Final Cleanup',
      '',
    ].join('\n');

    await setupTestProject(tmpDir, {
      roadmap,
      state: MINIMAL_STATE,
      phases: [],
    });

    const result = await phaseAdd(['new-feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe(89);
    expect(data.padded).toBe('89');
  });

  it('detects max phase from bold inline format (regression #2726)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');

    const roadmap = [
      '# Roadmap',
      '',
      '## Current Milestone: v5.0',
      '',
      '**Phase 50: Core Infrastructure**',
      '**Phase 51: API Layer**',
      '',
    ].join('\n');

    await setupTestProject(tmpDir, {
      roadmap,
      state: MINIMAL_STATE,
      phases: [],
    });

    const result = await phaseAdd(['new-feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe(52);
  });

  it('falls back to filesystem scan when no phase matches in ROADMAP (regression #2726)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');

    // ROADMAP with no recognizable phase entries
    const roadmap = '# Roadmap\n\n## Current Milestone: v5.0\n\nSome content without phases\n';

    await setupTestProject(tmpDir, {
      roadmap,
      state: MINIMAL_STATE,
      phases: ['45-legacy-phase', '46-another-phase'],
    });

    const result = await phaseAdd(['new-feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Should detect phases 45 and 46 on disk, so new phase = 47
    expect(data.phase_number).toBe(47);
  });

  it('filesystem fallback handles project-code-prefixed phase directories (regression coderabbit)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');

    const roadmap = '# Roadmap\n\n## Current Milestone: v5.0\n\nSome content\n';

    await setupTestProject(tmpDir, {
      roadmap,
      state: MINIMAL_STATE,
      phases: [],
    });

    // Create prefixed directories manually (project_code = "CK" scenario)
    const phasesDir = join(tmpDir, '.planning', 'phases');
    await mkdir(join(phasesDir, 'CK-45-legacy-phase'), { recursive: true });
    await mkdir(join(phasesDir, 'CK-46-another-phase'), { recursive: true });

    const result = await phaseAdd(['new-feature'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Should detect CK-45 and CK-46, so new phase = 47
    expect(data.phase_number).toBe(47);
  });

  // ── Symptom A: --dry-run flag (#3226) ─────────────────────────────────

  it('--dry-run returns JSON result without creating any files or modifying ROADMAP', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const roadmapBefore = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const result = await phaseAdd(['Dry Run Phase', '--dry-run'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Result must include the computed fields
    expect(data.phase_number).toBe(11);
    expect(data.padded).toBe('11');
    expect(data.name).toBe('Dry Run Phase');
    expect(data.slug).toBe('dry-run-phase');
    expect(data.dry_run).toBe(true);
    expect(typeof data.roadmap_entry).toBe('string');
    expect((data.roadmap_entry as string)).toContain('### Phase 11: Dry Run Phase');

    // ROADMAP.md must be unchanged
    const roadmapAfter = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(roadmapAfter).toBe(roadmapBefore);

    // No new phase directory must have been created
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const newDir = entries.find(e => e.isDirectory() && e.name.includes('11-dry-run-phase'));
    expect(newDir).toBeUndefined();
  });

  it('--dry-run works when flag appears after customId position', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const roadmapBefore = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    // description + --dry-run — no customId; flag must not be mistaken for customId
    const result = await phaseAdd(['My Feature', '--dry-run'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.dry_run).toBe(true);
    expect(data.phase_number).toBe(11);

    // ROADMAP must still be untouched
    const roadmapAfter = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(roadmapAfter).toBe(roadmapBefore);
  });

  // ── Symptom C: unknown flag rejection (#3226) ──────────────────────────

  it('rejects unknown --flags with a validation error naming the flag', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseAdd(['My Feature', '--bogus-flag'], tmpDir)).rejects.toThrow('--bogus-flag');
  });

  it('rejects any unknown --flag even when mixed with dry-run', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseAdd(['Desc', '--dry-run', '--unknown'], tmpDir)).rejects.toThrow('--unknown');
  });

  // ── Symptom B: ROADMAP heading scan counts ### Phase N: (#3226 verify) ─

  it('scans ### Phase N: headings in ROADMAP when no on-disk dirs exist (B already fixed)', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');

    const roadmap = [
      '# Roadmap',
      '',
      '## Current Milestone: v5.0',
      '',
      '### Phase 5: Foundation',
      '',
      '**Goal:** Build foundation',
      '**Plans:** 0 plans',
      '',
    ].join('\n');

    await setupTestProject(tmpDir, {
      roadmap,
      state: MINIMAL_STATE,
      phases: [], // no on-disk dirs — must rely on ROADMAP scan
    });

    const result = await phaseAdd(['Next Phase'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Must detect Phase 5 from ### heading → next = 6, not 1
    expect(data.phase_number).toBe(6);
  });

  // ── Concurrent phase.add: no duplicate IDs (CR finding) ────────────────
  it('concurrent phase.add calls produce distinct sequential phase numbers', async () => {
    const { phaseAdd } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    // Fire two phase.add calls simultaneously. If computation happens outside
    // the lock both will observe maxPhase=10 and claim newPhaseId=11 — collision.
    const [r1, r2] = await Promise.all([
      phaseAdd(['Concurrent Alpha'], tmpDir),
      phaseAdd(['Concurrent Beta'], tmpDir),
    ]);

    const n1 = (r1.data as Record<string, unknown>).phase_number as number;
    const n2 = (r2.data as Record<string, unknown>).phase_number as number;

    // Both must succeed and produce DIFFERENT numbers
    expect(n1).not.toBe(n2);

    // The pair must be {11, 12} — no gaps, no duplicates
    const sorted = [n1, n2].sort((a, b) => a - b);
    expect(sorted).toEqual([11, 12]);

    // ROADMAP.md must contain exactly one entry for each phase
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    const phase11Count = (roadmap.match(/### Phase 11:/g) || []).length;
    const phase12Count = (roadmap.match(/### Phase 12:/g) || []).length;
    expect(phase11Count).toBe(1);
    expect(phase12Count).toBe(1);

    // Both phase directories must exist on disk
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    const has11 = dirs.some(d => d.startsWith('11-'));
    const has12 = dirs.some(d => d.startsWith('12-'));
    expect(has11).toBe(true);
    expect(has12).toBe(true);
  });
});

// ─── phaseAddBatch ─────────────────────────────────────────────────────

describe('phaseAddBatch', () => {
  it('adds multiple sequential phases in one pass', async () => {
    const { phaseAddBatch } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phaseAddBatch(['Alpha', 'Beta'], tmpDir);
    const data = result.data as { phases: Array<Record<string, unknown>>; count: number };

    expect(data.count).toBe(2);
    expect(data.phases[0].phase_number).toBe(11);
    expect(data.phases[0].name).toBe('Alpha');
    expect(data.phases[1].phase_number).toBe(12);
    expect(data.phases[1].name).toBe('Beta');

    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    expect(roadmap).toContain('### Phase 11: Alpha');
    expect(roadmap).toContain('### Phase 12: Beta');

    const phasesDir = join(tmpDir, '.planning', 'phases');
    expect(existsSync(join(phasesDir, '11-alpha', '.gitkeep'))).toBe(true);
    expect(existsSync(join(phasesDir, '12-beta', '.gitkeep'))).toBe(true);
  });

  it('accepts --descriptions JSON array', async () => {
    const { phaseAddBatch } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, { phases: ['09-foundation', '10-read-only-queries'] });

    const result = await phaseAddBatch(
      ['--descriptions', JSON.stringify(['One', 'Two'])],
      tmpDir,
    );
    const data = result.data as { count: number };
    expect(data.count).toBe(2);
  });

  it('throws when no descriptions', async () => {
    const { phaseAddBatch } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseAddBatch([], tmpDir)).rejects.toThrow('descriptions array required');
  });
});

// ─── phaseInsert ────────────────────────────────────────────────────────

describe('phaseInsert', () => {
  it('creates decimal phase directory after target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phaseInsert(['10', 'Urgent Fix'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_number).toBe('10.1');
    expect(data.after_phase).toBe('10');
    expect(data.name).toBe('Urgent Fix');
    expect(data.slug).toBe('urgent-fix');

    // Verify directory created
    const dir = data.directory as string;
    expect(dir).toContain('10.1-urgent-fix');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const newDir = entries.find(e => e.isDirectory() && e.name.includes('10.1-urgent-fix'));
    expect(newDir).toBeTruthy();
  });

  it('scans both directories and ROADMAP.md for existing decimals to avoid collisions', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries', '10.1-hotfix'],
    });

    const result = await phaseInsert(['10', 'Another Fix'], tmpDir);
    const data = result.data as Record<string, unknown>;
    // Should be 10.2 since 10.1 already exists on disk
    expect(data.phase_number).toBe('10.2');
  });

  it('inserts section in ROADMAP.md after target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await phaseInsert(['10', 'Urgent Fix'], tmpDir);
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    expect(roadmap).toContain('### Phase 10.1: Urgent Fix (INSERTED)');
    // Should appear after Phase 10 section
    const phase10Idx = roadmap.indexOf('### Phase 10:');
    const insertedIdx = roadmap.indexOf('### Phase 10.1:');
    expect(insertedIdx).toBeGreaterThan(phase10Idx);
  });

  it('throws GSDError for missing target phase', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseInsert(['99', 'Missing'], tmpDir)).rejects.toThrow('Phase 99 not found');
  });

  it('throws GSDError with Validation for missing args', async () => {
    const { phaseInsert } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    await expect(phaseInsert([], tmpDir)).rejects.toThrow('after-phase and description required');
  });
});

// ─── phaseScaffold ──────────────────────────────────────────────────────

describe('phaseScaffold', () => {
  it('creates context template for a phase', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['context', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const filePath = data.path as string;
    expect(filePath).toContain('09-CONTEXT.md');

    // Check content
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-CONTEXT.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('phase: "09"');
    expect(content).toContain('Context');
  });

  it('creates uat template', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['uat', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-UAT.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('User Acceptance Testing');
  });

  it('creates verification template', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    const result = await phaseScaffold(['verification', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const fullPath = join(tmpDir, '.planning', 'phases', '09-foundation', '09-VERIFICATION.md');
    expect(existsSync(fullPath)).toBe(true);
    const content = await readFile(fullPath, 'utf-8');
    expect(content).toContain('Verification');
  });

  it('creates phase-dir under phases/', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir);

    const result = await phaseScaffold(['phase-dir', '15', 'New Module'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.created).toBe(true);
    const dir = data.directory as string;
    expect(dir).toContain('15-new-module');
  });

  it('returns already_exists for existing file', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    // Create first
    await phaseScaffold(['context', '9'], tmpDir);
    // Second call should return already_exists
    const result = await phaseScaffold(['context', '9'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.created).toBe(false);
    expect(data.reason).toBe('already_exists');
  });

  it('throws GSDError for unknown type', async () => {
    const { phaseScaffold } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation'],
    });

    await expect(phaseScaffold(['badtype', '9'], tmpDir)).rejects.toThrow('Unknown scaffold type');
  });
});

// ─── phaseRemove ─────────────────────────────────────────────────────────

const ROADMAP_FOR_REMOVE = `# Roadmap

## Current Milestone: v3.0 SDK-First Migration

### Phase 5: Auth

**Goal:** Build authentication
**Requirements**: TBD
**Depends on:** Phase 4
**Plans:** 2 plans

Plans:
- [x] 05-01 (Auth setup)
- [x] 05-02 (Auth complete)

### Phase 6: Dashboard

**Goal:** Build dashboard
**Requirements**: TBD
**Depends on:** Phase 5
**Plans:** 3 plans

Plans:
- [ ] 06-01 (Dashboard setup)

### Phase 7: API

**Goal:** Build API layer
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 2 plans

Plans:
- [ ] 07-01 (API setup)

---
*Last updated: 2026-04-08*
`;

const STATE_FOR_REMOVE = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 15
  completed_plans: 12
  percent: 80
---

# Project State

## Current Position

Phase: 6 (Dashboard) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 6

## Session Continuity

Last session: 2026-04-08T10:00:00.000Z
Stopped at: Started
`;

describe('phaseRemove', () => {
  it('removes integer phase directory and renumbers subsequent phases', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '07-api'],
    });
    // Create files inside directories to verify file renaming
    await writeFile(join(phasesDir, '06-dashboard', '06-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(phasesDir, '07-api', '07-01-PLAN.md'), 'plan', 'utf-8');

    const result = await phaseRemove(['6'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.removed).toBe('6');
    expect(data.directory_deleted).toBeTruthy();
    expect(data.roadmap_updated).toBe(true);
    expect(data.state_updated).toBe(true);

    // Phase 6 dir should be gone
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    expect(dirNames.find(d => d.includes('06-dashboard'))).toBeUndefined();

    // Phase 7 should have been renamed to 06
    const renamedDir = dirNames.find(d => d.includes('06-api'));
    expect(renamedDir).toBeTruthy();

    // Files inside renamed dir should also be renamed
    const files = await readdir(join(phasesDir, renamedDir!));
    expect(files.some(f => f.includes('06-01'))).toBe(true);
    expect(files.some(f => f.includes('07-01'))).toBe(false);
  });

  it('removes decimal phase and renumbers sibling decimals', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    const decimalRoadmap = ROADMAP_FOR_REMOVE.replace(
      '### Phase 7: API',
      '### Phase 6.1: Hotfix A\n\n**Goal:** Fix A\n**Plans:** 1 plans\n\n### Phase 6.2: Hotfix B\n\n**Goal:** Fix B\n**Plans:** 1 plans\n\n### Phase 6.3: Hotfix C\n\n**Goal:** Fix C\n**Plans:** 1 plans\n\n### Phase 7: API'
    );
    const phasesDir = join(tmpDir, '.planning', 'phases');
    await setupTestProject(tmpDir, {
      roadmap: decimalRoadmap,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '06.1-hotfix-a', '06.2-hotfix-b', '06.3-hotfix-c', '07-api'],
    });
    // Create files with phase ID in name
    await writeFile(join(phasesDir, '06.2-hotfix-b', '06.2-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(phasesDir, '06.3-hotfix-c', '06.3-01-PLAN.md'), 'plan', 'utf-8');

    const result = await phaseRemove(['6.1'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.removed).toBe('6.1');

    // 06.1 should be gone
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    expect(dirNames.find(d => d.includes('06.1-hotfix-a'))).toBeUndefined();

    // 06.2 should become 06.1, 06.3 should become 06.2
    expect(dirNames.find(d => d.includes('06.1-hotfix-b'))).toBeTruthy();
    expect(dirNames.find(d => d.includes('06.2-hotfix-c'))).toBeTruthy();
    expect(dirNames.find(d => d.includes('06.3'))).toBeUndefined();

    // Files inside renamed dirs should be renamed
    const dir1Files = await readdir(join(phasesDir, '06.1-hotfix-b'));
    expect(dir1Files.some(f => f.includes('06.1-01'))).toBe(true);
    const dir2Files = await readdir(join(phasesDir, '06.2-hotfix-c'));
    expect(dir2Files.some(f => f.includes('06.2-01'))).toBe(true);
  });

  it('requires --force to remove phase with SUMMARY files', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '07-api'],
    });
    // Create a SUMMARY file to simulate executed work
    await writeFile(join(phasesDir, '06-dashboard', '06-01-SUMMARY.md'), 'summary', 'utf-8');

    await expect(phaseRemove(['6'], tmpDir)).rejects.toThrow('--force');
  });

  it('allows removal with --force even when SUMMARY files exist', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    const phasesDir = join(tmpDir, '.planning', 'phases');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '07-api'],
    });
    await writeFile(join(phasesDir, '06-dashboard', '06-01-SUMMARY.md'), 'summary', 'utf-8');

    const result = await phaseRemove(['6', '--force'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.removed).toBe('6');
    expect(data.directory_deleted).toBeTruthy();
  });

  it('throws GSDError when ROADMAP.md is missing', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    // Set up without ROADMAP.md
    const planningDir = join(tmpDir, '.planning');
    await mkdir(planningDir, { recursive: true });
    const phasesDir = join(planningDir, 'phases');
    await mkdir(phasesDir, { recursive: true });
    await writeFile(join(planningDir, 'STATE.md'), STATE_FOR_REMOVE, 'utf-8');

    await expect(phaseRemove(['6'], tmpDir)).rejects.toThrow('ROADMAP.md not found');
  });

  it('throws GSDError when phase number is missing', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
    });

    await expect(phaseRemove([], tmpDir)).rejects.toThrow('phase number required');
  });

  it('updates ROADMAP.md by removing phase section and renumbering', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '07-api'],
    });

    await phaseRemove(['6'], tmpDir);

    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    // Phase 6 section should be removed
    expect(roadmap).not.toContain('### Phase 6: Dashboard');
    // Phase 7 should be renumbered to 6
    expect(roadmap).toContain('### Phase 6: API');
    // Plan references should be renumbered
    expect(roadmap).toContain('06-01');
    expect(roadmap).not.toContain('07-01');
  });

  it('decrements total_phases in STATE.md frontmatter', async () => {
    const { phaseRemove } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_REMOVE,
      state: STATE_FOR_REMOVE,
      phases: ['05-auth', '06-dashboard', '07-api'],
    });

    await phaseRemove(['6'], tmpDir);

    const stateContent = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // total_phases should be decremented from 7 to 6
    expect(stateContent).toMatch(/total_phases:\s*6/);
  });
});

// ─── phaseComplete ─────────────────────────────────────────────────────────

const ROADMAP_FOR_COMPLETE = `# Roadmap

<details>
<summary>v1.0 (shipped)</summary>

### Phase 1: Old Phase

**Goal:** Shipped already
**Plans:** 2 plans

</details>

## Current Milestone: v3.0 SDK-First Migration

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 9.    | 3/3   | Complete | 2026-04-01 |
| 10.   | 0/3   | In Progress |  |
| 11.   | 0/2   | Not Started |  |

- [x] Phase 9: Foundation (completed 2026-04-01)
- [ ] Phase 10: Read-Only Queries
- [ ] Phase 11: Final Phase

### Phase 9: Foundation

**Goal:** Build foundation
**Requirements**: FOUND-01, FOUND-02
**Depends on:** Phase 8
**Plans:** 3/3 plans complete

Plans:
- [x] 09-01 (Foundation setup)
- [x] 09-02 (Foundation core)
- [x] 09-03 (Foundation tests)

### Phase 10: Read-Only Queries

**Goal:** Port queries
**Requirements**: QUERY-01
**Depends on:** Phase 9
**Plans:** 3 plans

Plans:
- [x] 10-01 (Query setup)
- [x] 10-02 (Query core)
- [ ] 10-03 (Query tests)

### Phase 11: Final Phase

**Goal:** Final work
**Requirements**: FINAL-01
**Depends on:** Phase 10
**Plans:** 2 plans

Plans:
- [ ] 11-01 (Final setup)
- [ ] 11-02 (Final complete)

---
*Last updated: 2026-04-08*
`;

const STATE_FOR_COMPLETE = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 8
  completed_plans: 5
  percent: 33
---

# Project State

## Current Position

Phase: 10 of 3 (Read-Only Queries) — EXECUTING
Plan: 3 of 3
Status: Executing Phase 10
Last activity: 2026-04-08

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: --
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 9 | 3 | - | - |

## Session Continuity

Last session: 2026-04-08T10:00:00.000Z
Stopped at: Completed 10-03-PLAN.md
`;

const REQUIREMENTS_FOR_COMPLETE = `# Requirements

## Checklist

- [x] **FOUND-01** Foundation setup
- [x] **FOUND-02** Foundation core
- [ ] **QUERY-01** Query implementation
- [ ] **FINAL-01** Final work

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 9 | Complete |
| FOUND-02 | Phase 9 | Complete |
| QUERY-01 | Phase 10 | In Progress |
| FINAL-01 | Phase 11 | Pending |
`;

describe('phaseComplete', () => {
  it('marks phase checkbox, updates progress table, and plan count in ROADMAP.md', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    // Create PLAN and SUMMARY files for phase 10
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan1', 'utf-8');
    await writeFile(join(p10Dir, '10-02-PLAN.md'), 'plan2', 'utf-8');
    await writeFile(join(p10Dir, '10-03-PLAN.md'), 'plan3', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary1', 'utf-8');
    await writeFile(join(p10Dir, '10-02-SUMMARY.md'), 'summary2', 'utf-8');
    await writeFile(join(p10Dir, '10-03-SUMMARY.md'), 'summary3', 'utf-8');
    // Create REQUIREMENTS.md
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    const result = await phaseComplete(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.completed_phase).toBe('10');
    expect(data.plans_executed).toBe('3/3');
    expect(data.is_last_phase).toBe(false);
    expect(data.next_phase).toBeTruthy();
    expect(data.roadmap_updated).toBe(true);

    // Check ROADMAP.md updates
    const roadmap = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
    // Checkbox should be marked
    expect(roadmap).toMatch(/\[x\].*Phase 10/);
    // Progress table should show Complete
    expect(roadmap).toMatch(/10\.?\s*\|.*3\/3.*\|.*Complete/i);
    // Plan count in section should be updated
    expect(roadmap).toContain('3/3 plans complete');
    // Plan checkboxes should be [x]
    expect(roadmap).toMatch(/\[x\] 10-01/);
    expect(roadmap).toMatch(/\[x\] 10-02/);
    expect(roadmap).toMatch(/\[x\] 10-03/);
  });

  it('updates REQUIREMENTS.md checkboxes and traceability table', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan1', 'utf-8');
    await writeFile(join(p10Dir, '10-02-PLAN.md'), 'plan2', 'utf-8');
    await writeFile(join(p10Dir, '10-03-PLAN.md'), 'plan3', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary1', 'utf-8');
    await writeFile(join(p10Dir, '10-02-SUMMARY.md'), 'summary2', 'utf-8');
    await writeFile(join(p10Dir, '10-03-SUMMARY.md'), 'summary3', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    await phaseComplete(['10'], tmpDir);

    const req = await readFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), 'utf-8');
    // QUERY-01 checkbox should be marked
    expect(req).toMatch(/\[x\].*\*\*QUERY-01\*\*/);
    // Traceability should show Complete for QUERY-01
    expect(req).toMatch(/QUERY-01\s*\|.*\|\s*Complete\s*\|/);
    // FINAL-01 should remain Pending
    expect(req).toMatch(/FINAL-01\s*\|.*\|\s*Pending\s*\|/);
  });

  it('updates STATE.md fields: current phase, status, completed phases, percent', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-02-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-03-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(p10Dir, '10-02-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(p10Dir, '10-03-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    await phaseComplete(['10'], tmpDir);

    const state = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Phase should advance to 11
    expect(state).toMatch(/Phase:\s*11/);
    // Status should indicate ready to plan
    expect(state).toMatch(/Status:\s*Ready to plan/);
    // Completed phases should be incremented from 1 to 2
    expect(state).toMatch(/completed_phases:\s*2/);
    // Percent should be recalculated (2/3 = 67%)
    expect(state).toMatch(/percent:\s*67/);
  });

  it('detects next phase from filesystem, falls back to ROADMAP.md', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    const result = await phaseComplete(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Next phase should be 11 (from filesystem)
    expect(data.next_phase).toBe('11');
    expect(data.is_last_phase).toBe(false);
  });

  it('sets is_last_phase when completing the final phase', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p11Dir = join(tmpDir, '.planning', 'phases', '11-final-phase');
    await writeFile(join(p11Dir, '11-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p11Dir, '11-01-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    const result = await phaseComplete(['11'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.is_last_phase).toBe(true);
    expect(data.next_phase).toBeNull();

    // State should show milestone complete
    const state = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(state).toMatch(/Status:\s*Milestone complete/);
  });

  it('collects UAT/VERIFICATION warnings without blocking', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary', 'utf-8');
    // Create UAT file with pending status
    await writeFile(join(p10Dir, '10-UAT.md'), '---\nresult: pending\n---\nPending tests', 'utf-8');
    // Create VERIFICATION file with gaps
    await writeFile(join(p10Dir, '10-VERIFICATION.md'), '---\nstatus: gaps_found\n---\nGaps', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    const result = await phaseComplete(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Should complete despite warnings
    expect(data.completed_phase).toBe('10');
    expect(data.has_warnings).toBe(true);
    const warnings = data.warnings as string[];
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some(w => w.includes('pending'))).toBe(true);
    expect(warnings.some(w => w.includes('gaps'))).toBe(true);
  });

  it('throws GSDError for missing phase', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation'],
    });
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    await expect(phaseComplete(['99'], tmpDir)).rejects.toThrow('Phase 99 not found');
  });

  it('updates performance metrics table in STATE.md', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      roadmap: ROADMAP_FOR_COMPLETE,
      state: STATE_FOR_COMPLETE,
      phases: ['09-foundation', '10-read-only-queries', '11-final-phase'],
    });
    const p10Dir = join(tmpDir, '.planning', 'phases', '10-read-only-queries');
    await writeFile(join(p10Dir, '10-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-02-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-03-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(p10Dir, '10-01-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(p10Dir, '10-02-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(p10Dir, '10-03-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(tmpDir, '.planning', 'REQUIREMENTS.md'), REQUIREMENTS_FOR_COMPLETE, 'utf-8');

    await phaseComplete(['10'], tmpDir);

    const state = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    // Total plans completed should be incremented: 3 + 3 = 6
    expect(state).toContain('Total plans completed: 6');
    // By Phase table should have a row for phase 10
    expect(state).toMatch(/\|\s*10\s*\|\s*3\s*\|/);
  });

  it('does not overwrite plan checkbox when **Plans:** is on its own line (regression #2728)', async () => {
    const { phaseComplete } = await import('./phase-lifecycle.js');

    const roadmap = [
      '# Roadmap',
      '',
      '## Current Milestone: v3.0',
      '',
      '- [ ] Phase 7: marketing-landing-v2',
      '',
      '### Phase 7: marketing-landing-v2',
      '',
      '**Goal:** Landing page',
      '**Plans:**',
      '- [x] 07-01-cherry-pick-foundation-PLAN.md — Wave 1',
      '- [x] 07-02-routing-auth-seo-PLAN.md — Wave 2',
      '',
      '### Phase 8: p3-nice-to-haves',
      '',
      '**Goal:** Nice to haves',
      '**Plans:** 3 plans',
      '',
    ].join('\n');

    const state = [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v3.0',
      'status: executing',
      'progress:',
      '  total_phases: 2',
      '  completed_phases: 0',
      '  total_plans: 4',
      '  completed_plans: 2',
      '  percent: 50',
      '---',
      '',
      '# Project State',
      '',
      'Phase: 7 of 2 — EXECUTING',
      'Status: Executing Phase 7',
    ].join('\n');

    await setupTestProject(tmpDir, {
      roadmap,
      state,
      phases: ['07-marketing-landing-v2', '08-p3-nice-to-haves'],
    });

    const p7Dir = join(tmpDir, '.planning', 'phases', '07-marketing-landing-v2');
    await writeFile(join(p7Dir, '07-01-PLAN.md'), 'plan1', 'utf-8');
    await writeFile(join(p7Dir, '07-02-PLAN.md'), 'plan2', 'utf-8');
    await writeFile(join(p7Dir, '07-01-SUMMARY.md'), 'summary1', 'utf-8');
    await writeFile(join(p7Dir, '07-02-SUMMARY.md'), 'summary2', 'utf-8');

    await phaseComplete(['7'], tmpDir);

    const updated = await readFile(join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');

    // The plan lines must NOT be replaced with "N/N plans complete"
    expect(updated).toContain('07-01-cherry-pick-foundation-PLAN.md');
    expect(updated).toContain('07-02-routing-auth-seo-PLAN.md');
    expect(updated).not.toMatch(/^2\/2 plans complete/m);

    // Phase 8's **Plans:** line must NOT be touched
    expect(updated).toContain('**Plans:** 3 plans');
  });
});

// ─── phasesClear ────────────────────────────────────────────────────────────

describe('phasesClear', () => {
  it('throws GSDError without --confirm flag, showing count', async () => {
    const { phasesClear } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries', '999.1-backlog'],
    });

    // Should throw with count of dirs to delete (2, not 3 since 999.1 is excluded)
    await expect(phasesClear([], tmpDir)).rejects.toThrow(/2 phase director/);
  });

  it('deletes all dirs except 999.x with --confirm', async () => {
    const { phasesClear } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries', '999.1-backlog'],
    });

    const result = await phasesClear(['--confirm'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.cleared).toBe(2);

    // Verify filesystem
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirNames = entries.filter(e => e.isDirectory()).map(e => e.name);
    expect(dirNames.length).toBe(1);
    expect(dirNames[0]).toContain('999');
  });

  it('returns 0 cleared when phases dir is empty', async () => {
    const { phasesClear } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, { phases: [] });

    const result = await phasesClear(['--confirm'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.cleared).toBe(0);
  });
});

// ─── phasesArchive ──────────────────────────────────────────────────────────

describe('phasesArchive', () => {
  it('moves milestone phase dirs to milestones/{version}-phases/', async () => {
    const { phasesArchive } = await import('./phase-lifecycle.js');
    await setupTestProject(tmpDir, {
      phases: ['09-foundation', '10-read-only-queries'],
    });

    const result = await phasesArchive(['v3.0'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.version).toBe('v3.0');
    expect((data.archived as number)).toBeGreaterThan(0);

    // Verify archive directory exists
    const archiveDir = join(tmpDir, '.planning', 'milestones', 'v3.0-phases');
    expect(existsSync(archiveDir)).toBe(true);

    // Verify dirs were moved
    const archivedEntries = await readdir(archiveDir, { withFileTypes: true });
    const archivedDirs = archivedEntries.filter(e => e.isDirectory()).map(e => e.name);
    expect(archivedDirs.length).toBeGreaterThan(0);

    // Original dirs should be gone
    const phasesDir = join(tmpDir, '.planning', 'phases');
    const remaining = await readdir(phasesDir, { withFileTypes: true });
    const remainingDirs = remaining.filter(e => e.isDirectory()).map(e => e.name);
    expect(remainingDirs.length).toBe(0);
  });
});

// ─── milestoneComplete help-flag defense (#3259) ────────────────────────────

describe('milestoneComplete help-flag defense', () => {
  it('rejects --help as a version value with GSDError before any disk write', async () => {
    const { milestoneComplete } = await import('./phase-lifecycle.js');
    const { GSDError, ErrorClassification } = await import('../errors.js');
    await setupTestProject(tmpDir);

    // Capture pre-invocation filesystem state
    const planningDir = join(tmpDir, '.planning');
    const milestonesPath = join(planningDir, 'MILESTONES.md');
    const statePath = join(planningDir, 'STATE.md');
    const preStateStat = await import('node:fs').then((m) => m.statSync(statePath));
    const milestonesExistedBefore = existsSync(milestonesPath);

    let thrown: unknown;
    try {
      await milestoneComplete(['--help'], tmpDir);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(GSDError);
    const err = thrown as InstanceType<typeof GSDError>;
    expect(err.classification).toBe(ErrorClassification.Validation);
    expect(err.message).toContain('--help');

    // Assert no files were written
    const postStateStat = await import('node:fs').then((m) => m.statSync(statePath));
    expect(postStateStat.mtimeMs).toBe(preStateStat.mtimeMs);
    expect(existsSync(milestonesPath)).toBe(milestonesExistedBefore);
  });

  it('rejects -h as a version value with GSDError before any disk write', async () => {
    const { milestoneComplete } = await import('./phase-lifecycle.js');
    const { GSDError, ErrorClassification } = await import('../errors.js');
    await setupTestProject(tmpDir);

    const statePath = join(tmpDir, '.planning', 'STATE.md');
    const preStateStat = await import('node:fs').then((m) => m.statSync(statePath));
    const milestonesPath = join(tmpDir, '.planning', 'MILESTONES.md');
    const milestonesExistedBefore = existsSync(milestonesPath);

    let thrown: unknown;
    try {
      await milestoneComplete(['-h'], tmpDir);
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(GSDError);
    const err = thrown as InstanceType<typeof GSDError>;
    expect(err.classification).toBe(ErrorClassification.Validation);
    expect(err.message).toContain('-h');

    // Assert no files were written
    const postStateStat = await import('node:fs').then((m) => m.statSync(statePath));
    expect(postStateStat.mtimeMs).toBe(preStateStat.mtimeMs);
    expect(existsSync(milestonesPath)).toBe(milestonesExistedBefore);
  });
});

// ─── Registry integration ──────────────────────────────────────────────────

describe('lifecycle handlers in registry', () => {
  it('registers all 7 lifecycle handlers with dot notation', async () => {
    const { createRegistry } = await import('./index.js');
    const registry = createRegistry();

    const commands = [
      'phase.add', 'phase.insert', 'phase.remove', 'phase.complete',
      'phase.scaffold', 'phases.clear', 'phases.archive',
    ];

    for (const cmd of commands) {
      const handler = registry.getHandler(cmd);
      expect(handler, `${cmd} should be registered`).toBeDefined();
    }
  });

  it('registers space-delimited aliases', async () => {
    const { createRegistry } = await import('./index.js');
    const registry = createRegistry();

    const commands = [
      'phase add', 'phase insert', 'phase remove', 'phase complete',
      'phase scaffold', 'phases clear', 'phases archive',
    ];

    for (const cmd of commands) {
      const handler = registry.getHandler(cmd);
      expect(handler, `${cmd} should be registered`).toBeDefined();
    }
  });
});
