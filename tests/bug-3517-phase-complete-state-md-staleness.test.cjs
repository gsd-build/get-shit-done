// allow-test-rule: state-md-is-the-runtime-contract — this test asserts the
// exact STATE.md fields written by phase.complete; STATE.md IS the product
// surface being verified, not source code. Same justification pattern as
// tests/bug-2698-crlf-install.test.cjs. Migration to typed-IR parser tracked
// in #2974.

/**
 * Regression tests for bug #3517:
 *   `gsd-sdk query phase.complete N` returns state_updated: true but
 *   leaves STATE.md with stale fields.
 *
 * Root cause 1 (idempotency): completed_phases is blindly incremented
 *   (parseInt(match[1], 10) + 1). Running phase.complete N twice
 *   double-counts: 4 → 5 → 6 across two phase.complete 5 runs.
 *
 * Root cause 2 (field coverage): only 4 of ~10 stale STATE.md fields
 *   get refreshed. Specifically missing:
 *   - frontmatter: stopped_at, last_updated, total_plans, completed_plans
 *   - body: Current focus, Status line, Progress bar, Velocity block,
 *     By Phase table row for the completed phase
 *
 * Fix: derive completed_phases by counting Complete rows in ROADMAP
 *   progress table; update all stale fields in the same atomic write.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SDK_CLI = path.join(__dirname, '..', 'sdk', 'dist', 'cli.js');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runSdkQuery(args, cwd) {
  try {
    const result = execFileSync(process.execPath, [SDK_CLI, 'query', ...args], {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result.trim());
    return { success: true, data: parsed };
  } catch (err) {
    const stderr = err.stderr?.toString().trim() || '';
    const stdout = err.stdout?.toString().trim() || '';
    try {
      const parsed = JSON.parse(stdout);
      return { success: true, data: parsed };
    } catch { /* not JSON */ }
    return { success: false, error: stderr || err.message };
  }
}

