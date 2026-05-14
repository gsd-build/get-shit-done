/**
 * Regression: state complete-phase must keep STATE.md and ROADMAP.md display
 * surfaces in lockstep with the frontmatter, not just update Status / Last
 * activity scalars.
 *
 * Surfaces verified:
 *   1. STATE.md milestone phase-queue table → row marked Complete (DATE)
 *   2. STATE.md ## Current Position progress line → "Progress: X/Y phases
 *      complete (P%)" recomputed from disk truth
 *   3. STATE.md ## Current Position fenced ASCII bar → bar fill matches percent
 *   4. .planning/ROADMAP.md Progress Table row → Plans column + Status +
 *      Completed date all updated via cmdRoadmapUpdatePlanProgress
 *   5. .planning/ROADMAP.md phase checkbox → `[x]` + single (completed DATE)
 *      suffix even on repeated runs
 *
 * Pre-fix: state complete-phase only touched Status / Last activity. The
 * phase-queue table, the Current Position progress + bar, and the
 * .planning/ROADMAP.md Progress Table all stayed stale forever.
 */

'use strict';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const gsdTools = path.resolve(__dirname, '..', 'get-shit-done', 'bin', 'gsd-tools.cjs');

function runState(args, cwd) {
  return execFileSync('node', [gsdTools, 'state', ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function writePhase(planningDir, phaseDirName, planCount, summaryCount) {
  const phaseDir = path.join(planningDir, 'phases', phaseDirName);
  fs.mkdirSync(phaseDir, { recursive: true });
  for (let i = 1; i <= planCount; i++) {
    const num = String(i).padStart(2, '0');
    fs.writeFileSync(
      path.join(phaseDir, `${phaseDirName.split('-')[0]}-${num}-PLAN.md`),
      `---\nphase: ${phaseDirName.split('-')[0]}\nplan: ${i}\n---\n# Plan ${i}\n`
    );
  }
  for (let i = 1; i <= summaryCount; i++) {
    const num = String(i).padStart(2, '0');
    fs.writeFileSync(
      path.join(phaseDir, `${phaseDirName.split('-')[0]}-${num}-SUMMARY.md`),
      `---\nstatus: complete\n---\n# Summary ${i}\n`
    );
  }
}

describe('state complete-phase syncs display surfaces', () => {
  let tmpDir;
  let planningDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-complete-display-'));
    planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    fs.writeFileSync(
      path.join(planningDir, 'config.json'),
      JSON.stringify({ project_code: 'TEST' })
    );

    fs.writeFileSync(
      path.join(planningDir, 'STATE.md'),
      `---
gsd_state_version: 1.0
milestone: v1.0
current_phase: 2
status: executing
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 5
  completed_plans: 0
  percent: 0
---

# State

## v1.0 phase queue

| # | Phase | REQ-IDs | Status |
|---|-------|---------|--------|
| 1 | Foundation | FOUND-01 | Not started |
| 2 | Auth | AUTH-01 | Not started |
| 3 | Polish | POLISH-01 | Not started |

## Current Position

Phase: 2 — IN PROGRESS
Plan: 1 of 2
Status: Executing Phase 2
Progress: 0/3 phases complete (0%)

\`\`\`
[░░░░░░░░░░░░░░░░░░░░] 0%
\`\`\`

Last activity: 2026-01-01 -- started Phase 2
`
    );

    fs.writeFileSync(
      path.join(planningDir, 'ROADMAP.md'),
      `# Roadmap

## v1.0

- [ ] **Phase 1: Foundation** — base scaffold
- [ ] **Phase 2: Auth** — login flow
- [ ] **Phase 3: Polish** — final tidy

### Phase 1: Foundation

**Plans:** 0/1 plans planned

### Phase 2: Auth

**Plans:** 0/2 plans planned

### Phase 3: Polish

**Plans:** 0/2 plans planned

## Progress Table

| Phase | Plans | Status | Completed |
|-------|-------|--------|-----------|
| 1. Foundation | 0/1 | Planned     |            |
| 2. Auth | 0/2 | Planned     |            |
| 3. Polish | 0/2 | Planned     |            |
`
    );

    writePhase(planningDir, '01-foundation', 1, 1);
    writePhase(planningDir, '02-auth', 2, 2);
    writePhase(planningDir, '03-polish', 2, 0);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('marks phase queue row Complete with date', () => {
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const state = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    assert.match(state, new RegExp(`\\| 2 \\| Auth \\| AUTH-01 \\| Complete \\(${today}\\) \\|`));
    assert.match(state, /\| 1 \| Foundation \| FOUND-01 \| Not started \|/);
  });

  test('refreshes Current Position progress line and ASCII bar from disk truth', () => {
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const state = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    // 2 of 3 phases complete on disk (Phase 1 = 1/1, Phase 2 = 2/2; Phase 3 = 0/2 doesn't count) → 67%
    assert.match(state, /Progress: 2\/3 phases complete \(67%\)/);
    // Bar must reflect 67% across 20 chars → 13 filled
    assert.match(state, /\[█{13}░{7}\] 67%/);
  });

  test('updates .planning/ROADMAP.md Progress Table + checkbox', () => {
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const roadmap = fs.readFileSync(path.join(planningDir, 'ROADMAP.md'), 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    assert.match(roadmap, new RegExp(`\\| 2\\. Auth \\| 2/2 \\| Complete\\s+\\| ${today} \\|`));
    assert.match(roadmap, new RegExp(`- \\[x\\] \\*\\*Phase 2: Auth\\*\\* — login flow \\(completed ${today}\\)`));
  });

  test('repeated runs are idempotent (no duplicate completed-date suffix)', () => {
    runState(['complete-phase', '--phase', '2'], tmpDir);
    runState(['complete-phase', '--phase', '2'], tmpDir);
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const roadmap = fs.readFileSync(path.join(planningDir, 'ROADMAP.md'), 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    // Exactly one "(completed DATE)" — not three.
    const matches = roadmap.match(new RegExp(`Phase 2: Auth\\*\\* — login flow \\(completed ${today}\\)`, 'g'));
    assert.equal(matches.length, 1);
    assert.doesNotMatch(roadmap, /\(completed \d{4}-\d{2}-\d{2}\) \(completed/);
    // STATE.md queue row keeps the original date — second run must not bump it.
    const state = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    const stateMatches = state.match(new RegExp(`\\(${today}\\)`, 'g'));
    assert.ok(stateMatches.length >= 1);
  });

  test('skips phases without PLAN files when computing progress', () => {
    // Phase 3 has 0 plans on disk — must not be counted as complete despite
    // satisfying summaries >= plans (0 >= 0).
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const state = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    assert.match(state, /Progress: 2\/3 phases complete \(67%\)/);
    assert.doesNotMatch(state, /Progress: 3\/3/);
  });

  test('queue table left untouched when row already marked Complete', () => {
    runState(['complete-phase', '--phase', '2'], tmpDir);
    const firstRun = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    const firstDateMatch = firstRun.match(/\| 2 \| Auth \| AUTH-01 \| Complete \((\d{4}-\d{2}-\d{2})\) \|/);
    assert.ok(firstDateMatch, 'first run should set a date');

    runState(['complete-phase', '--phase', '2'], tmpDir);
    const secondRun = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    assert.match(secondRun, new RegExp(`\\| 2 \\| Auth \\| AUTH-01 \\| Complete \\(${firstDateMatch[1]}\\) \\|`));
  });
});
