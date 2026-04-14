/**
 * Tests for --forensic flag on /gsd-progress (#2189)
 *
 * The --forensic flag appends a 6-check integrity audit after the standard
 * progress report. Default behavior (no flag) is unchanged.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('#2189: progress --forensic flag', () => {
  test('progress command argument-hint includes --forensic', () => {
    const command = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'gsd', 'progress.md'), 'utf8'
    );
    assert.ok(command.includes('--forensic'), 'argument-hint should include --forensic');
  });

  test('progress workflow has a forensic_audit step', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md'), 'utf8'
    );
    assert.ok(
      workflow.includes('<step name="forensic_audit">'),
      'workflow should have a forensic_audit step'
    );
  });

  test('forensic_audit step is only triggered when --forensic is present', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md'), 'utf8'
    );
    const forensicStep = workflow.slice(
      workflow.indexOf('<step name="forensic_audit">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="forensic_audit">'))
    );
    assert.ok(
      forensicStep.includes('--forensic'),
      'forensic_audit step should be gated on --forensic flag'
    );
    assert.ok(
      forensicStep.includes('Skip') || forensicStep.includes('skip') || forensicStep.includes('exit'),
      'forensic_audit step should skip when --forensic is not present'
    );
  });

  test('forensic_audit step includes all 6 checks', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md'), 'utf8'
    );
    const forensicStep = workflow.slice(
      workflow.indexOf('<step name="forensic_audit">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="forensic_audit">'))
    );
    // Check 1: STATE vs artifact consistency
    assert.ok(
      forensicStep.includes('STATE') && (forensicStep.includes('artifact') || forensicStep.includes('consistent')),
      'forensic step should check STATE vs artifact consistency (check 1)'
    );
    // Check 2: Orphaned handoff files
    assert.ok(
      forensicStep.includes('HANDOFF') || forensicStep.includes('handoff'),
      'forensic step should check for orphaned handoff files (check 2)'
    );
    // Check 3: Deferred scope drift
    assert.ok(
      forensicStep.includes('deferred') || forensicStep.includes('defer'),
      'forensic step should check for deferred scope drift (check 3)'
    );
    // Check 4: Memory-flagged pending work
    assert.ok(
      forensicStep.includes('MEMORY') || forensicStep.includes('memory') || forensicStep.includes('pending'),
      'forensic step should check memory-flagged pending work (check 4)'
    );
    // Check 5: Blocking todos
    assert.ok(
      forensicStep.includes('todo') || forensicStep.includes('Todo') || forensicStep.includes('TODO'),
      'forensic step should check blocking operational todos (check 5)'
    );
    // Check 6: Uncommitted code
    assert.ok(
      forensicStep.includes('uncommitted') || forensicStep.includes('git status'),
      'forensic step should check for uncommitted code (check 6)'
    );
  });

  test('forensic_audit step produces a CLEAN or INTEGRITY ISSUE(S) FOUND verdict', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md'), 'utf8'
    );
    const forensicStep = workflow.slice(
      workflow.indexOf('<step name="forensic_audit">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="forensic_audit">'))
    );
    assert.ok(
      forensicStep.includes('CLEAN'),
      'forensic step should produce a CLEAN verdict when all checks pass'
    );
    assert.ok(
      forensicStep.includes('INTEGRITY ISSUE') || forensicStep.includes('integrity issue'),
      'forensic step should surface INTEGRITY ISSUE when checks fail'
    );
  });

  test('forensic_audit step does not change default progress behavior', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md'), 'utf8'
    );
    // The forensic step must explicitly say default behavior is unchanged
    const forensicStep = workflow.slice(
      workflow.indexOf('<step name="forensic_audit">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="forensic_audit">'))
    );
    assert.ok(
      forensicStep.includes('unchanged') || forensicStep.includes('standard report'),
      'forensic step should clarify that default behavior is unchanged'
    );
  });

  test('COMMANDS.md documents --forensic flag for gsd-progress', () => {
    const commands = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'COMMANDS.md'), 'utf8'
    );
    assert.ok(
      commands.includes('--forensic'),
      'COMMANDS.md should document --forensic flag for gsd-progress'
    );
  });
});
