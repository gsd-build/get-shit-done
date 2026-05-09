/**
 * Unit tests for state query handlers.
 *
 * Tests stateJson, stateGet, and stateSnapshot handlers.
 * Uses temp directories with real .planning/ structures.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Will be imported once implemented
import { stateJson, stateGet, stateSnapshot } from './state.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const STATE_BODY = `# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-07)

**Core value:** Improve the project.
**Current focus:** Phase 10

## Current Position

Phase: 10 (Read-Only Queries) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last Activity: 2026-04-08
Last Activity Description: Completed plan 01

Progress: [████░░░░░░] 40%

## Decisions Made

Recent decisions affecting current work:

| Phase | Summary | Rationale |
|-------|---------|-----------|
| 09 | Used GSDError pattern | Consistent with existing SDK errors |
| 10 | Temp dir test pattern | ESM spy limitations |

## Blockers

- STATE.md parsing edge cases need audit
- Verification rule inventory needs review

## Session

Last session: 2026-04-08T05:00:00Z
Stopped At: Completed 10-01-PLAN.md
Resume File: None
`;

const STATE_WITH_FRONTMATTER = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
stopped_at: Completed 10-01-PLAN.md
last_updated: "2026-04-08T05:01:21.919Z"
---

${STATE_BODY}`;

const ROADMAP_CONTENT = `# Roadmap

## Roadmap v3.0: SDK-First Migration

### Phase 09: Foundation
- Build infrastructure

### Phase 10: Read-Only Queries
- Port state queries

### Phase 11: Mutations
- Port write operations
`;

let tmpDir: string;

// ─── Setup / Teardown ──────────────────────────────────────────────────────

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-test-'));
  const planningDir = join(tmpDir, '.planning');
  const phasesDir = join(planningDir, 'phases');

  // Create .planning structure
  await mkdir(phasesDir, { recursive: true });

  // Create STATE.md with frontmatter
  await writeFile(join(planningDir, 'STATE.md'), STATE_WITH_FRONTMATTER);

  // Create ROADMAP.md
  await writeFile(join(planningDir, 'ROADMAP.md'), ROADMAP_CONTENT);

  // Create config.json
  await writeFile(join(planningDir, 'config.json'), JSON.stringify({
    model_profile: 'quality',
    workflow: { auto_advance: true },
  }));

  // Create phase directories with plans and summaries
  const phase09 = join(phasesDir, '09-foundation');
  await mkdir(phase09, { recursive: true });
  await writeFile(join(phase09, '09-01-PLAN.md'), '---\nphase: 09\nplan: 01\n---\nPlan 1');
  await writeFile(join(phase09, '09-01-SUMMARY.md'), 'Summary 1');
  await writeFile(join(phase09, '09-02-PLAN.md'), '---\nphase: 09\nplan: 02\n---\nPlan 2');
  await writeFile(join(phase09, '09-02-SUMMARY.md'), 'Summary 2');
  await writeFile(join(phase09, '09-03-PLAN.md'), '---\nphase: 09\nplan: 03\n---\nPlan 3');
  await writeFile(join(phase09, '09-03-SUMMARY.md'), 'Summary 3');

  const phase10 = join(phasesDir, '10-read-only-queries');
  await mkdir(phase10, { recursive: true });
  await writeFile(join(phase10, '10-01-PLAN.md'), '---\nphase: 10\nplan: 01\n---\nPlan 1');
  await writeFile(join(phase10, '10-01-SUMMARY.md'), 'Summary 1');
  await writeFile(join(phase10, '10-02-PLAN.md'), '---\nphase: 10\nplan: 02\n---\nPlan 2');
  await writeFile(join(phase10, '10-03-PLAN.md'), '---\nphase: 10\nplan: 03\n---\nPlan 3');

  const phase11 = join(phasesDir, '11-mutations');
  await mkdir(phase11, { recursive: true });
  await writeFile(join(phase11, '11-01-PLAN.md'), '---\nphase: 11\nplan: 01\n---\nPlan 1');
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── stateJson (state json / state.json) ───────────────────────────────────

describe('stateJson', () => {
  it('rebuilds frontmatter from body + disk', async () => {
    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.gsd_state_version).toBe('1.0');
    expect(data.milestone).toBe('v3.0');
    expect(data.milestone_name).toBe('SDK-First Migration');
    expect(data.status).toBe('executing');
    expect(data.last_updated).toBeDefined();
  });

  it('returns progress with disk-scanned counts', async () => {
    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const progress = data.progress as Record<string, unknown>;

    // 3 phases in roadmap (09, 10, 11), 7 total plans, 4 summaries
    expect(progress.total_phases).toBe(3);
    expect(progress.total_plans).toBe(7);
    expect(progress.completed_plans).toBe(4);
    // Phase 09 complete (3/3), phase 10 incomplete (1/3), phase 11 incomplete (0/1)
    expect(progress.completed_phases).toBe(1);
    // min(plan fraction 4/7, phase fraction 1/3) = 33%
    expect(progress.percent).toBe(33);
  });

  it('preserves wider curated progress when disk scan only sees a realized subset', async () => {
    const stateContent = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
progress:
  total_phases: 12
  completed_phases: 6
  total_plans: 22
  completed_plans: 22
  percent: 50
---

${STATE_BODY}`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const progress = data.progress as Record<string, unknown>;

    expect(progress.total_phases).toBe(12);
    expect(progress.completed_phases).toBe(6);
    expect(progress.total_plans).toBe(22);
    expect(progress.completed_plans).toBe(22);
    expect(progress.percent).toBe(50);
  });

  it('preserves stopped_at from existing frontmatter', async () => {
    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.stopped_at).toBe('Completed 10-01-PLAN.md');
  });

  it('preserves existing non-unknown status when body-derived is unknown', async () => {
    // Create STATE.md with frontmatter status but no Status in body
    const stateContent = `---
gsd_state_version: 1.0
status: paused
---

# Project State

Phase: 10
Plan: 2 of 3
`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;

    // Body has no Status field -> derived is 'unknown', should preserve frontmatter 'paused'
    expect(data.status).toBe('paused');
  });

  it('returns error object when STATE.md not found', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'gsd-state-empty-'));
    await mkdir(join(emptyDir, '.planning'), { recursive: true });

    const result = await stateJson([], emptyDir);
    const data = result.data as Record<string, unknown>;

    expect(data.error).toBe('STATE.md not found');
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('normalizes status to known values', async () => {
    const stateContent = `---
gsd_state_version: 1.0
---

# Project State

Status: In Progress
`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.status).toBe('executing');
  });

  it('derives percent from disk counts (ground truth)', async () => {
    // Body says 0% but disk has 4/7 summaries
    const stateContent = `---
gsd_state_version: 1.0
---

# Project State

Status: Ready to execute
Progress: [░░░░░░░░░░] 0%
`;
    await writeFile(join(tmpDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateJson([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const progress = data.progress as Record<string, unknown>;

    // Disk should override the body's 0%; phase fraction caps plan-only progress.
    expect(progress.percent).toBe(33);
  });
});

// ─── stateGet ──────────────────────────────────────────────────────────────

describe('stateGet', () => {
  it('returns full content when no field specified', async () => {
    const result = await stateGet([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.content).toBeDefined();
    expect(typeof data.content).toBe('string');
    expect((data.content as string)).toContain('# Project State');
  });

  it('extracts bold-format field', async () => {
    const result = await stateGet(['Core value'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data['Core value']).toBe('Improve the project.');
  });

  it('extracts plain-format field', async () => {
    const result = await stateGet(['Plan'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data['Plan']).toBe('2 of 3');
  });

  it('extracts section content under ## heading', async () => {
    const result = await stateGet(['Current Position'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data['Current Position']).toBeDefined();
    expect((data['Current Position'] as string)).toContain('Phase: 10');
  });

  it('returns error for missing field', async () => {
    const result = await stateGet(['Nonexistent Field'], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.error).toBe('Section or field "Nonexistent Field" not found');
  });
});

// ─── stateSnapshot ─────────────────────────────────────────────────────────

describe('stateSnapshot', () => {
  it('returns structured snapshot', async () => {
    const result = await stateSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;

    expect(data.current_phase).toBeDefined();
    // Status field in body is "Ready to execute" but frontmatter has "executing"
    // stateSnapshot reads full content and matches "status: executing" from frontmatter first
    expect(data.status).toBeDefined();
  });

  it('parses decisions table into array', async () => {
    const result = await stateSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const decisions = data.decisions as Array<Record<string, string>>;

    expect(Array.isArray(decisions)).toBe(true);
    expect(decisions.length).toBe(2);
    expect(decisions[0].phase).toBe('09');
    expect(decisions[0].summary).toBe('Used GSDError pattern');
    expect(decisions[0].rationale).toBe('Consistent with existing SDK errors');
  });

  it('parses blockers list', async () => {
    const result = await stateSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const blockers = data.blockers as string[];

    expect(Array.isArray(blockers)).toBe(true);
    expect(blockers.length).toBe(2);
    expect(blockers[0]).toContain('STATE.md parsing edge cases');
  });

  it('parses session info', async () => {
    const result = await stateSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;
    const session = data.session as Record<string, string | null>;

    expect(session).toBeDefined();
    expect(session.stopped_at).toBe('Completed 10-01-PLAN.md');
  });

  it('returns error when STATE.md not found', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'gsd-snap-empty-'));
    await mkdir(join(emptyDir, '.planning'), { recursive: true });

    const result = await stateSnapshot([], emptyDir);
    const data = result.data as Record<string, unknown>;

    expect(data.error).toBe('STATE.md not found');
    await rm(emptyDir, { recursive: true, force: true });
  });

  it('returns numeric fields as numbers', async () => {
    const result = await stateSnapshot([], tmpDir);
    const data = result.data as Record<string, unknown>;

    // progress_percent may be null if no Progress: N% format found
    // but total_phases etc. should be numbers when present
    if (data.total_phases !== null) {
      expect(typeof data.total_phases).toBe('number');
    }
  });
});

// ─── Regression: #3265 — frontmatter wins over bold-body cell ─────────────

describe('stateSnapshot — bug #3265 frontmatter precedence', () => {
  it('returns frontmatter status, not **Status:** value embedded in a body table cell', async () => {
    // Reproduce the collision: frontmatter says "executing", but the body
    // contains a Markdown table cell with "**Status:** to ✅ COMPLETE ..."
    // which stateExtractField (bold pattern) would match before the YAML line.
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'status: executing',
      'current_plan: 19.5-05',
      '---',
      '',
      '# Project State',
      '',
      '## Recent Quick Tasks',
      '',
      '| Date | Task | Notes |',
      '|------|------|-------|',
      '| 2026-05-01 | Reopened Plan 19.5-05. **Status:** to ✅ COMPLETE | done |',
      '',
      '**Current Phase:** 19',
      '**Current Plan:** archived-lane',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3265-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    // Frontmatter status must win
    expect(data.status).toBe('executing');

    await rm(localDir, { recursive: true, force: true });
  });

  it('returns frontmatter current_plan, not bold body value when both present', async () => {
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'status: executing',
      'current_plan: 19.5-05',
      '---',
      '',
      '# Project State',
      '',
      '**Current Phase:** 19',
      '**Current Plan:** archived-lane',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3265b-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    // Frontmatter current_plan must win over body bold value
    expect(data.current_plan).toBe('19.5-05');

    await rm(localDir, { recursive: true, force: true });
  });

  it('falls back to body extraction when no frontmatter block is present', async () => {
    const stateContent = [
      '# Project State',
      '',
      '**Current Phase:** 07',
      '**Status:** paused',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3265c-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    // No frontmatter — body extraction must still work
    expect(data.status).toBe('paused');
    expect(data.current_phase).toBe('07');

    await rm(localDir, { recursive: true, force: true });
  });

  it('falls back to body extractor for a field absent from frontmatter', async () => {
    // Frontmatter has status but no current_plan — snapshot must body-extract current_plan
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'status: planning',
      '---',
      '',
      '# Project State',
      '',
      '**Current Plan:** 05-03',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3265d-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    expect(data.status).toBe('planning');
    // current_plan absent from frontmatter — must come from body
    expect(data.current_plan).toBe('05-03');

    await rm(localDir, { recursive: true, force: true });
  });
});

// ─── Regression: --ws propagation (#2618 gap 1) ────────────────────────────

describe('stateJson with --ws workstream', () => {
  it('reads STATE.md from .planning/workstreams/<name>/ when workstream is provided', async () => {
    // Build a workstream-scoped layout alongside the default .planning/STATE.md
    const wsName = 'example-ws';
    const wsDir = join(tmpDir, '.planning', 'workstreams', wsName);
    await mkdir(join(wsDir, 'phases'), { recursive: true });

    const wsState = `---
gsd_state_version: 1.0
milestone: ws-1.0
milestone_name: Workstream Marker
status: planning
---

# Project State

Status: planning
`;
    await writeFile(join(wsDir, 'STATE.md'), wsState);
    await writeFile(join(wsDir, 'ROADMAP.md'), '# Roadmap\n');

    // Root STATE.md still has the old values (SDK-First Migration).
    // When --ws is threaded, stateJson must read the workstream STATE.md, not the root.
    const result = await stateJson([], tmpDir, wsName);
    const data = result.data as Record<string, unknown>;

    expect(data.milestone).toBe('ws-1.0');
    expect(data.milestone_name).toBe('Workstream Marker');
    expect(data.status).toBe('planning');
  });
});

// ─── Regression: #3275 CR — fmScalar handles numeric/boolean YAML scalars ───

describe('stateSnapshot — CR #3275 fmScalar non-string scalar coercion', () => {
  it('treats numeric current_phase as string "19", not missing', async () => {
    // A real YAML parser (e.g. js-yaml) would parse `current_phase: 19` as
    // the number 19, not the string "19".  fmScalar must coerce it so the
    // frontmatter value wins over the body's bold field.
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'current_phase: 19',
      '---',
      '',
      '# Project State',
      '',
      '**Current Phase:** 03',
      '**Status:** executing',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3275a-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    // Frontmatter wins: current_phase must be "19", not "03" (from body)
    expect(data.current_phase).toBe('19');

    await rm(localDir, { recursive: true, force: true });
  });

  it('treats numeric total_phases in frontmatter as string, not missing', async () => {
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'total_phases: 7',
      '---',
      '',
      '# Project State',
      '',
      '**Total Phases:** 3',
      '**Status:** executing',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3275b-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    // total_phases is parsed as int downstream: frontmatter 7 must win over body 3
    expect(data.total_phases).toBe(7);

    await rm(localDir, { recursive: true, force: true });
  });

  it('treats numeric total_plans_in_phase in frontmatter as string, not missing', async () => {
    const stateContent = [
      '---',
      'gsd_state_version: 1.0',
      'total_plans_in_phase: 5',
      '---',
      '',
      '# Project State',
      '',
      '**Total Plans in Phase:** 2',
      '**Status:** executing',
      '',
    ].join('\n');

    const localDir = await mkdtemp(join(tmpdir(), 'gsd-3275c-'));
    await mkdir(join(localDir, '.planning'), { recursive: true });
    await writeFile(join(localDir, '.planning', 'STATE.md'), stateContent);

    const result = await stateSnapshot([], localDir);
    const data = result.data as Record<string, unknown>;

    expect(data.total_plans_in_phase).toBe(5);

    await rm(localDir, { recursive: true, force: true });
  });
});
