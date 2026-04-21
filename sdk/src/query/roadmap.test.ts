/**
 * Unit tests for roadmap query handlers.
 *
 * Tests roadmapAnalyze, roadmapGetPhase, getMilestoneInfo,
 * extractCurrentMilestone, and stripShippedMilestones.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// These will be imported once roadmap.ts is created
import {
  roadmapAnalyze,
  roadmapGetPhase,
  getMilestoneInfo,
  extractCurrentMilestone,
  extractNextMilestoneSection,
  extractPhasesFromSection,
  stripShippedMilestones,
} from './roadmap.js';

// ─── Test fixtures ────────────────────────────────────────────────────────

const ROADMAP_CONTENT = `# Roadmap

## Current Milestone: v3.0 SDK-First Migration

**Goal:** Migrate all deterministic orchestration into TypeScript SDK.

- [x] **Phase 9: Foundation and Test Infrastructure**
- [ ] **Phase 10: Read-Only Queries**
- [ ] **Phase 11: Mutations**

### Phase 9: Foundation and Test Infrastructure

**Goal:** Build core SDK infrastructure.

**Depends on:** None

**Success Criteria**:
1. Error classification system exists
2. Query registry works

### Phase 10: Read-Only Queries

**Goal:** Port read-only query operations.

**Depends on:** Phase 9

**Success Criteria**:
1. All read queries work
2. Golden file tests pass

### Phase 11: Mutations

**Goal:** Port mutation operations.

**Depends on:** Phase 10
`;

const STATE_WITH_MILESTONE = `---
gsd_state_version: 1.0
milestone: v3.0
status: executing
---

# Project State

**Current Phase:** 10
**Status:** Ready to execute
`;

// ─── Helpers ──────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'roadmap-test-'));
  await mkdir(join(tmpDir, '.planning', 'phases', '09-foundation'), { recursive: true });
  await mkdir(join(tmpDir, '.planning', 'phases', '10-read-only-queries'), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── stripShippedMilestones ───────────────────────────────────────────────

describe('stripShippedMilestones', () => {
  it('removes <details> blocks', () => {
    const content = 'before\n<details>\nshipped content\n</details>\nafter';
    expect(stripShippedMilestones(content)).toBe('before\n\nafter');
  });

  it('handles multiple <details> blocks', () => {
    const content = '<details>a</details>middle<details>b</details>end';
    expect(stripShippedMilestones(content)).toBe('middleend');
  });

  it('returns content unchanged when no details blocks', () => {
    expect(stripShippedMilestones('no details here')).toBe('no details here');
  });

  // Bug #2496: inline ✅ SHIPPED heading sections must be stripped
  it('strips ## heading sections marked ✅ SHIPPED', () => {
    const content = [
      '## Milestone v1.0: MVP — ✅ SHIPPED 2026-01-15',
      '',
      'Phase 1, Phase 2',
      '',
      '## Milestone v2.0: Current',
      '',
      'Phase 3',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('MVP');
    expect(stripped).not.toContain('v1.0');
    expect(stripped).toContain('v2.0');
    expect(stripped).toContain('Current');
  });

  it('strips multiple inline SHIPPED sections and leaves non-shipped content', () => {
    const content = [
      '## Milestone v1.0: Alpha — ✅ SHIPPED 2026-01-01',
      '',
      'Old content',
      '',
      '## Milestone v1.5: Beta — ✅ SHIPPED 2026-02-01',
      '',
      'More old content',
      '',
      '## Milestone v2.0: Gamma',
      '',
      'Current content',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('Alpha');
    expect(stripped).not.toContain('Beta');
    expect(stripped).toContain('Gamma');
    expect(stripped).toContain('Current content');
  });

  // Bug #2508 follow-up: ### headings must be stripped too
  it('strips ### heading sections marked ✅ SHIPPED', () => {
    const content = [
      '### Milestone v1.0: MVP — ✅ SHIPPED 2026-01-15',
      '',
      'Phase 1, Phase 2',
      '',
      '### Milestone v2.0: Current',
      '',
      'Phase 3',
    ].join('\n');
    const stripped = stripShippedMilestones(content);
    expect(stripped).not.toContain('MVP');
    expect(stripped).not.toContain('v1.0');
    expect(stripped).toContain('v2.0');
    expect(stripped).toContain('Current');
  });
});

// ─── getMilestoneInfo ─────────────────────────────────────────────────────

describe('getMilestoneInfo', () => {
  it('extracts version and name from heading format', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.0');
    expect(info.name).toBe('SDK-First Migration');
  });

  it('extracts from in-progress marker format', async () => {
    const roadmap = '- \u{1F6A7} **v2.1 Belgium** \u2014 Phases 24-28 (in progress)';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.1');
    expect(info.name).toBe('Belgium');
  });

  it('extracts from yellow-circle in-flight marker (GSD ROADMAP template)', async () => {
    const roadmap = '- 🟡 **v3.1 Upstream Landing** — Phase 15 (in flight)';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.1');
    expect(info.name).toBe('Upstream Landing');
  });

  it('uses last **vX.Y Title** in milestone list before ## Phases when no emoji match', async () => {
    const roadmap = `## Milestones

- ✅ **v1.0 A**
- ✅ **v3.0 B**
- ✅ **v3.1 Current Name**

## Phases
`;
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v3.1');
    expect(info.name).toBe('Current Name');
  });

  it('falls back to STATE.md milestone when ROADMAP.md is missing', async () => {
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v4.2\nmilestone_name: From State\n---\n\n# State\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v4.2');
    expect(info.name).toBe('From State');
  });

  it('falls back to v1.0 when ROADMAP.md and STATE.md lack milestone', async () => {
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v1.0');
    expect(info.name).toBe('milestone');
  });

  // Bug #2495: STATE.md must take priority over ROADMAP heading matching
  it('prefers STATE.md milestone over ROADMAP heading match', async () => {
    const roadmap = [
      '## Milestone v1.0: Shipped — ✅ SHIPPED 2026-01-01',
      '',
      'Phase 1',
      '',
      '## Milestone v2.0: Current Active',
      '',
      'Phase 2',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\nmilestone_name: Current Active\n---\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('Current Active');
  });

  // Bug #2508 follow-up: STATE.md has milestone version but no milestone_name —
  // should use ROADMAP for the real name, still prefer STATE.md for version.
  it('uses ROADMAP name when STATE.md has milestone version but no milestone_name', async () => {
    const roadmap = [
      '## Milestone v2.0: Real Name From Roadmap',
      '',
      'Phase 2',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\n---\n',  // no milestone_name
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('Real Name From Roadmap');
  });

  it('returns correct milestone from STATE.md even when ROADMAP inline-SHIPPED stripping would fix it', async () => {
    // ROADMAP with an unstripped shipped milestone heading (pre-fix state)
    const roadmap = [
      '## Milestone v1.0: Old — ✅ SHIPPED 2026-01-01',
      '',
      'Old phases',
      '',
      '## Milestone v2.0: New',
      '',
      'New phases',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0\nmilestone_name: New\n---\n',
    );
    const info = await getMilestoneInfo(tmpDir);
    expect(info.version).toBe('v2.0');
    expect(info.name).toBe('New');
  });
});

// ─── extractCurrentMilestone ──────────────────────────────────────────────

describe('extractCurrentMilestone', () => {
  it('scopes content to current milestone from STATE.md version', async () => {
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    const result = await extractCurrentMilestone(ROADMAP_CONTENT, tmpDir);
    expect(result).toContain('Phase 10');
    expect(result).toContain('v3.0');
  });

  it('strips shipped milestones when no cwd version found', async () => {
    const content = '<details>old</details>current content';
    // No STATE.md, no in-progress marker
    const result = await extractCurrentMilestone(content, tmpDir);
    expect(result).toBe('current content');
  });

  // ─── Bug #2422: preamble Backlog leak ─────────────────────────────────
  it('bug-2422: does not include ## Backlog section before the current milestone', async () => {
    const roadmapWithBacklog = `# ROADMAP

## Backlog
### Phase 999.1: Parking lot item A
### Phase 999.2: Parking lot item B

### 🚧 v2.0 My Milestone (In Progress)
- [ ] **Phase 100: Real work**

## v2.0 Phase Details
### Phase 100: Real work
**Goal**: Do stuff.
`;
    const state = `---\nmilestone: v2.0\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithBacklog);

    const result = await extractCurrentMilestone(roadmapWithBacklog, tmpDir);

    // Must NOT include backlog phases
    expect(result).not.toContain('Phase 999.1');
    expect(result).not.toContain('Phase 999.2');
    expect(result).not.toContain('Parking lot');
    // Must include the actual v2.0 content
    expect(result).toContain('Phase 100');
  });

  // ─── Bug #2422: same-version sub-heading truncation ───────────────────
  it('bug-2422: does not truncate at same-version sub-heading (## v2.0 Phase Details)', async () => {
    const roadmapWithDetails = `# ROADMAP

### 🚧 v2.0 My Milestone (In Progress)
- [ ] **Phase 100: Real work**

## v2.0 Phase Details
### Phase 100: Real work
**Goal**: Do stuff.
`;
    const state = `---\nmilestone: v2.0\n---\n# State\n`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), state);
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithDetails);

    const result = await extractCurrentMilestone(roadmapWithDetails, tmpDir);

    // The detail section must survive — not be cut off
    expect(result).toContain('Phase 100');
    expect(result).toContain('Phase Details');
  });
});

// ─── roadmapGetPhase ──────────────────────────────────────────────────────

describe('roadmapGetPhase', () => {
  it('returns phase info for existing phase', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    const result = await roadmapGetPhase(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(true);
    expect(data.phase_number).toBe('10');
    expect(data.phase_name).toBe('Read-Only Queries');
    expect(data.goal).toBe('Port read-only query operations.');
    expect((data.success_criteria as string[]).length).toBe(2);
    expect(data.section).toContain('### Phase 10');
  });

  it('returns { found: false } for nonexistent phase', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);
    const result = await roadmapGetPhase(['999'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
    expect(data.phase_number).toBe('999');
  });

  it('throws GSDError when no phase number provided', async () => {
    await expect(roadmapGetPhase([], tmpDir)).rejects.toThrow();
  });

  it('handles malformed roadmap (checklist-only, no detail section)', async () => {
    const malformed = `# Roadmap\n\n- [ ] **Phase 99: Missing Detail**\n`;
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), malformed);
    const result = await roadmapGetPhase(['99'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('malformed_roadmap');
    expect(data.phase_name).toBe('Missing Detail');
  });

  it('returns error object when ROADMAP.md not found', async () => {
    const result = await roadmapGetPhase(['10'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.found).toBe(false);
    expect(data.error).toBe('ROADMAP.md not found');
  });
});

// ─── roadmapAnalyze ───────────────────────────────────────────────────────

describe('roadmapAnalyze', () => {
  it('returns full analysis for valid roadmap', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    // Create some plan/summary files for disk correlation
    await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-PLAN.md'), '---\n---\n');
    await writeFile(join(tmpDir, '.planning', 'phases', '09-foundation', '09-01-SUMMARY.md'), '---\n---\n');
    await writeFile(join(tmpDir, '.planning', 'phases', '10-read-only-queries', '10-01-PLAN.md'), '---\n---\n');

    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.phase_count).toBe(3);
    expect((data.phases as Array<Record<string, unknown>>).length).toBe(3);

    const phases = data.phases as Array<Record<string, unknown>>;
    // Phase 9 has 1 plan, 1 summary => complete (or roadmap checkbox says complete)
    const p9 = phases.find(p => p.number === '9');
    expect(p9).toBeDefined();
    expect(p9!.name).toBe('Foundation and Test Infrastructure');
    expect(p9!.roadmap_complete).toBe(true); // [x] in checklist

    // Phase 10 has 1 plan, 0 summaries => planned
    const p10 = phases.find(p => p.number === '10');
    expect(p10).toBeDefined();
    expect(p10!.disk_status).toBe('planned');
    expect(p10!.plan_count).toBe(1);

    // Phase 11 has no directory content
    const p11 = phases.find(p => p.number === '11');
    expect(p11).toBeDefined();
    expect(p11!.disk_status).toBe('no_directory');

    expect(data.total_plans).toBeGreaterThan(0);
    expect(typeof data.progress_percent).toBe('number');
  });

  it('returns error when ROADMAP.md not found', async () => {
    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBe('ROADMAP.md not found');
  });

  it('overrides disk_status to complete when roadmap checkbox is checked', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    // Phase 9 dir is empty (no plans/summaries) but roadmap has [x]
    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const phases = data.phases as Array<Record<string, unknown>>;
    const p9 = phases.find(p => p.number === '9');
    expect(p9!.disk_status).toBe('complete');
    expect(p9!.roadmap_complete).toBe(true);
  });

  it('detects missing phase details from checklist', async () => {
    const roadmapWithExtra = ROADMAP_CONTENT + '\n- [ ] **Phase 99: Future Phase**\n';
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmapWithExtra);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    const result = await roadmapAnalyze([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.missing_phase_details).toContain('99');
  });

  it('handles repeated calls correctly (no lastIndex bug)', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), ROADMAP_CONTENT);
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), STATE_WITH_MILESTONE);

    const result1 = await roadmapAnalyze([], tmpDir);
    const result2 = await roadmapAnalyze([], tmpDir);
    const data1 = result1.data as Record<string, unknown>;
    const data2 = result2.data as Record<string, unknown>;

    expect((data1.phases as unknown[]).length).toBe((data2.phases as unknown[]).length);
  });
});

// ─── extractPhasesFromSection + extractNextMilestoneSection (#2497) ──────

describe('extractPhasesFromSection', () => {
  it('parses phase number, name, goal, and depends_on from a milestone section', () => {
    const section = [
      '',
      '### Phase 31: Email Schema',
      '**Goal**: Set up Prisma models.',
      '**Depends on**: None',
      '',
      '### Phase 32: Today\'s Sheets',
      '**Goal**: Port the GAS sender.',
      '**Depends on**: Phase 31',
      '',
    ].join('\n');
    const phases = extractPhasesFromSection(section);
    expect(phases).toEqual([
      { number: '31', name: 'Email Schema', goal: 'Set up Prisma models.', depends_on: 'None' },
      { number: '32', name: "Today's Sheets", goal: 'Port the GAS sender.', depends_on: 'Phase 31' },
    ]);
  });

  it('returns empty array when section has no phase headings', () => {
    expect(extractPhasesFromSection('no phases here\njust prose.')).toEqual([]);
  });
});

describe('extractNextMilestoneSection', () => {
  const MULTI = [
    '# Roadmap',
    '',
    '## Milestone v1.0: Old — ✅ SHIPPED 2026-01-01',
    '',
    'Shipped stuff.',
    '',
    '## Milestone v2.0.5: Current Milestone',
    '',
    '### Phase 35: Audit',
    '**Goal**: Audit schemas.',
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

  it('returns the milestone immediately after the active one (STATE-driven)', async () => {
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), MULTI);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0.5\nmilestone_name: Current Milestone\n---\n',
    );
    const next = await extractNextMilestoneSection(MULTI, tmpDir);
    expect(next).not.toBeNull();
    expect(next!.version).toBe('v2.1');
    expect(next!.name).toBe('Daily Emails');
    // Phases parse correctly from the returned section — only v2.1 phases,
    // not v2.2's Phase 99.
    const phases = extractPhasesFromSection(next!.section).map(p => p.number);
    expect(phases).toEqual(['31', '32']);
  });

  it('returns null when the active milestone is the last one in ROADMAP', async () => {
    const roadmap = [
      '# Roadmap',
      '',
      '## Milestone v2.0.5: Last One',
      '',
      '### Phase 35: Final',
      '**Goal**: Final work.',
    ].join('\n');
    await writeFile(join(tmpDir, '.planning', 'ROADMAP.md'), roadmap);
    await writeFile(
      join(tmpDir, '.planning', 'STATE.md'),
      '---\nmilestone: v2.0.5\n---\n',
    );
    const next = await extractNextMilestoneSection(roadmap, tmpDir);
    expect(next).toBeNull();
  });

  it('returns null when no current milestone can be resolved', async () => {
    const next = await extractNextMilestoneSection('# Roadmap\nno milestones\n', tmpDir);
    expect(next).toBeNull();
  });
});
