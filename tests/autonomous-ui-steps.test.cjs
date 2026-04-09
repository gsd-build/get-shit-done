/**
 * Tests that autonomous.md includes ui-phase and ui-review steps for frontend phases.
 *
 * Issue #1375: autonomous workflow skips ui-phase and ui-review for frontend phases.
 * The per-phase execution loop should be: discuss -> ui-phase -> plan -> execute -> verify -> ui-review
 * for phases with frontend indicators.
 */

const { describe, it, test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'autonomous.md');

describe('autonomous workflow ui-phase and ui-review integration (#1375)', () => {
  let content;

  beforeEach(() => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflows/autonomous.md should exist');
    content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  });

  describe('step 3a.5 — UI design contract before planning', () => {
    test('autonomous.md contains a UI design contract step between discuss and plan', () => {
      assert.ok(
        content.includes('3a.5'),
        'should have step 3a.5 for UI design contract'
      );
    });

    test('UI design contract step detects frontend indicators via grep pattern', () => {
      // Same grep pattern as plan-phase step 5.6
      assert.ok(
        content.includes('grep -iE "UI|interface|frontend|component|layout|page|screen|view|form|dashboard|widget"'),
        'should use the same frontend detection grep pattern as plan-phase step 5.6'
      );
    });

    test('UI design contract step checks for existing UI-SPEC.md', () => {
      assert.ok(
        content.includes('UI-SPEC.md'),
        'should check for existing UI-SPEC.md'
      );
    });

    test('UI design contract step respects workflow.ui_phase config toggle', () => {
      assert.ok(
        content.includes('workflow.ui_phase'),
        'should respect workflow.ui_phase config toggle'
      );
    });

    test('UI design contract step invokes gsd:ui-phase skill', () => {
      assert.ok(
        content.includes('skill="gsd-ui-phase"'),
        'should invoke gsd-ui-phase via Skill()'
      );
    });

    test('UI design contract step appears before plan step (3b)', () => {
      const uiPhasePos = content.indexOf('3a.5');
      const planPos = content.indexOf('**3b. Plan**');
      assert.ok(
        uiPhasePos < planPos,
        'step 3a.5 (UI design contract) should appear before step 3b (plan)'
      );
    });
  });

  describe('step 3d.5 — UI review after execution', () => {
    test('autonomous.md contains a UI review step after execution', () => {
      assert.ok(
        content.includes('3d.5'),
        'should have step 3d.5 for UI review'
      );
    });

    test('UI review step checks for UI-SPEC existence before running', () => {
      // The UI review should only run if a UI-SPEC was created/exists
      const reviewSection = content.slice(content.indexOf('3d.5'));
      assert.ok(
        reviewSection.includes('UI_SPEC_FILE'),
        'UI review step should check for UI-SPEC file existence'
      );
    });

    test('UI review step respects workflow.ui_review config toggle', () => {
      assert.ok(
        content.includes('workflow.ui_review'),
        'should respect workflow.ui_review config toggle'
      );
    });

    test('UI review step invokes gsd:ui-review skill', () => {
      assert.ok(
        content.includes('skill="gsd-ui-review"'),
        'should invoke gsd-ui-review via Skill()'
      );
    });

    test('UI review is advisory (non-blocking)', () => {
      const reviewSection = content.slice(content.indexOf('3d.5'));
      assert.ok(
        reviewSection.includes('advisory') || reviewSection.includes('non-blocking') || reviewSection.includes('regardless of score'),
        'UI review should be advisory and not block phase progression'
      );
    });

    test('UI review step appears after execution routing (3d)', () => {
      const executeRouting = content.indexOf('**3d. Post-Execution Routing**');
      const uiReviewPos = content.indexOf('3d.5');
      assert.ok(
        uiReviewPos > executeRouting,
        'step 3d.5 (UI review) should appear after step 3d (post-execution routing)'
      );
    });
  });

  describe('success criteria updated', () => {
    test('success criteria includes UI-aware flow', () => {
      assert.ok(
        content.includes('ui-phase') && content.includes('ui-review'),
        'success criteria should reference ui-phase and ui-review'
      );
    });

    test('success criteria mentions frontend phases get UI-SPEC before planning', () => {
      assert.ok(
        content.includes('Frontend phases') || content.includes('frontend phases'),
        'success criteria should mention frontend phases'
      );
    });

    test('success criteria notes UI review is advisory', () => {
      const criteriaSection = content.slice(content.indexOf('<success_criteria>'));
      assert.ok(
        criteriaSection.includes('advisory') || criteriaSection.includes('non-blocking'),
        'success criteria should note UI review is advisory/non-blocking'
      );
    });
  });
});
