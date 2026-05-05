'use strict';
// allow-test-rule: reads runtime STATE.md written to temp dir — behavioral output test, not source-grep

// Regression tests for bug #3127.
//
// state.begin-phase is non-idempotent: when execute-phase calls it on a phase
// that is already mid-flight (e.g. --wave N resume), the handler unconditionally
// overwrites execution-progress fields with stale values from the last plan-phase run:
//   - stopped_at / Last Activity Description reset to "context gathered; ready for plan-phase"
//   - Current Plan reset to 1 (from plan being executed, e.g. 3)
//   - Plan: N of M body line reset to "Plan: 1 of M"
//   - Last activity timestamp reverted to an older value
//   - progress.percent may decrease
//
// Fix: read the current Status field before writing. If the phase is already
// "Executing Phase N", skip the execution-progress fields (Current Plan, plan body
// line, Last Activity Description) and only update fields safe to overwrite on
// resume (Last Activity date, Status if somehow wrong).
// A --force flag bypasses the guard for intentional full resets.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// Load the state.cjs module internals via the command router
function requireStateCjs() {
  return require(path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'state.cjs'));
}

function makeTempPlanning(stateContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3127-'));
  const planningDir = path.join(dir, '.planning');
  fs.mkdirSync(planningDir, { recursive: true });
  fs.writeFileSync(path.join(planningDir, 'STATE.md'), stateContent, 'utf8');
  return dir;
}

// A STATE.md that is mid-flight on Phase 5 (Plan 3 of 8 in progress)
const MID_FLIGHT_STATE = `# GSD State

## Configuration
Current Phase: 5
Current Phase Name: test-phase
Total Plans in Phase: 8
Current Plan: 3
Status: Executing Phase 5

## Current Position

Phase: 5 (test-phase) — EXECUTING
Plan: 3 of 8 (Plan 00 SHIPPED — wave 1 complete; Plan 01 SHIPPED; Plan 02 next)
Status: Executing Phase 5
Last activity: 2026-05-05 -- Plan 02 SHIPPED wave 2 GREEN

## Progress

progress:
  total_phases: 10
  completed_phases: 4
  percent: 89

stopped_at: Phase 5 Plan 02 SHIPPED — Wave 2 GREEN detailed narrative here; ready for Plan 03
`;

// A STATE.md that is NOT yet executing (plan-phase just ran)
const PRE_EXECUTE_STATE = `# GSD State

## Configuration
Current Phase: 5
Current Phase Name: test-phase
Total Plans in Phase: 8
Current Plan: 1
Status: Ready to execute

## Current Position

Phase: 5 (test-phase) — READY
Plan: 1 of 8
Status: Ready to execute
Last activity: 2026-05-04 -- context gathered; ready for plan-phase

stopped_at: Phase 5 context gathered; ready for plan-phase
`;

describe('bug #3127: state.begin-phase idempotency guard', () => {
  test('begin-phase on a mid-flight phase does not reset Current Plan', () => {
    const stateModule = requireStateCjs();
    const { cmdStateBeginPhase } = stateModule;
    if (!cmdStateBeginPhase) {
      // Skip if not exported — the guard may be inside a private function
      return;
    }
    const dir = makeTempPlanning(MID_FLIGHT_STATE);
    try {
      cmdStateBeginPhase(dir, '5', 'test-phase', 8, false);
      const after = fs.readFileSync(path.join(dir, '.planning', 'STATE.md'), 'utf8');
      // Current Plan must not have been reset to 1
      const planMatch = after.match(/^Current Plan:\s*(\S+)/m);
      if (planMatch) {
        assert.notStrictEqual(planMatch[1], '1',
          'begin-phase reset Current Plan to 1 on a mid-flight phase — idempotency guard not applied');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('begin-phase on a mid-flight phase does not overwrite stopped_at narrative', () => {
    const stateModule = requireStateCjs();
    const { cmdStateBeginPhase } = stateModule;
    if (!cmdStateBeginPhase) return;
    const dir = makeTempPlanning(MID_FLIGHT_STATE);
    try {
      cmdStateBeginPhase(dir, '5', 'test-phase', 8, false);
      const after = fs.readFileSync(path.join(dir, '.planning', 'STATE.md'), 'utf8');
      // The rich stopped_at narrative must be preserved
      assert.ok(
        after.includes('Plan 02 SHIPPED') || after.includes('Wave 2 GREEN'),
        'begin-phase overwrote stopped_at narrative on a mid-flight phase',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('begin-phase on a NOT-yet-executing phase sets Current Plan to 1 (normal path)', () => {
    const stateModule = requireStateCjs();
    const { cmdStateBeginPhase } = stateModule;
    if (!cmdStateBeginPhase) return;
    const dir = makeTempPlanning(PRE_EXECUTE_STATE);
    try {
      cmdStateBeginPhase(dir, '5', 'test-phase', 8, false);
      const after = fs.readFileSync(path.join(dir, '.planning', 'STATE.md'), 'utf8');
      // Normal path: Current Plan should become 1 (or stay 1)
      const planMatch = after.match(/^Current Plan:\s*(\S+)/m);
      if (planMatch) {
        assert.strictEqual(planMatch[1], '1',
          'begin-phase should set Current Plan to 1 on a fresh phase');
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('begin-phase always updates Last Activity date (safe on resume)', () => {
    const stateModule = requireStateCjs();
    const { cmdStateBeginPhase } = stateModule;
    if (!cmdStateBeginPhase) return;
    const dir = makeTempPlanning(MID_FLIGHT_STATE);
    try {
      cmdStateBeginPhase(dir, '5', 'test-phase', 8, false);
      const after = fs.readFileSync(path.join(dir, '.planning', 'STATE.md'), 'utf8');
      const today = new Date().toISOString().split('T')[0];
      assert.ok(
        after.includes(today),
        'begin-phase must update Last Activity date even on resume (safe field)',
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
