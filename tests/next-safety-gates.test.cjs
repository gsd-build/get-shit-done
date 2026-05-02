// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - /gsd-next safety gates and prior-phase completeness scan
 *
 * Validates that the next workflow includes three hard-stop safety gates
 * (checkpoint, error state, verification), a prior-phase completeness scan
 * replacing the old consecutive-call counter, and a --force bypass flag.
 *
 * Closes: #1732, #2089
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('/gsd-next safety gates (#1732, #2089)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'next.md');
  // #2790: next.md command was consolidated into progress.md as the --next flag.
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'progress.md');

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

  test('prior-phase completeness scan replaces consecutive-call counter', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('Prior-phase completeness scan'),
      'workflow should have a prior-phase completeness scan section'
    );
    assert.ok(
      !content.includes('.next-call-count'),
      'workflow must not reference the old .next-call-count counter file'
    );
    assert.ok(
      !content.includes('consecutively'),
      'workflow must not reference consecutive call counting'
    );
  });

  test('completeness scan checks plans without summaries', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('Plans without summaries') || content.includes('no SUMMARY.md'),
      'completeness scan should detect plans that ran without producing summaries'
    );
  });

  test('completeness scan checks verification failures in prior phases', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('Verification failures not overridden') ||
        content.includes('VERIFICATION.md with `FAIL`'),
      'completeness scan should detect unoverridden FAIL items in prior phase VERIFICATION.md'
    );
  });

  test('completeness scan checks CONTEXT.md without plans', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('CONTEXT.md without plans') ||
        content.includes('CONTEXT.md but no PLAN.md'),
      'completeness scan should detect phases with discussion but no planning'
    );
  });

  test('completeness scan offers Continue, Stop, and Force options', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('[C]'), 'completeness scan should offer [C] Continue option');
    assert.ok(content.includes('[S]'), 'completeness scan should offer [S] Stop option');
    assert.ok(content.includes('[F]'), 'completeness scan should offer [F] Force option');
  });

  test('deferral path creates backlog entry using 999.x scheme', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('999.'),
      'deferral should use the 999.x backlog numbering scheme'
    );
    assert.ok(
      content.includes('Backlog') || content.includes('BACKLOG'),
      'deferral should write to the Backlog section of ROADMAP.md'
    );
  });

  test('clean prior phases route silently with no interruption', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('silently') || content.includes('no interruption'),
      'workflow should route without interruption when prior phases are clean'
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

  test('command definition documents --next flag with --force AND completeness routing (#2790)', () => {
    // #2790 absorbed standalone /gsd-next into /gsd-progress --next. The
    // consolidated command must preserve BOTH safety-relevant contracts:
    //  (a) --force escape hatch for bypassing safety gates
    //  (b) the completeness scan / next-workflow routing semantics
    // Earlier OR-based predicates passed when only `--next` was mentioned,
    // letting the completeness contract regress silently.
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('--next'),
      'progress.md must document the --next flag (absorbed from standalone next.md command in #2790)');
    assert.ok(content.includes('--force'),
      'progress.md must document the --force escape hatch for --next (#2790 carried over from next.md)');
    const documentsCompleteness =
      /completeness/i.test(content) ||
      /next workflow/i.test(content) ||
      /scans? all prior phases/i.test(content);
    assert.ok(documentsCompleteness,
      'progress.md must document the completeness scan / next-workflow routing for --next (#2790)');
  });

  test('next workflow documents --force bypass flag', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      content.includes('--force'),
      'next.md workflow must document --force flag for bypassing safety gates'
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
