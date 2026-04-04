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
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('gsd:discuss-phase') && content.includes('INTERACTIVE'),
      'workflow should invoke gsd:discuss-phase when INTERACTIVE is set'
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
