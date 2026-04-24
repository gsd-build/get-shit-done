/**
 * Unit tests for STATE.md mutation handlers.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';

// ─── Helpers (internal) ─────────────────────────────────────────────────────

/** Minimal STATE.md for testing. */
const MINIMAL_STATE = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
---

# Project State

## Project Reference

**Core value:** Test project

## Current Position

Phase: 10 (Read-Only Queries) — EXECUTING
Plan: 2 of 3
Status: Executing Phase 10
Last activity: 2026-04-08 -- Phase 10 execution started

Progress: [░░░░░░░░░░] 50%

## Performance Metrics

**Velocity:**

| Phase | Duration | Tasks | Files |
|-------|----------|-------|-------|

## Accumulated Context

### Decisions

None yet.

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-04-07T10:00:00.000Z
Stopped at: Completed 10-02-PLAN.md
Resume file: None
`;

/** Create a minimal .planning directory for testing. */
async function setupTestProject(tmpDir: string, stateContent?: string): Promise<string> {
  const planningDir = join(tmpDir, '.planning');
  await mkdir(planningDir, { recursive: true });
  await mkdir(join(planningDir, 'phases'), { recursive: true });
  await writeFile(join(planningDir, 'STATE.md'), stateContent || MINIMAL_STATE, 'utf-8');
  // Minimal ROADMAP.md for buildStateFrontmatter
  await writeFile(join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## Current Milestone: v3.0 SDK-First Migration\n\n### Phase 10: Read-Only Queries\n\nGoal: Port queries.\n', 'utf-8');
  await writeFile(join(planningDir, 'config.json'), '{"model_profile":"balanced"}', 'utf-8');
  return tmpDir;
}

// ─── Import tests ───────────────────────────────────────────────────────────

describe('state-mutation imports', () => {
  it('exports stateUpdate handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateUpdate).toBe('function');
  });

  it('exports statePatch handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.statePatch).toBe('function');
  });

  it('exports stateBeginPhase handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateBeginPhase).toBe('function');
  });

  it('exports stateAdvancePlan handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateAdvancePlan).toBe('function');
  });

  it('exports stateRecordMetric handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateRecordMetric).toBe('function');
  });

  it('exports stateUpdateProgress handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateUpdateProgress).toBe('function');
  });

  it('exports stateAddDecision handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateAddDecision).toBe('function');
  });

  it('exports stateAddBlocker handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateAddBlocker).toBe('function');
  });

  it('exports stateResolveBlocker handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateResolveBlocker).toBe('function');
  });

  it('exports stateRecordSession handler', async () => {
    const mod = await import('./state-mutation.js');
    expect(typeof mod.stateRecordSession).toBe('function');
  });
});

// ─── stateReplaceField ──────────────────────────────────────────────────────

describe('stateReplaceField', () => {
  it('replaces bold format field', async () => {
    const { stateReplaceField } = await import('./state-mutation.js');
    const content = '**Status:** executing\n**Plan:** 1';
    const result = stateReplaceField(content, 'Status', 'done');
    expect(result).toContain('**Status:** done');
  });

  it('replaces plain format field', async () => {
    const { stateReplaceField } = await import('./state-mutation.js');
    const content = 'Status: executing\nPlan: 1';
    const result = stateReplaceField(content, 'Status', 'done');
    expect(result).toContain('Status: done');
  });

  it('returns null when field not found', async () => {
    const { stateReplaceField } = await import('./state-mutation.js');
    const result = stateReplaceField('no fields here', 'Missing', 'value');
    expect(result).toBeNull();
  });

  it('is case-insensitive', async () => {
    const { stateReplaceField } = await import('./state-mutation.js');
    const content = '**status:** executing';
    const result = stateReplaceField(content, 'Status', 'done');
    expect(result).toContain('done');
  });
});

// ─── acquireStateLock / releaseStateLock ─────────────────────────────────────

describe('acquireStateLock / releaseStateLock', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-lock-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('creates and removes lockfile', async () => {
    const { acquireStateLock, releaseStateLock } = await import('./state-mutation.js');
    const statePath = join(tmpDir, 'STATE.md');
    await writeFile(statePath, 'test', 'utf-8');

    const lockPath = await acquireStateLock(statePath);
    expect(existsSync(lockPath)).toBe(true);

    await releaseStateLock(lockPath);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('tracks lockPath in _heldStateLocks on acquire and removes on release', async () => {
    const { acquireStateLock, releaseStateLock, _heldStateLocks } = await import('./state-mutation.js');
    const statePath = join(tmpDir, 'STATE.md');
    await writeFile(statePath, 'test', 'utf-8');

    const lockPath = await acquireStateLock(statePath);
    expect(_heldStateLocks.has(lockPath)).toBe(true);

    await releaseStateLock(lockPath);
    expect(_heldStateLocks.has(lockPath)).toBe(false);
  });

  it('returns lockPath on non-EEXIST errors instead of throwing', async () => {
    // Simulate a non-EEXIST error by using a path in a non-existent directory
    // This triggers ENOENT (not EEXIST), which should return lockPath gracefully
    const { acquireStateLock } = await import('./state-mutation.js');
    const badPath = join(tmpDir, 'nonexistent-dir', 'subdir', 'STATE.md');

    // Should NOT throw — should return lockPath gracefully
    const lockPath = await acquireStateLock(badPath);
    expect(lockPath).toBe(badPath + '.lock');
  });
});

// ─── stateUpdate ────────────────────────────────────────────────────────────

describe('stateUpdate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-update-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('updates a single field and round-trips through stateLoad', async () => {
    const { stateUpdate } = await import('./state-mutation.js');
    const { stateJson } = await import('./state.js');

    const result = await stateUpdate(['Status', 'Phase complete'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.updated).toBe(true);

    // Verify round-trip
    const loaded = await stateJson([], tmpDir);
    const loadedData = loaded.data as Record<string, unknown>;
    // Status gets normalized by buildStateFrontmatter
    expect(loadedData.status).toBeTruthy();
  });

  it('returns updated false when field not found', async () => {
    const { stateUpdate } = await import('./state-mutation.js');

    const result = await stateUpdate(['NonExistentField', 'value'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.updated).toBe(false);
  });

  it('throws on missing args', async () => {
    const { stateUpdate } = await import('./state-mutation.js');

    await expect(stateUpdate([], tmpDir)).rejects.toThrow(/field and value required/);
  });
});

// ─── statePatch ─────────────────────────────────────────────────────────────

describe('statePatch', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-patch-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('updates multiple fields in one lock cycle', async () => {
    const { statePatch } = await import('./state-mutation.js');

    const patches = JSON.stringify({ Status: 'done', Progress: '100%' });
    const result = await statePatch([patches], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect((data.updated as string[]).length).toBeGreaterThan(0);

    // Verify file was updated
    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toContain('done');
  });
});

// ─── stateBeginPhase ────────────────────────────────────────────────────────

describe('stateBeginPhase', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-begin-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('sets all expected fields', async () => {
    const { stateBeginPhase } = await import('./state-mutation.js');

    const result = await stateBeginPhase(['11', 'State Mutations', '3'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase).toBe('11');

    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toContain('Executing Phase 11');
    expect(content).toContain('State Mutations');
  });

  // ─── Bug #2420: flag-form args not parsed ────────────────────────────
  it('bug-2420: parses --phase/--name/--plans flag-form args correctly', async () => {
    const { stateBeginPhase } = await import('./state-mutation.js');

    // This is how execute-phase.md calls it: flag form
    const result = await stateBeginPhase(
      ['--phase', '99', '--name', 'probe-test', '--plans', '1'],
      tmpDir
    );
    const data = result.data as Record<string, unknown>;

    // Must return the actual values, not the flag names
    expect(data.phase).toBe('99');
    expect(data.name).toBe('probe-test');
    expect(data.plan_count).toBe(1);

    // STATE.md must contain clean output, not literal "--phase"
    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).not.toContain('--phase');
    expect(content).not.toContain('--name');
    expect(content).not.toContain('--plans');
    expect(content).toContain('Executing Phase 99');
    expect(content).toContain('probe-test');
  });

  it('bug-2420: positional args still work after flag-parsing fix', async () => {
    const { stateBeginPhase } = await import('./state-mutation.js');

    const result = await stateBeginPhase(['42', 'Positional Test', '5'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase).toBe('42');
    expect(data.name).toBe('Positional Test');
    expect(data.plan_count).toBe(5);
  });

  it('bug-2420: flag parser throws when a flag value is missing (next token is a flag)', async () => {
    const { stateBeginPhase } = await import('./state-mutation.js');

    // --phase has no value — next token is --name, which is itself a flag.
    await expect(
      stateBeginPhase(['--phase', '--name', 'Title', '--plans', '1'], tmpDir)
    ).rejects.toThrow('missing value for --phase');
  });

  it('does not treat argv after named flags as positional name/plans', async () => {
    const { stateBeginPhase } = await import('./state-mutation.js');

    const result = await stateBeginPhase(['--phase', '2', '--plans', '3'], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.phase).toBe('2');
    expect(data.phase_name).toBeFalsy();
    expect(data.plan_count).toBe(3);

    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toContain('Plan: 1 of 3');
  });
});

// ─── stateAdvancePlan ───────────────────────────────────────────────────────

describe('stateAdvancePlan', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-advance-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('increments plan counter', async () => {
    const { stateAdvancePlan } = await import('./state-mutation.js');

    const result = await stateAdvancePlan([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.advanced).toBe(true);
    expect(data.current_plan).toBe(3);
  });
});

// ─── stateAddDecision ───────────────────────────────────────────────────────

describe('stateAddDecision', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-decision-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('appends decision and removes placeholder', async () => {
    const { stateAddDecision } = await import('./state-mutation.js');

    const result = await stateAddDecision(
      ['--phase', '10', '--summary', 'Use lockfile atomicity'],
      tmpDir,
    );
    const data = result.data as Record<string, unknown>;
    expect(data.added).toBe(true);

    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toContain('Use lockfile atomicity');
    // Verify "None yet." was removed from the Decisions section specifically
    const decisionsMatch = content.match(/###?\s*Decisions\s*\n([\s\S]*?)(?=\n###?|\n##[^#]|$)/i);
    expect(decisionsMatch).not.toBeNull();
    expect(decisionsMatch![1]).not.toContain('None yet.');
  });
});

// ─── stateRecordSession ─────────────────────────────────────────────────────

describe('stateRecordSession', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-session-'));
    await setupTestProject(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('updates session fields', async () => {
    const { stateRecordSession } = await import('./state-mutation.js');

    const result = await stateRecordSession(
      ['--stopped-at', 'Completed 11-01-PLAN.md', '--resume-file', 'None'],
      tmpDir,
    );
    const data = result.data as Record<string, unknown>;
    expect(data.recorded).toBe(true);

    const content = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    expect(content).toContain('Completed 11-01-PLAN.md');
  });
});

// ─── Bug #2613: write-side frontmatter preservation ─────────────────────────

describe('Bug #2613: STATE.md frontmatter preservation through mutations', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-state-2613-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('record-session preserves milestone + milestone_name when ROADMAP has a different current milestone', async () => {
    // STATE.md declares v12.0 / Focus (shipped). ROADMAP's heading-parseable
    // current is v11.0 / Research-Depth. Before the fix, re-derivation pulled
    // v11.0 / Research-Depth into STATE.md's frontmatter on every mutation.
    const stateContent = `---
