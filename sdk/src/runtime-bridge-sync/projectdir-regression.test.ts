/**
 * Regression test for the Phase 5.0 worker bug: projectDir and workstream were
 * dropped from RuntimeBridgeExecuteInput before being forwarded to
 * registry.dispatch(). The worker constructed a module-scoped
 * QueryNativeDirectAdapter with a hardcoded projectDir='' — meaning any handler
 * that reads .planning/ (e.g. state.*) would either fail silently or read from
 * the process CWD rather than the requested project directory.
 *
 * Fix (Phase 5.1): the adapter is now constructed per-request inside
 * dispatchNative so request.projectDir and request.workstream close over the
 * correct values.
 *
 * These tests must:
 * - FAIL against the unfixed worker (projectDir='', handler sees wrong dir).
 * - PASS against the fixed worker (projectDir threaded correctly).
 *
 * NOTE: executeForCjs uses a compiled dist/ worker (see index.ts comments).
 * The tests here call executeForCjs, which requires the worker to be rebuilt
 * before the fix is observable. Run `npm run build` in sdk/ first.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { executeForCjs } from './index.js';

// ─── Fixture STATE.md with parseable frontmatter ──────────────────────────

const FIXTURE_STATE = `---
gsd_state_version: 1.0
milestone: v9.1
milestone_name: Regression Test Milestone
status: executing
---

# Project State

## Current Position

Phase: 9 (Regression Tests) — EXECUTING
Plan: 1 of 2
Status: Executing Phase 9
Last activity: 2026-05-15 -- Regression test started

Progress: [█████░░░░░] 50%
`;

// ─── Helpers ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeAll(async () => {
  tmpDir = join(
    tmpdir(),
    `gsd-projectdir-regression-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await mkdir(join(tmpDir, '.planning'), { recursive: true });
  await writeFile(join(tmpDir, '.planning', 'STATE.md'), FIXTURE_STATE, 'utf-8');
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('executeForCjs projectDir regression (Phase 5.0 bug)', () => {
  it('threads projectDir to the handler: state.json returns frontmatter data from the tmpdir fixture', () => {
    // This test FAILS against the unfixed worker because projectDir='' causes
    // the handler to look for .planning/STATE.md relative to '' (process CWD),
    // which does not have a STATE.md fixture. The handler returns { error: 'STATE.md not found' }.
    //
    // With the fix, projectDir=tmpDir is forwarded and the handler reads the fixture.
    const result = executeForCjs({
      registryCommand: 'state.json',
      registryArgs: [],
      legacyCommand: 'state',
      legacyArgs: ['json'],
      mode: 'json',
      projectDir: tmpDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return; // narrow for TS

    const data = result.data as Record<string, unknown>;

    // The handler should have found the fixture and returned parsed frontmatter.
    // Key assertions: these fields come from FIXTURE_STATE and are absent from
    // any STATE.md that might exist at ''.
    expect(data).not.toHaveProperty('error');
    expect(data.milestone).toBe('v9.1');
    expect(data.milestone_name).toBe('Regression Test Milestone');
    expect(data.status).toBe('executing');
  });

  it('negative: nonexistent projectDir returns ok:true with {error} (handler-level not-found)', () => {
    // A completely nonexistent directory: handler cannot find .planning/STATE.md
    // and returns a structured error payload rather than throwing. This is the
    // expected "soft failure" shape for state.json on a missing project.
    const result = executeForCjs({
      registryCommand: 'state.json',
      registryArgs: [],
      legacyCommand: 'state',
      legacyArgs: ['json'],
      mode: 'json',
      projectDir: '/nonexistent-gsd-project-regression-test-dir',
    });

    // The handler returns { data: { error: 'STATE.md not found' } } — ok:true
    // because it is a domain-level not-found, not a dispatch error.
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const data = result.data as Record<string, unknown>;
    expect(data).toHaveProperty('error');
    expect(String(data.error)).toMatch(/STATE\.md not found/i);
  });

  it('workstream support: GSDTransport routes workstream requests natively (Phase 6 fix)', () => {
    // Phase 6 fix: GSDTransport no longer forces subprocess for workstream-scoped
    // requests. The worker's dispatchNative closure (Phase 5.1 fix) correctly
    // threads request.workstream through to registry.dispatch(), so native handlers
    // route to the workstream-scoped .planning/workstreams/<ws>/ directory.
    //
    // The workstream 'some-workstream' has no separate STATE.md in tmpDir/
    // .planning/workstreams/some-workstream/, so the handler returns a domain-level
    // "not found" error (ok:true with {error:...}) — exactly like the nonexistent
    // projectDir case. This confirms native dispatch was used (subprocess would
    // have returned ok:false / errorKind).
    const result = executeForCjs({
      registryCommand: 'state.json',
      registryArgs: [],
      legacyCommand: 'state',
      legacyArgs: ['json'],
      mode: 'json',
      projectDir: tmpDir,
      workstream: 'some-workstream',
    });

    // Native dispatch used → ok:true (handler-level not-found, not a dispatch error).
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as Record<string, unknown>;
    // Domain-level not-found: workstream's STATE.md doesn't exist in the fixture.
    expect(data).toHaveProperty('error');
    expect(String(data.error)).toMatch(/STATE\.md not found/i);
  });
});