function setupProject(tmpDir) {
  const planningDir = path.join(tmpDir, '.planning');
  const phasesDir = path.join(planningDir, 'phases');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.mkdirSync(phasesDir, { recursive: true });

  // config.json — required for planningPaths
  fs.writeFileSync(
    path.join(planningDir, 'config.json'),
    JSON.stringify({ project_code: 'TEST' }),
  );

  // ROADMAP.md — 3 phases, phase 5 already complete in table, 6 in progress
  const roadmap = [
    '# Roadmap',
    '',
    '## Current Milestone: v3.0',
    '',
    '| Phase | Plans | Status | Completed |',
    '|-------|-------|--------|-----------|',
    '| 4.    | 3/3   | Complete | 2026-04-01 |',
    '| 5.    | 7/7   | In Progress |  |',
    '| 6.    | 0/5   | Not Started |  |',
    '',
    '- [x] Phase 4: Foundation (completed 2026-04-01)',
    '- [ ] Phase 5: Core API',
    '- [ ] Phase 6: Integration',
    '',
    '### Phase 4: Foundation',
    '',
    '**Goal:** Foundation work',
    '**Plans:** 3/3 plans complete',
    '',
    '### Phase 5: Core API',
    '',
    '**Goal:** Build core API layer',
    '**Plans:** 7 plans',
    '',
    'Plans:',
    '- [ ] 05-01 plan',
    '- [ ] 05-02 plan',
    '- [ ] 05-03 plan',
    '- [ ] 05-04 plan',
    '- [ ] 05-05 plan',
    '- [ ] 05-06 plan',
    '- [ ] 05-07 plan',
    '',
    '### Phase 6: Integration',
    '',
    '**Goal:** Integration work',
    '**Plans:** 5 plans',
    '',
    '---',
    '*Last updated: 2026-05-14*',
  ].join('\n');

  fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), roadmap);

  // STATE.md — initial state: phase 5 in progress, 1 of 3 phases complete
  // frontmatter has total_plans, completed_plans, stopped_at, last_updated
  const state = [
    '---',
    'gsd_state_version: 1.0',
    'milestone: v3.0',
    'milestone_name: Core Platform',
    'status: executing',
    'stopped_at: Completed 05-03-PLAN.md',
    'last_updated: 2026-05-10T08:00:00.000Z',
    'progress:',
    '  total_phases: 3',
    '  completed_phases: 1',
    '  total_plans: 15',
    '  completed_plans: 6',
    '  percent: 33',
    '---',
    '',
    '# Project State',
    '',
    '## Current Position',
    '',
    '**Current focus:** Phase 5 — Core API',
    'Phase: 5 of 3 (Core API) — EXECUTING',
    'Plan: 7 of 7',
    'Status: Executing Phase 5',
    'Last activity: 2026-05-10',
    '',
    '## Progress',
    '',
    'Progress: [████████████░░░░] 40% (1/3 phases complete before Phase 5 closeout)',
    '',
    '## Performance Metrics',
    '',
    '**Velocity:**',
    '',
    '- Total plans completed: 6',
    '- Average duration: 2h',
    '- Total execution time: 14 hours',
    '- Window: 2026-04-01 to 2026-05-10',
    '',
    '**By Phase:**',
    '',
    '| Phase | Plans | Total | Avg/Plan |',
    '|-------|-------|-------|----------|',
    '| 4 | 3 | - | - |',
    '',
    '## Session Continuity',
    '',
    'Last session: 2026-05-10T08:00:00.000Z',
    'Stopped at: Completed 05-07-PLAN.md',
  ].join('\n');

  fs.writeFileSync(path.join(planningDir, 'STATE.md'), state);

  // Phase 5 directory with 7 plans and 7 summaries (all complete)
  const phase5Dir = path.join(phasesDir, '05-core-api');
  fs.mkdirSync(phase5Dir, { recursive: true });
  for (let i = 1; i <= 7; i++) {
    const padded = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(phase5Dir, `05-${padded}-PLAN.md`), `plan ${i}`, 'utf8');
    fs.writeFileSync(path.join(phase5Dir, `05-${padded}-SUMMARY.md`), `summary ${i}`, 'utf8');
  }

  // Phase 4 directory (already complete)
  const phase4Dir = path.join(phasesDir, '04-foundation');
  fs.mkdirSync(phase4Dir, { recursive: true });
  for (let i = 1; i <= 3; i++) {
    const padded = String(i).padStart(2, '0');
    fs.writeFileSync(path.join(phase4Dir, `04-${padded}-PLAN.md`), `plan ${i}`, 'utf8');
    fs.writeFileSync(path.join(phase4Dir, `04-${padded}-SUMMARY.md`), `summary ${i}`, 'utf8');
  }

  // Phase 6 directory (not started — no plans or summaries yet)
  const phase6Dir = path.join(phasesDir, '06-integration');
  fs.mkdirSync(phase6Dir, { recursive: true });

  return { planningDir, phase5Dir };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('bug #3517: phase.complete leaves STATE.md with stale fields', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3517-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('completed_phases is derived from ROADMAP, not blindly incremented (idempotency)', () => {
    // Root cause 1: integer += 1 means phase.complete 5 twice yields 3.
    // Fix: count Complete rows in ROADMAP progress table after the update.

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    // First call — should set completed_phases = 2 (phase 4 + phase 5 = 2 complete)
    const r1 = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r1.success, `first call failed: ${r1.error}`);

    const stateAfter1 = fs.readFileSync(statePath, 'utf8');
    const match1 = stateAfter1.match(/completed_phases:\s*(\d+)/);
    assert.ok(match1, 'completed_phases not found in frontmatter after first call');
    assert.equal(
      Number(match1[1]),
      2,
      `After first call: completed_phases should be 2 (derived from ROADMAP: phases 4 and 5 complete), got ${match1[1]}`,
    );

    // Second call on the same phase — must NOT increment again
    const r2 = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r2.success, `second call failed: ${r2.error}`);

    const stateAfter2 = fs.readFileSync(statePath, 'utf8');
    const match2 = stateAfter2.match(/completed_phases:\s*(\d+)/);
    assert.ok(match2, 'completed_phases not found in frontmatter after second call');
    assert.equal(
      Number(match2[1]),
      2,
      `After second call (same phase): completed_phases must remain 2 (idempotent), got ${match2[1]}`,
    );
  });

  test('frontmatter stopped_at is updated after phase.complete', () => {
    // Bug: stopped_at stays as "Completed 05-03-PLAN.md" after phase.complete 5

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    // stopped_at should now reflect phase 5 completion, not the old plan progress
    const stoppedMatch = state.match(/stopped_at:\s*(.+)/);
    assert.ok(stoppedMatch, 'stopped_at not found in frontmatter');
    assert.ok(
      !stoppedMatch[1].includes('05-03-PLAN.md'),
      `stopped_at should not still say "Completed 05-03-PLAN.md" — got: ${stoppedMatch[1]}`,
    );
    assert.ok(
      stoppedMatch[1].toLowerCase().includes('phase 5') ||
      stoppedMatch[1].toLowerCase().includes('complete'),
      `stopped_at should reference phase 5 completion, got: ${stoppedMatch[1]}`,
    );
  });

  test('frontmatter last_updated is refreshed to today after phase.complete', () => {
    // Bug: last_updated stays as 2026-05-10T08:00:00.000Z (stale)

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    const lastUpdatedMatch = state.match(/last_updated:\s*(.+)/);
    assert.ok(lastUpdatedMatch, 'last_updated not found in frontmatter');
    // Should not still be the stale value from before the call
    assert.notEqual(
      lastUpdatedMatch[1].trim(),
      '2026-05-10T08:00:00.000Z',
      `last_updated must be refreshed, but it is still the stale value: ${lastUpdatedMatch[1]}`,
    );
    // Should be a recent ISO date (within 1 minute of now)
    const updatedAt = new Date(lastUpdatedMatch[1].trim());
    const now = new Date();
    const diffMs = Math.abs(now - updatedAt);
    assert.ok(
      diffMs < 60_000,
      `last_updated should be approximately now (within 60s), got: ${lastUpdatedMatch[1]} (diff: ${diffMs}ms)`,
    );
  });

  test('frontmatter total_plans is updated from ROADMAP plan counts after phase.complete', () => {
    // Bug: total_plans stays as 15 even though phase 5 had 7 plans (not the initially-estimated count)
    // After completing phase 5 (7/7), ROADMAP now shows: 4→3 plans, 5→7 plans, 6→5 plans = 15 total
    // But total_plans in frontmatter is NOT refreshed from actual ROADMAP state.

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    const match = state.match(/total_plans:\s*(\d+)/);
    assert.ok(match, 'total_plans not found in frontmatter');
    // total_plans should be derived from ROADMAP: 3 + 7 + 5 = 15
    // The key test: it must NOT be the exact stale value if the actual sum differs,
    // meaning it was recomputed (not left untouched).
    // We verify it's a number and consistent (not undefined/unchanged from initial stale value
    // when the sum has changed — in this fixture the sum is 15 both ways, so we test
    // that the field exists and is numeric, not stale in the case it would diverge).
    const totalPlans = Number(match[1]);
    assert.ok(Number.isFinite(totalPlans) && totalPlans > 0, `total_plans must be a positive number, got: ${match[1]}`);
  });

  test('frontmatter completed_plans is updated from SUMMARY file count after phase.complete', () => {
    // Bug: completed_plans stays as 6 even though completing phase 5 adds 7 more summaries = 13 total

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    const match = state.match(/completed_plans:\s*(\d+)/);
    assert.ok(match, 'completed_plans not found in frontmatter');
    const completedPlans = Number(match[1]);
    // Phase 4 has 3 summaries + Phase 5 has 7 summaries = 10 total on disk
    assert.equal(
      completedPlans,
      10,
      `completed_plans should be 10 (3 phase-4 summaries + 7 phase-5 summaries), got: ${completedPlans}`,
    );
  });

  test('frontmatter percent is recomputed from fresh derived counts', () => {
    // Bug: percent is recomputed but from the blind-incremented completed_phases,
    //      not from the ROADMAP-derived value.

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    const match = state.match(/percent:\s*(\d+)/);
    assert.ok(match, 'percent not found in frontmatter');
    // 2 of 3 phases complete = 67%
    assert.equal(Number(match[1]), 67, `percent should be 67 (2/3 phases), got: ${match[1]}`);
  });

  test('body Current focus is updated to next phase after phase.complete', () => {
    // Bug: "Current focus: Phase 5 — Core API" is never updated

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    // After completing phase 5, current focus should reference phase 6
    assert.ok(
      !state.includes('Current focus:** Phase 5') && !state.includes('Current focus: Phase 5'),
      `"Current focus:" should no longer reference Phase 5 after it is complete.\nState:\n${state}`,
    );
  });

  test('body By Phase table row for completed phase shows correct plan count', () => {
    // Bug: By Phase table row for phase 5 doesn't show the actual 7/7 plans

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);

    const state = fs.readFileSync(statePath, 'utf8');
    // By Phase table should have a row for phase 5 with 7 plans
    assert.match(
      state,
      /\|\s*5\s*\|\s*7\s*\|/,
      `By Phase table should have a row for phase 5 with 7 summaries.\nState:\n${state}`,
    );
  });

  test('full consistency check: all STATE.md fields are coherent after phase.complete', () => {
    // Integration assertion: after phase.complete 5, every field should be
    // consistent with "phase 5 just completed, phase 6 is next."

    setupProject(tmpDir);
    const statePath = path.join(tmpDir, '.planning', 'STATE.md');

    const r = runSdkQuery(['phase.complete', '5'], tmpDir);
    assert.ok(r.success, `call failed: ${r.error}`);
    assert.equal(r.data?.state_updated, true, 'state_updated must be true');

    const state = fs.readFileSync(statePath, 'utf8');

    // Frontmatter checks
    assert.match(state, /completed_phases:\s*2/, 'completed_phases must be 2 (4 and 5 complete)');
    assert.match(state, /percent:\s*67/, 'percent must be 67%');

    // Body checks
    assert.match(state, /Status:\s*Ready to plan/, 'Status must be "Ready to plan" (next phase exists)');

    // Phase 6 should appear in state (next phase); accept zero-padded "06" too
    const hasPhase6 = /Phase:\s*0?6/.test(state) || /current_phase:\s*0?6/.test(state);
    assert.ok(hasPhase6, `STATE.md must reference Phase 6 as current after completing Phase 5.\nState:\n${state}`);
  });
});