gsd_state_version: 1.0
milestone: v12.0
milestone_name: Focus
status: shipped
---

# Project State

## Session Continuity

Last session: 2026-04-20T00:00:00Z
Stopped at: v12.0 SHIPPED
Resume file: None
`;
    const roadmapContent = `# Roadmap

## Phases

## v11.0 Research-Depth Scoring (In Progress)

### Phase 55
- stuff

## v12.0 Focus — ✅ SHIPPED 2026-04-20

### Phase 60
- shipped stuff
`;
    const planningDir = join(tmpDir, '.planning');
    await mkdir(join(planningDir, 'phases'), { recursive: true });
    await writeFile(join(planningDir, 'STATE.md'), stateContent, 'utf-8');
    await writeFile(join(planningDir, 'ROADMAP.md'), roadmapContent, 'utf-8');
    await writeFile(join(planningDir, 'config.json'), '{}', 'utf-8');

    const { stateRecordSession } = await import('./state-mutation.js');
    await stateRecordSession(
      ['--stopped-at', 'regression test', '--resume-file', '.planning/MILESTONES.md'],
      tmpDir,
    );

    const after = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);
    expect(fm.milestone).toBe('v12.0');
    expect(fm.milestone_name).toBe('Focus');
  });

  it('record-session preserves status from existing frontmatter when body has no Status field', async () => {
    // STATE.md frontmatter declares status: shipped. Body has no "Status:" line.
    // Before the fix, derived status defaulted to 'unknown' and the frontmatter
    // value was lost because existingFm was {} at the preservation branch.
    const stateContent = `---
