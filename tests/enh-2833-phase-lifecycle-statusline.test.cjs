/**
 * Tests for issue #2833 — phase-lifecycle status-line.
 *
 * Covers the additions made by the two preceding feat commits:
 *
 *   1. parseStateMd reads four new STATE.md frontmatter fields
 *      - active_phase
 *      - next_action
 *      - next_phases (YAML flow array)
 *      - progress (nested block: completed_phases / total_phases / percent)
 *
 *   2. formatGsdState renders three new scenes when those fields are populated
 *      - Scene 1: active_phase set         → "Phase X.Y <stage>"
 *      - Scene 2: idle + next_action set   → "next <action> <phases>"
 *      - Scene 3: percent 100 / all done   → "milestone complete"
 *      - Scene 4: default fallback         → unchanged "<status> · <phase>"
 *
 *   3. renderProgressBar() helper for the opt-in milestone bar.
 *
 *   4. Backward compatibility — existing STATE.md files (without any of the
 *      new fields) render byte-for-byte identically to v1.38.x.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseStateMd,
  formatGsdState,
} = require('../hooks/gsd-statusline.js');

// ─── parseStateMd: new lifecycle fields ─────────────────────────────────────

describe('parseStateMd #2833 lifecycle fields', () => {
  test('reads active_phase from frontmatter', () => {
    const content = [
      '---',
      'milestone: v2.0',
      'status: executing',
      'active_phase: "4.5"',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.equal(s.activePhase, '4.5');
  });

  test('reads next_action from frontmatter', () => {
    const content = [
      '---',
      'milestone: v2.0',
      'next_action: execute-phase',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.equal(s.nextAction, 'execute-phase');
  });

  test('treats "null" literal as null for active_phase and next_action', () => {
    const content = [
      '---',
      'active_phase: null',
      'next_action: null',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.equal(s.activePhase, null);
    assert.equal(s.nextAction, null);
  });

  test('parses next_phases YAML flow array (single item)', () => {
    const content = [
      '---',
      'next_phases: ["4.5"]',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.deepEqual(s.nextPhases, ['4.5']);
  });

  test('parses next_phases YAML flow array (multiple items)', () => {
    const content = [
      '---',
      'next_phases: ["4.5", "4.6", "5"]',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.deepEqual(s.nextPhases, ['4.5', '4.6', '5']);
  });

  test('parses progress nested block — all three fields', () => {
    const content = [
      '---',
      'progress:',
      '  total_phases: 17',
      '  completed_phases: 10',
      '  percent: 59',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.equal(s.totalPhases, '17');
    assert.equal(s.completedPhases, '10');
    assert.equal(s.percent, '59');
  });

  test('returns undefined for absent lifecycle fields', () => {
    const content = [
      '---',
      'milestone: v1.9',
      'status: executing',
      '---',
    ].join('\n');
    const s = parseStateMd(content);
    assert.equal(s.activePhase, undefined);
    assert.equal(s.nextAction, undefined);
    assert.equal(s.nextPhases, undefined);
    assert.equal(s.percent, undefined);
  });
});

// ─── formatGsdState: new scenes ─────────────────────────────────────────────

describe('formatGsdState #2833 lifecycle scenes', () => {
  test('Scene 1 — active_phase set renders "Phase X.Y <stage>"', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      status: 'executing',
      activePhase: '4.5',
      percent: '59',
    });
    assert.equal(out, 'v2.0 [█████░░░░░] 59% · Phase 4.5 executing');
  });

  test('Scene 1 — active_phase without status renders "Phase X.Y"', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      activePhase: '4.5',
    });
    assert.equal(out, 'v2.0 · Phase 4.5');
  });

  test('Scene 2 — idle + next_action renders "next <action> <phases>"', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      activePhase: null,
      nextAction: 'execute-phase',
      nextPhases: ['4.5'],
      percent: '59',
    });
    assert.equal(out, 'v2.0 [█████░░░░░] 59% · next execute-phase 4.5');
  });

  test('Scene 2 — multiple next_phases joined with /', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      nextAction: 'discuss-phase',
      nextPhases: ['4.7', '6.5'],
    });
    assert.equal(out, 'v2.0 · next discuss-phase 4.7/6.5');
  });

  test('Scene 3 — percent=100 renders "milestone complete"', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      percent: '100',
    });
    assert.equal(out, 'v2.0 [██████████] 100% · milestone complete');
  });

  test('Scene 3 — completed_phases equals total_phases also triggers complete', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      completedPhases: '17',
      totalPhases: '17',
    });
    assert.equal(out, 'v2.0 · milestone complete');
  });
});

// ─── Backward compatibility — CRITICAL: existing STATE.md unchanged ─────────

describe('formatGsdState #2833 backward compatibility', () => {
  test('legacy STATE.md (only status + milestone + phase) renders unchanged', () => {
    // Identical to the format documented in #1989 (the foundation issue).
    // No new lifecycle fields populated → must render exactly as v1.38.x did.
    const out = formatGsdState({
      status: 'executing',
      milestone: 'v1.9',
      milestoneName: 'Code Quality',
      phaseNum: '1',
      phaseTotal: '5',
      phaseName: 'fix-graphiti-deployment',
    });
    assert.equal(out, 'v1.9 Code Quality · executing · fix-graphiti-deployment (1/5)');
  });

  test('only status set (no phase, no lifecycle fields) renders just "<milestone> · <status>"', () => {
    const out = formatGsdState({
      milestone: 'v1.9',
      status: 'executing',
    });
    assert.equal(out, 'v1.9 · executing');
  });

  test('empty state renders empty string', () => {
    const out = formatGsdState({});
    assert.equal(out, '');
  });

  test('progress.percent is opt-in — absent percent leaves milestone segment unchanged', () => {
    const out = formatGsdState({
      milestone: 'v1.9',
      milestoneName: 'Code Quality',
      status: 'executing',
    });
    // No bar rendered when percent is absent.
    assert.equal(out, 'v1.9 Code Quality · executing');
  });
});

// ─── renderProgressBar (exported indirectly via formatGsdState behavior) ────

describe('progress bar rendering', () => {
  test('0% renders 10 empty segments', () => {
    // percent=0 doesn't trigger Scene 3 (only percent='100' does), so
    // Scene 4 fallback fires with no extra parts — just milestone + bar.
    const out = formatGsdState({ milestone: 'v2.0', percent: '0' });
    assert.ok(out.includes('[░░░░░░░░░░] 0%'));
  });

  test('50% renders 5 filled + 5 empty', () => {
    const out = formatGsdState({ milestone: 'v2.0', percent: '50' });
    assert.ok(out.includes('[█████░░░░░] 50%'));
  });

  test('100% renders 10 filled (and triggers Scene 3)', () => {
    const out = formatGsdState({ milestone: 'v2.0', percent: '100' });
    assert.equal(out, 'v2.0 [██████████] 100% · milestone complete');
  });

  test('percent absent → no bar rendered (opt-in)', () => {
    const out = formatGsdState({ milestone: 'v2.0', status: 'executing' });
    assert.ok(!out.includes('['));
    assert.ok(!out.includes('░'));
    assert.ok(!out.includes('█'));
  });

  test('percent over 100 clamps to 100', () => {
    const out = formatGsdState({ milestone: 'v2.0', percent: '150' });
    assert.ok(out.includes('[██████████] 100%'));
  });

  test('percent below 0 clamps to 0', () => {
    const out = formatGsdState({ milestone: 'v2.0', percent: '-10' });
    assert.ok(out.includes('[░░░░░░░░░░] 0%'));
  });
});

// ─── Scene priority — first-match-wins guarantee ────────────────────────────

describe('formatGsdState #2833 scene priority', () => {
  test('active_phase wins over next_action when both populated', () => {
    // active_phase populated should win — orchestrator is in flight,
    // any "next" recommendation would be misleading.
    const out = formatGsdState({
      milestone: 'v2.0',
      status: 'executing',
      activePhase: '4.5',
      nextAction: 'execute-phase',
      nextPhases: ['4.5'],
    });
    assert.ok(out.includes('Phase 4.5 executing'));
    assert.ok(!out.includes('next execute-phase'));
  });

  test('next_action wins over Scene 4 fallback when active_phase null', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      status: 'in_progress',  // would be Scene 4 fallback alone
      activePhase: null,
      nextAction: 'execute-phase',
      nextPhases: ['4.5'],
      phaseNum: '1',
      phaseTotal: '5',
    });
    assert.ok(out.includes('next execute-phase 4.5'));
    assert.ok(!out.includes('in_progress'));
    assert.ok(!out.includes('1/5'));
  });

  test('percent=100 wins over Scene 4 even with phase set', () => {
    const out = formatGsdState({
      milestone: 'v2.0',
      percent: '100',
      phaseNum: '1',
      phaseTotal: '5',
    });
    assert.ok(out.includes('milestone complete'));
    assert.ok(!out.includes('1/5'));
  });
});
