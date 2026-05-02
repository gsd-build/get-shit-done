'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * verify-work auto-transition tests (#2018)
 *
 * Validates that verify-work.md calls the transition workflow to mark the
 * phase complete in ROADMAP.md and STATE.md when UAT passes with 0 issues.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const VERIFY_WORK = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'verify-work.md');

describe('verify-work.md — auto-transition after UAT passes with 0 issues', () => {
  test('workflow reads transition.md when issues == 0 and security gate cleared', () => {
    const content = fs.readFileSync(VERIFY_WORK, 'utf-8');
    assert.ok(
      content.includes('transition.md'),
      'verify-work.md must reference transition.md for phase completion when issues == 0'
    );
  });

  test('transition call appears after complete_session section', () => {
    const content = fs.readFileSync(VERIFY_WORK, 'utf-8');
    const completeSessionIdx = content.indexOf('complete_session');
    const transitionIdx = content.indexOf('transition.md');
    assert.ok(
      completeSessionIdx !== -1,
      'verify-work.md must contain a complete_session section'
    );
    assert.ok(
      transitionIdx !== -1,
      'verify-work.md must reference transition.md'
    );
    assert.ok(
      transitionIdx > completeSessionIdx,
      'transition.md reference must appear after the complete_session section'
    );
  });

  test('security gate check gates the transition (no auto-transition when security pending)', () => {
    const content = fs.readFileSync(VERIFY_WORK, 'utf-8');
    // The security check must appear before the transition reference
    const securityCfgIdx = content.indexOf('SECURITY_CFG');
    const transitionIdx = content.indexOf('transition.md');
    assert.ok(
      securityCfgIdx !== -1,
      'verify-work.md must check SECURITY_CFG before transitioning'
    );
    assert.ok(
      securityCfgIdx < transitionIdx,
      'SECURITY_CFG check must appear before transition.md reference'
    );
  });

  test('transition is only invoked when security gate is cleared or disabled', () => {
    const content = fs.readFileSync(VERIFY_WORK, 'utf-8');
    // Transition must be guarded by security check:
    // Either SECURITY_CFG is false, or security file exists with 0 open threats
    const hasGuardedTransition =
      content.includes('transition.md') &&
      (
        content.includes("SECURITY_CFG") &&
        (content.includes('threats_open') || content.includes('SECURITY_FILE'))
      );
    assert.ok(
      hasGuardedTransition,
      'transition.md invocation must be guarded by security gate checks'
    );
  });

  test('transition is NOT suggested when security enforcement is enabled and no SECURITY.md exists', () => {
    const content = fs.readFileSync(VERIFY_WORK, 'utf-8');
    // The workflow should suggest /gsd-secure-phase when security is enabled but no file exists
    assert.ok(
      content.includes('gsd-secure-phase') || content.includes('gsd:secure-phase'),
      'verify-work.md must suggest /gsd:secure-phase when security gate blocks transition'
    );
  });
});