gsd_state_version: 1.0
milestone: v12.0
milestone_name: Focus
status: shipped
---

# Project State

## Session Continuity

Last session: 2026-04-20T00:00:00Z
Stopped at: v12.0 SHIPPED
Resume file: None
`;
    const planningDir = join(tmpDir, '.planning');
    await mkdir(join(planningDir, 'phases'), { recursive: true });
    await writeFile(join(planningDir, 'STATE.md'), stateContent, 'utf-8');
    await writeFile(join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## v12.0 Focus\n', 'utf-8');
    await writeFile(join(planningDir, 'config.json'), '{}', 'utf-8');

    const { stateRecordSession } = await import('./state-mutation.js');
    await stateRecordSession(
      ['--stopped-at', 'regression test', '--resume-file', 'None'],
      tmpDir,
    );

    const after = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);
    expect(fm.status).toBe('shipped');
  });

  it('record-session preserves progress from frontmatter when disk scan returns zero counts', async () => {
    // Shipped milestone: phase directories have been archived, so disk scan
    // returns total_plans=0. Existing frontmatter has authoritative counts
    // (5/5, 12/12, 100%). Before the fix, disk scan stomped the counts to 0/0.
    const stateContent = `---
gsd_state_version: 1.0
milestone: v12.0
milestone_name: Focus
status: shipped
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Session Continuity

