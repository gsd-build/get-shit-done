/**
 * GSD Tools Tests - /gsd-next safety gates and consecutive-call guard
 *
 * Validates that the next workflow includes three hard-stop safety gates
 * (checkpoint, error state, verification), a consecutive-call budget guard,
 * and a --force bypass flag.
 *
 * Closes: #1732
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('/gsd-next safety gates (#1732)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'next.md');
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'next.md');

  test('workflow contains safety_gates step', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('<step name="safety_gates">'),
      'workflow should have a safety_gates step'
    );
  });

  test('safety_gates step appears between detect_state and determine_next_action', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const detectIdx = content.indexOf('name="detect_state"');
    const gatesIdx = content.indexOf('name="safety_gates"');
    const routeIdx = content.indexOf('name="determine_next_action"');
    assert.ok(detectIdx > -1, 'detect_state step should exist');
    assert.ok(gatesIdx > -1, 'safety_gates step should exist');
    assert.ok(routeIdx > -1, 'determine_next_action step should exist');
    assert.ok(
      detectIdx < gatesIdx && gatesIdx < routeIdx,
      'safety_gates must appear between detect_state and determine_next_action'
    );
  });

  test('Gate 1: unresolved checkpoint (.continue-here.md)', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('.continue-here.md'),
      'Gate 1 should check for .planning/.continue-here.md'
    );
    assert.ok(
      content.includes('Unresolved checkpoint'),
      'Gate 1 should display "Unresolved checkpoint" message'
    );
  });

  test('Gate 2: error state in STATE.md', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('status: error') || content.includes('status: failed'),
      'Gate 2 should check for error/failed status in STATE.md'
    );
    assert.ok(
      content.includes('Project in error state'),
      'Gate 2 should display "Project in error state" message'
    );
  });

  test('Gate 3: unchecked verification failures', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('VERIFICATION.md'),
      'Gate 3 should check VERIFICATION.md'
    );
    assert.ok(
      content.includes('FAIL'),
      'Gate 3 should look for FAIL items'
    );
    assert.ok(
      content.includes('Unchecked verification failures'),
      'Gate 3 should display "Unchecked verification failures" message'
    );
  });

  test('consecutive-call budget guard', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('.next-call-count'),
      'workflow should reference .next-call-count counter file'
    );
    assert.ok(
      content.includes('6'),
      'consecutive guard should trigger at count >= 6'
    );
    assert.ok(
      content.includes('consecutively'),
      'guard should mention consecutive calls'
    );
  });

  test('--force flag bypasses all gates', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('--force'),
      'workflow should document --force flag'
    );
    assert.ok(
      content.includes('skipping safety gates'),
      'workflow should print warning when --force is used'
    );
  });

  test('command definition documents --force flag', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(
      content.includes('--force'),
      'command definition should mention --force flag'
    );
    assert.ok(
      content.includes('bypass safety gates'),
      'command definition should explain that --force bypasses safety gates'
    );
  });

  test('gates exit on first hit', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('Exit on first hit'),
      'safety gates should exit on first hit'
    );
  });
});
