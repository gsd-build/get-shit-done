// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Tests for --all flag on /gsd-discuss-phase (#2188)
 *
 * The --all flag auto-selects all gray areas, skipping the interactive
 * AskUserQuestion, but does NOT auto-advance to plan-phase afterward
 * (unlike --auto which both auto-selects and auto-advances).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('#2188: discuss-phase --all flag', () => {
  test('discuss-phase command argument-hint includes --all', () => {
    const command = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'gsd', 'discuss-phase.md'), 'utf8'
    );
    assert.ok(command.includes('--all'), 'argument-hint should include --all');
  });

  test('discuss-phase command description mentions --all', () => {
    const command = fs.readFileSync(
      path.join(__dirname, '..', 'commands', 'gsd', 'discuss-phase.md'), 'utf8'
    );
    // The description frontmatter or objective should reference --all
    assert.ok(command.includes('--all'), 'command description should mention --all flag');
  });

  test('discuss-phase workflow handles --all flag in present_gray_areas', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md'), 'utf8'
    );
    assert.ok(workflow.includes('--all'), 'workflow should handle --all flag');
  });

  test('discuss-phase workflow auto-selects all areas when --all is present', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md'), 'utf8'
    );
    // The present_gray_areas step must trigger auto-select when --all is set
    const grayAreasStep = workflow.slice(
      workflow.indexOf('<step name="present_gray_areas">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="present_gray_areas">'))
    );
    assert.ok(grayAreasStep.includes('--all'), 'present_gray_areas step should handle --all');
    assert.ok(
      grayAreasStep.includes('Auto-select') || grayAreasStep.includes('auto-select'),
      'present_gray_areas step should auto-select areas when --all is set'
    );
  });

  test('discuss-phase workflow does NOT auto-advance when --all is used without --auto or --chain', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md'), 'utf8'
    );
    // The auto_advance step should NOT treat --all as a trigger for plan-phase auto-launch
    const autoAdvanceStep = workflow.slice(
      workflow.indexOf('<step name="auto_advance">'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="auto_advance">'))
    );
    // --all should NOT appear in the auto-advance trigger conditions
    // (it is not a chain/auto flag — it only affects area selection)
    assert.ok(
      !autoAdvanceStep.includes('--all') ||
      autoAdvanceStep.includes('--all does not trigger auto-advance') ||
      autoAdvanceStep.includes('--all is NOT an auto-advance trigger'),
      '--all should not trigger auto-advance in auto_advance step'
    );
  });

  test('discuss-phase workflow initialize step documents --all flag behavior', () => {
    const workflow = fs.readFileSync(
      path.join(__dirname, '..', 'get-shit-done', 'workflows', 'discuss-phase.md'), 'utf8'
    );
    // The initialize step should document --all mode like it documents --auto and --chain
    const initStep = workflow.slice(
      workflow.indexOf('<step name="initialize"'),
      workflow.indexOf('</step>', workflow.indexOf('<step name="initialize"'))
    );
    assert.ok(initStep.includes('--all'), 'initialize step should document --all flag');
  });

  test('COMMANDS.md documents --all flag for discuss-phase', () => {
    const commands = fs.readFileSync(
      path.join(__dirname, '..', 'docs', 'COMMANDS.md'), 'utf8'
    );
    // Find the discuss-phase section and verify --all is documented
    const discussSection = commands.slice(
      commands.indexOf('gsd-discuss-phase') > -1 ? commands.indexOf('gsd-discuss-phase') : commands.indexOf('discuss-phase')
    );
    assert.ok(discussSection.includes('--all'), 'COMMANDS.md should document --all for discuss-phase');
  });
});
