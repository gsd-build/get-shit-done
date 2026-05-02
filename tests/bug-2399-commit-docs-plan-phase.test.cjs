// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Bug #2399: commit_docs:true is ignored in plan-phase
 *
 * The plan-phase workflow generates plan artifacts but never commits them even
 * when commit_docs is true. A step between 13b and 14 must commit the PLAN.md
 * files and updated STATE.md when commit_docs is set.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PLAN_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'plan-phase.md');

describe('plan-phase commit_docs support (#2399)', () => {
  test('plan-phase.md exists', () => {
    assert.ok(fs.existsSync(PLAN_PHASE_PATH), 'get-shit-done/workflows/plan-phase.md must exist');
  });

  test('plan-phase.md has a commit step for plan artifacts', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Must contain a commit call that references PLAN.md files
    assert.ok(
      content.includes('PLAN.md') && content.includes('commit'),
      'plan-phase.md must include a commit step that references PLAN.md files'
    );
  });

  test('plan-phase.md commit step is gated on commit_docs', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // The commit step must be conditional on commit_docs
    assert.ok(
      content.includes('commit_docs'),
      'plan-phase.md must reference commit_docs to gate the plan commit step'
    );
  });

  test('plan-phase.md commit step references STATE.md', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Should commit STATE.md alongside PLAN.md files
    assert.ok(
      content.includes('STATE.md'),
      'plan-phase.md commit step should include STATE.md to capture planning completion state'
    );
  });

  test('plan-phase.md has a step 13c that commits plan artifacts', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    const step13b = content.indexOf('## 13b.');
    const step14 = content.indexOf('## 14.');
    // Look for the step 13c section (or any commit step between 13b and 14)
    const step13c = content.indexOf('## 13c.');

    assert.ok(step13b !== -1, '## 13b. section must exist');
    assert.ok(step14 !== -1, '## 14. section must exist');
    assert.ok(step13c !== -1, '## 13c. step must exist (commit plans step)');
    assert.ok(
      step13c > step13b && step13c < step14,
      `Step 13c (at ${step13c}) must appear between step 13b (at ${step13b}) and step 14 (at ${step14})`
    );
  });

  test('plan-phase.md uses gsd-sdk query commit for the plan commit', () => {
    const content = fs.readFileSync(PLAN_PHASE_PATH, 'utf-8');
    // Must use gsd-sdk query commit (not raw git) so commit_docs guard in gsd-tools is respected
    assert.ok(
      content.includes('gsd-sdk query commit') || content.includes('gsd-tools') || content.includes('gsd-sdk'),
      'plan-phase.md plan commit step must use gsd-sdk query commit (not raw git commit)'
    );
  });
});