Last session: 2026-04-20T00:00:00Z
Stopped at: v12.0 SHIPPED
Resume file: None
`;
    const planningDir = join(tmpDir, '.planning');
    await mkdir(join(planningDir, 'phases'), { recursive: true });
    await writeFile(join(planningDir, 'STATE.md'), stateContent, 'utf-8');
    await writeFile(join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n## v12.0 Focus\n', 'utf-8');
    await writeFile(join(planningDir, 'config.json'), '{}', 'utf-8');

    const { stateRecordSession } = await import('./state-mutation.js');
    await stateRecordSession(
      ['--stopped-at', 'regression test', '--resume-file', 'None'],
      tmpDir,
    );

    const after = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);
    const progress = fm.progress as Record<string, unknown>;
    expect(Number(progress.total_plans)).toBe(12);
    expect(Number(progress.completed_plans)).toBe(12);
    expect(Number(progress.percent)).toBe(100);
  });

  it('regression guard: state.update Status still updates frontmatter status when body is mutated', async () => {
    // Legitimate status change must still propagate. If the body's Status
    // field becomes "executing", derived status is 'executing' and option 2
    // must NOT overwrite it with the frontmatter's prior 'shipped'.
    await setupTestProject(tmpDir);

    const { stateUpdate } = await import('./state-mutation.js');
    await stateUpdate(['Status', 'executing'], tmpDir);

    const after = await readFile(join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);
    expect(fm.status).toBe('executing');
  });

  it('regression guard: disk-scanned progress wins when scan returns non-zero counts', async () => {
    // Mid-milestone: disk has real phase directories with plans + summaries.
    // Disk is the ground truth — frontmatter progress must not override it.
    const stateContent = `---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: SDK-First Migration
status: executing
progress:
  total_phases: 99
  completed_phases: 99
  total_plans: 99
  completed_plans: 99
  percent: 99
---

# Project State

## Current Position

Status: Executing
Last activity: today

## Session Continuity

