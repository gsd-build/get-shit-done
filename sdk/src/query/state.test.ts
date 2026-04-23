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
    // 4/7 = 57%
    expect(progress.percent).toBe(57);
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

    // Disk should override the body's 0%
    expect(progress.percent).toBe(57);
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
