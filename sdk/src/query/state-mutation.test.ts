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