Last session: 2026-04-08T05:00:00Z
Stopped at: work
Resume file: None
`;
    const planningDir = join(tmpDir, '.planning');
    const phasesDir = join(planningDir, 'phases');
    await mkdir(phasesDir, { recursive: true });
    // Real phase with 1 plan and 1 summary — disk scan must report these.
    const phase10 = join(phasesDir, '10-foo');
    await mkdir(phase10, { recursive: true });
    await writeFile(join(phase10, '10-01-PLAN.md'), 'plan', 'utf-8');
    await writeFile(join(phase10, '10-01-SUMMARY.md'), 'summary', 'utf-8');
    await writeFile(join(planningDir, 'STATE.md'), stateContent, 'utf-8');
    await writeFile(join(planningDir, 'ROADMAP.md'), '# Roadmap\n\n### Phase 10: Foo\n', 'utf-8');
    await writeFile(join(planningDir, 'config.json'), '{}', 'utf-8');

    const { stateRecordSession } = await import('./state-mutation.js');
    await stateRecordSession(['--stopped-at', 'x', '--resume-file', 'None'], tmpDir);

    const after = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);
    const progress = fm.progress as Record<string, unknown>;
    // Disk ground truth — not the stale 99/99 from frontmatter.
    expect(Number(progress.total_plans)).toBe(1);
    expect(Number(progress.completed_plans)).toBe(1);
    expect(Number(progress.percent)).toBe(100);
  });
});

// ─── stateMilestoneSwitch (#2630) ──────────────────────────────────────────

describe('stateMilestoneSwitch', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'gsd-milestone-switch-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes milestone/milestone_name/status into STATE.md frontmatter and resets progress on milestone switch', async () => {
    // Previous milestone shipped: STATE.md frontmatter points at v1.0 with
    // non-zero progress. ROADMAP.md now advertises the NEW milestone v1.1.
    // Regardless of what getMilestoneInfo derives from the old STATE.md
    // frontmatter, a milestone switch must stomp the frontmatter with the new
    // version/name and reset progress counters.
    const stateContent = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Foundation
status: completed
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Current Position

Phase: 5 (Foundation) — COMPLETED
Plan: 3 of 3
Status: v1.0 milestone complete
Last activity: 2026-04-20 -- v1.0 shipped

## Accumulated Context

### Decisions

- [Phase 1]: Use Node 20
`;
    const planningDir = join(tmpDir, '.planning');
    await mkdir(join(planningDir, 'phases'), { recursive: true });
    await writeFile(join(planningDir, 'STATE.md'), stateContent, 'utf-8');
    // ROADMAP advertises the new milestone
    await writeFile(
      join(planningDir, 'ROADMAP.md'),
      '# Roadmap\n\n## v1.1 Notifications\n\n### Phase 6: Notify\n',
      'utf-8',
    );
    await writeFile(join(planningDir, 'config.json'), '{}', 'utf-8');

    const { stateMilestoneSwitch } = await import('./state-mutation.js');
    const result = await stateMilestoneSwitch(
      ['--milestone', 'v1.1', '--name', 'Notifications'],
      tmpDir,
    );

    const data = result.data as Record<string, unknown>;
    expect(data.switched).toBe(true);
    expect(data.version).toBe('v1.1');
    expect(data.name).toBe('Notifications');

    const after = await readFile(join(planningDir, 'STATE.md'), 'utf-8');
    const { extractFrontmatter } = await import('./frontmatter.js');
    const fm = extractFrontmatter(after);

    // The heart of #2630 — frontmatter must reflect the NEW milestone.
    expect(fm.milestone).toBe('v1.1');
    expect(fm.milestone_name).toBe('Notifications');
    // Status resets to planning (Defining requirements phase).
    expect(fm.status).toBe('planning');
    // Progress counters reset for the new milestone (no phases executed yet).
    const progress = fm.progress as Record<string, unknown> | undefined;
    if (progress) {
      expect(Number(progress.completed_phases ?? 0)).toBe(0);
      expect(Number(progress.completed_plans ?? 0)).toBe(0);
      expect(Number(progress.percent ?? 0)).toBe(0);
    }

    // Accumulated Context is preserved across the milestone switch.
    expect(after).toContain('[Phase 1]: Use Node 20');

    // Current Position body is reset to the new milestone's starting state.
    expect(after).toMatch(/Status:\s*Defining requirements/);
  });

  it('rejects missing --milestone', async () => {
    await writeFile(join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8').catch(async () => {
      await mkdir(join(tmpDir, '.planning'), { recursive: true });
      await writeFile(join(tmpDir, '.planning', 'config.json'), '{}', 'utf-8');
    });
    const { stateMilestoneSwitch } = await import('./state-mutation.js');
    const result = await stateMilestoneSwitch([], tmpDir);
    const data = result.data as Record<string, unknown>;
    expect(data.error).toBeDefined();
  });
});
