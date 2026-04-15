/**
 * GSD Tools Tests - /gsd-progress --forensic flag
 *
 * Validates that the progress workflow and command definition
 * correctly document and support the --forensic flag, which appends
 * a 6-check integrity audit after the standard progress report.
 *
 * Closes: #2189
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('progress --forensic flag (#2189)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'progress.md');
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'progress.md');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const command = fs.readFileSync(commandPath, 'utf8');

  // --- Command definition tests ---

  test('command definition includes --forensic in argument-hint', () => {
    const hintMatch = command.match(/argument-hint:.*--forensic/);
    assert.ok(hintMatch, 'argument-hint frontmatter should contain --forensic');
  });

  test('command definition documents --forensic behavior in objective', () => {
    assert.ok(command.includes('--forensic'),
      'command should reference --forensic');
    assert.ok(/integrity audit|6-check|forensic/i.test(command),
      'command should describe the audit behavior');
  });

  test('command process references $ARGUMENTS for flag parsing', () => {
    assert.ok(command.includes('$ARGUMENTS') && command.includes('--forensic'),
      'command process section should document $ARGUMENTS parsing of --forensic');
  });

  // --- Workflow flag parsing ---

  test('workflow parses --forensic flag into FORENSIC variable', () => {
    assert.ok(workflow.includes('--forensic') && workflow.includes('FORENSIC'),
      'workflow should parse --forensic into FORENSIC variable');
  });

  test('workflow defaults FORENSIC to false when flag not provided', () => {
    assert.ok(workflow.includes('FORENSIC=false'),
      'FORENSIC should default to false when --forensic is not provided');
  });

  test('workflow sets FORENSIC=true when --forensic is present in $ARGUMENTS', () => {
    const parseBlock = workflow.match(/FORENSIC=false[\s\S]{0,300}/);
    assert.ok(parseBlock, 'workflow should have FORENSIC parse block');
    assert.ok(parseBlock[0].includes('$ARGUMENTS') && parseBlock[0].includes('FORENSIC=true'),
      'parse block should read $ARGUMENTS and set FORENSIC=true on match');
  });

  // --- Backward compatibility: without --forensic, behavior unchanged ---

  test('workflow explicitly documents unchanged behavior when flag absent', () => {
    assert.ok(
      /byte-for-byte|unchanged|identical/i.test(workflow) && workflow.includes('FORENSIC'),
      'workflow should explicitly state that non-forensic invocation is unchanged'
    );
  });

  test('standard routes A through F are still present', () => {
    for (const route of ['Route A', 'Route B', 'Route C', 'Route D', 'Route E', 'Route F']) {
      assert.ok(workflow.includes(route),
        `standard routing logic (${route}) should be preserved`);
    }
  });

  test('forensic_audit step runs AFTER the route step', () => {
    const routeIdx = workflow.indexOf('<step name="route">');
    const forensicIdx = workflow.indexOf('<step name="forensic_audit">');
    assert.ok(routeIdx >= 0, 'route step should still exist');
    assert.ok(forensicIdx >= 0, 'forensic_audit step should exist');
    assert.ok(forensicIdx > routeIdx,
      'forensic_audit must come after route so the standard report/routing prints first');
  });

  test('forensic_audit step is gated on FORENSIC=true', () => {
    const forensicSection = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    const endIdx = forensicSection.indexOf('</step>');
    const body = forensicSection.substring(0, endIdx);
    assert.ok(/skip|no-op|unless.*FORENSIC/i.test(body) && body.includes('FORENSIC=true'),
      'forensic_audit must be skipped when FORENSIC is not true');
  });

  // --- All 6 checks must be present ---

  test('forensic_audit defines Check 1 — STATE vs artifact consistency', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 1/.test(section), 'Check 1 heading should exist');
    assert.ok(section.includes('STATE.md') && section.includes('stopped_at'),
      'Check 1 should read STATE.md stopped_at');
  });

  test('forensic_audit defines Check 2 — orphaned handoff files', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 2/.test(section), 'Check 2 heading should exist');
    assert.ok(section.includes('HANDOFF') || section.includes('handoff'),
      'Check 2 should scan for handoff files');
    assert.ok(section.includes('.continue-here.md'),
      'Check 2 should check .continue-here.md files');
  });

  test('forensic_audit defines Check 3 — deferred scope drift', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 3/.test(section), 'Check 3 heading should exist');
    assert.ok(/defer.*[Pp]hase|ROADMAP/.test(section),
      'Check 3 should detect deferred phases and cross-check ROADMAP');
  });

  test('forensic_audit defines Check 4 — memory-flagged pending work', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 4/.test(section), 'Check 4 heading should exist');
    assert.ok(section.includes('MEMORY.md') || /memory/i.test(section),
      'Check 4 should read memory entries');
  });

  test('forensic_audit defines Check 5 — blocking operational todos', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 5/.test(section), 'Check 5 heading should exist');
    assert.ok(section.includes('.planning/todos/pending'),
      'Check 5 should scan pending operational todos');
  });

  test('forensic_audit defines Check 6 — uncommitted source changes', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/Check 6/.test(section), 'Check 6 heading should exist');
    assert.ok(section.includes('git status'),
      'Check 6 should run git status');
  });

  // --- Verdict block ---

  test('forensic_audit emits CLEAN verdict on 0 failures', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(section.includes('CLEAN'),
      'verdict block should emit CLEAN when no checks fail');
  });

  test('forensic_audit emits INTEGRITY ISSUE verdict on failures', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    assert.ok(/INTEGRITY ISSUE/.test(section),
      'verdict block should emit INTEGRITY ISSUE(S) FOUND when checks fail');
  });

  test('verdict maps each failed check to a suggested action', () => {
    const section = workflow.substring(workflow.indexOf('<step name="forensic_audit">'));
    for (const n of [1, 2, 3, 4, 5, 6]) {
      assert.ok(new RegExp(`Check ${n} fail`).test(section),
        `verdict should include suggested action for Check ${n} failure`);
    }
  });

  // --- Success criteria ---

  test('success criteria document --forensic behavior', () => {
    const criteriaMatch = workflow.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    assert.ok(criteriaMatch, 'success_criteria block should exist');
    const criteria = criteriaMatch[1];
    assert.ok(criteria.includes('--forensic'),
      'success criteria should reference --forensic');
    assert.ok(/unchanged|byte-for-byte/i.test(criteria),
      'success criteria should assert unchanged default behavior');
  });
});
