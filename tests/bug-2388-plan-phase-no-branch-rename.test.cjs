/**
 * Regression test for #2388: plan-phase silently renames feature branch
 * when phase slug has changed since the branch was created.
 *
 * Fix: plan-phase.md must include an explicit instruction not to create,
 * rename, or switch git branches during the planning workflow.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PLAN_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

describe('bug-2388: plan-phase must not rename or create git branches', () => {
  test('plan-phase.md exists', () => {
    assert.ok(fs.existsSync(PLAN_PHASE_PATH), 'plan-phase.md should exist');
  });

  test('plan-phase.md contains explicit no-branch-rename instruction', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Must say "do not" and mention branch in the context of phase slug/rename
    const hasBranchGuard = (
      /do not.{0,80}branch/i.test(content) ||
      /branch.{0,80}do not/i.test(content) ||
      /NEVER.{0,80}branch/i.test(content) ||
      /branch.{0,80}NEVER/i.test(content)
    );
    assert.ok(
      hasBranchGuard,
      'plan-phase.md must include an explicit instruction not to create or rename git branches'
    );
  });

  test('plan-phase.md mentions phase rename does not affect branch name', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should explain that a phase rename in ROADMAP.md is plan-level, not git-level
    const hasPlanLevelExplanation = (
      content.includes('phase rename') ||
      content.includes('phase_slug') ||
      content.includes('branch identity') ||
      content.includes('branch name')
    );
    assert.ok(
      hasPlanLevelExplanation,
      'plan-phase.md should clarify that phase slug changes do not change the git branch'
    );
  });

  test('plan-phase.md does not contain git checkout -b instruction', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // The workflow should not instruct the LLM to run git checkout -b
    assert.ok(
      !content.includes('git checkout -b'),
      'plan-phase.md must not instruct LLM to create a new branch via git checkout -b'
    );
  });
});
