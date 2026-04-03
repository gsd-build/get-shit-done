'use strict';

/**
 * Anti-Pattern Enforcement Tests (#1491)
 *
 * Validates that the handoff/resume system structurally enforces critical
 * anti-patterns via severity levels and mandatory understanding checks.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PAUSE_WORK = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'pause-work.md');
const DISCUSS_PHASE = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md');
const EXECUTE_PHASE = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

describe('pause-work.md — severity column in Critical Anti-Patterns template', () => {
  test('template includes a Severity column header in the anti-patterns table', () => {
    const content = fs.readFileSync(PAUSE_WORK, 'utf-8');
    assert.ok(
      content.includes('Severity') || content.includes('severity'),
      'pause-work.md template must include a Severity column in the anti-patterns table'
    );
  });

  test('template documents "blocking" as a valid severity value', () => {
    const content = fs.readFileSync(PAUSE_WORK, 'utf-8');
    assert.ok(
      content.includes('blocking'),
      'pause-work.md must document "blocking" as a valid severity value'
    );
  });

  test('template documents "advisory" as a valid severity value', () => {
    const content = fs.readFileSync(PAUSE_WORK, 'utf-8');
    assert.ok(
      content.includes('advisory'),
      'pause-work.md must document "advisory" as a valid severity value'
    );
  });

  test('template explains that blocking anti-patterns trigger understanding check at resume', () => {
    const content = fs.readFileSync(PAUSE_WORK, 'utf-8');
    const hasExplanation =
      (content.includes('blocking') && content.includes('understanding check')) ||
      (content.includes('blocking') && content.includes('resume')) ||
      (content.includes('blocking') && content.includes('understanding'));
    assert.ok(
      hasExplanation,
      'pause-work.md must explain that blocking anti-patterns trigger an understanding check at resume'
    );
  });
});

describe('discuss-phase.md — blocking anti-pattern understanding check', () => {
  test('workflow checks for .continue-here.md with blocking anti-patterns', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    const hasCheck =
      content.includes('.continue-here.md') &&
      (content.includes('blocking') || content.includes('anti-pattern'));
    assert.ok(
      hasCheck,
      'discuss-phase.md must check for .continue-here.md blocking anti-patterns before proceeding'
    );
  });

  test('workflow includes mandatory understanding verification for blocking anti-patterns', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    const hasVerification =
      content.includes('understanding') ||
      content.includes('understanding check') ||
      content.includes('demonstrate understanding');
    assert.ok(
      hasVerification,
      'discuss-phase.md must include a mandatory understanding verification step for blocking anti-patterns'
    );
  });

  test('workflow specifies the three understanding check questions', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    // The three questions required by the issue
    const hasWhatIs =
      content.includes('What is this anti-pattern') ||
      content.includes('what is this anti-pattern') ||
      content.includes('What is the anti-pattern');
    const hasHowManifest =
      content.includes('How did it manifest') ||
      content.includes('how did it manifest') ||
      content.includes('manifest');
    const hasPreventMechanism =
      content.includes('structural mechanism') ||
      content.includes('prevention') ||
      content.includes('Prevention');
    assert.ok(
      hasWhatIs && hasHowManifest && hasPreventMechanism,
      'discuss-phase.md must include the three understanding check questions: ' +
      '"What is this anti-pattern?", "How did it manifest?", "What structural mechanism prevents it?"'
    );
  });

  test('understanding check cannot be skipped (must be mandatory)', () => {
    const content = fs.readFileSync(DISCUSS_PHASE, 'utf-8');
    const hasMandatory =
      content.includes('cannot be skipped') ||
      content.includes('must not be skipped') ||
      content.includes('mandatory') ||
      content.includes('MANDATORY') ||
      content.includes('required before');
    assert.ok(
      hasMandatory,
      'discuss-phase.md must indicate that the blocking anti-pattern understanding check cannot be skipped'
    );
  });
});

describe('execute-phase.md — blocking anti-pattern understanding check', () => {
  test('workflow checks for .continue-here.md with blocking anti-patterns', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const hasCheck =
      content.includes('.continue-here.md') &&
      (content.includes('blocking') || content.includes('anti-pattern'));
    assert.ok(
      hasCheck,
      'execute-phase.md must check for .continue-here.md blocking anti-patterns before proceeding'
    );
  });

  test('workflow includes mandatory understanding verification for blocking anti-patterns', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const hasVerification =
      content.includes('understanding') ||
      content.includes('understanding check') ||
      content.includes('demonstrate understanding');
    assert.ok(
      hasVerification,
      'execute-phase.md must include a mandatory understanding verification step for blocking anti-patterns'
    );
  });

  test('workflow specifies the three understanding check questions', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const hasWhatIs =
      content.includes('What is this anti-pattern') ||
      content.includes('what is this anti-pattern') ||
      content.includes('What is the anti-pattern');
    const hasHowManifest =
      content.includes('How did it manifest') ||
      content.includes('how did it manifest') ||
      content.includes('manifest');
    const hasPreventMechanism =
      content.includes('structural mechanism') ||
      content.includes('prevention') ||
      content.includes('Prevention');
    assert.ok(
      hasWhatIs && hasHowManifest && hasPreventMechanism,
      'execute-phase.md must include the three understanding check questions: ' +
      '"What is this anti-pattern?", "How did it manifest?", "What structural mechanism prevents it?"'
    );
  });

  test('understanding check cannot be skipped (must be mandatory)', () => {
    const content = fs.readFileSync(EXECUTE_PHASE, 'utf-8');
    const hasMandatory =
      content.includes('cannot be skipped') ||
      content.includes('must not be skipped') ||
      content.includes('mandatory') ||
      content.includes('MANDATORY') ||
      content.includes('required before');
    assert.ok(
      hasMandatory,
      'execute-phase.md must indicate that the blocking anti-pattern understanding check cannot be skipped'
    );
  });
});
