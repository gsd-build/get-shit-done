// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - autonomous --interactive flag
 *
 * Validates that the autonomous workflow and command definition
 * correctly document and support the --interactive flag.
 *
 * Closes: #1413
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('autonomous --interactive flag (#1413)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'autonomous.md');
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'autonomous.md');

  test('command definition includes --interactive in argument-hint', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('--interactive'), 'command should document --interactive flag');
    assert.ok(content.includes('argument-hint:') && content.includes('--interactive'),
      'argument-hint should include --interactive');
  });

  test('command definition describes interactive mode behavior', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('discuss') && content.includes('inline'),
      'command should describe discuss running inline');
    assert.ok(content.includes('background'),
      'command should mention background agents for plan+execute');
  });

  test('workflow parses --interactive flag', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes("--interactive") && content.includes('INTERACTIVE'),
      'workflow should parse --interactive into INTERACTIVE variable');
  });

  test('workflow uses discuss-phase skill in interactive mode', () => {
    // Per #2697 the user-facing form is the hyphen invariant gsd-discuss-phase;
    // the colon form was retired and is enforced absent by bug-2543 tests.
    //
    // Don't `.includes()` against the full file — both tokens could appear in
    // unrelated sections (e.g. INTERACTIVE="" initialization + a stray
    // gsd-discuss-phase mention in prose) and falsely pass. Instead, isolate
    // the structural region that gates on INTERACTIVE and assert the Skill
    // invocation lives inside it.
    const content = fs.readFileSync(workflowPath, 'utf8');
    const interactiveMarker = '**If `INTERACTIVE` is set:**';
    const branchStart = content.indexOf(interactiveMarker);
    assert.notStrictEqual(
      branchStart, -1,
      `workflow must define an explicit '${interactiveMarker}' branch`,
    );
    // Bound the branch by the next "**If `..." prose marker (the non-interactive
    // sibling) or, failing that, the next `<step ...>`/`</step>` boundary.
    const afterStart = branchStart + interactiveMarker.length;
    const candidates = [
      content.indexOf('**If `INTERACTIVE` is NOT set', afterStart),
      content.indexOf('**If `', afterStart),
      content.indexOf('</step>', afterStart),
      content.indexOf('<step ', afterStart),
    ].filter((i) => i !== -1);
    assert.ok(candidates.length > 0, 'INTERACTIVE branch must have a closing boundary');
    const branchEnd = Math.min(...candidates);
    const branch = content.slice(branchStart, branchEnd);

    // The branch must invoke the hyphen-form Skill. Tolerate whitespace
    // around `(`, `skill`, and `=` so harmless reformatting doesn't break this.
    const skillCall = /Skill\(\s*skill\s*=\s*['"]gsd-discuss-phase['"]/.test(branch);
    assert.ok(
      skillCall,
      `INTERACTIVE branch must invoke Skill(skill="gsd-discuss-phase"). Got branch:\n${branch}`,
    );
  });

  test('workflow dispatches plan as background agent in interactive mode', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // Should have Agent() with run_in_background for plan
    assert.ok(
      content.includes('run_in_background') && content.includes('plan-phase'),
      'workflow should dispatch plan-phase as background agent in interactive mode'
    );
  });

  test('workflow dispatches execute as background agent in interactive mode', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('run_in_background') && content.includes('execute-phase'),
      'workflow should dispatch execute-phase as background agent in interactive mode'
    );
  });

  test('workflow describes pipeline parallelism in interactive mode', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('pipeline parallelism') || content.includes('Phase N+1'),
      'workflow should describe overlapping discuss/execute between phases'
    );
  });

  test('success criteria include --interactive requirements', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const criteriaMatch = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    const criteria = criteriaMatch ? criteriaMatch[1] : '';
    assert.ok(criteria.includes('--interactive'),
      'success criteria should include --interactive requirements');
    assert.ok(criteria.includes('discuss inline'),
      'success criteria should mention discuss inline');
    assert.ok(criteria.includes('background agents'),
      'success criteria should mention background agents');
  });
});
