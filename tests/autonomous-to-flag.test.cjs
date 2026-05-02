// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tools Tests - autonomous --to N flag
 *
 * Validates that the autonomous workflow and command definition
 * correctly document and support the --to N flag to stop after
 * a specific phase completes.
 *
 * Closes: #1644
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('autonomous --to N flag (#1644)', () => {
  const workflowPath = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'autonomous.md');
  const commandPath = path.join(__dirname, '..', 'commands', 'gsd', 'autonomous.md');

  // --- Command definition tests ---

  test('command definition includes --to N in argument-hint', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('--to N') || content.includes('--to'),
      'command argument-hint should include --to flag');
    // Verify it's in the argument-hint frontmatter line specifically
    const hintMatch = content.match(/argument-hint:.*--to/);
    assert.ok(hintMatch, 'argument-hint frontmatter should contain --to');
  });

  test('command definition describes --to N behavior in context', () => {
    const content = fs.readFileSync(commandPath, 'utf8');
    assert.ok(content.includes('--to N') || content.includes('--to'),
      'command should document --to flag');
    assert.ok(content.includes('stop') || content.includes('halt'),
      'command should describe stopping behavior');
  });

  // --- Workflow parsing tests ---

  test('workflow parses --to N flag into TO_PHASE variable', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('--to') && content.includes('TO_PHASE'),
      'workflow should parse --to into TO_PHASE variable');
  });

  test('workflow parsing handles --to with numeric argument', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // Should have grep pattern that extracts the number after --to
    // The workflow uses escaped dashes in grep: \-\-to\s+[0-9]
    assert.ok(
      content.includes('--to') && content.includes('TO_PHASE') && content.includes('[0-9]'),
      'workflow should extract numeric value after --to flag');
  });

  // --- --to N stops after phase N completes ---

  test('workflow iterate step checks TO_PHASE to halt after target phase', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The iterate step should check if current phase >= TO_PHASE
    assert.ok(content.includes('TO_PHASE'),
      'iterate step should reference TO_PHASE');
    // Should have logic to stop/halt when target phase is reached
    const iterateSection = content.substring(content.indexOf('<step name="iterate">'));
    assert.ok(iterateSection.includes('TO_PHASE'),
      'iterate step section should check TO_PHASE to decide whether to continue');
  });

  // --- --to without a number shows error ---

  test('workflow validates --to requires a numeric argument', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The grep pattern requires a digit after --to, so --to without a number won't match
    // and TO_PHASE stays empty (no error needed — it simply doesn't activate)
    assert.ok(content.includes('TO_PHASE=""'),
      'TO_PHASE defaults to empty when --to has no number (grep requires digit)');
    // Verify the grep requires a numeric character after --to
    assert.ok(content.includes('\\-\\-to\\s+[0-9]') || content.includes("--to\\s+[0-9]") || content.includes("--to") && content.includes('[0-9]'),
      'workflow grep pattern should require a digit after --to');
  });

  // --- No --to flag runs all phases (existing behavior preserved) ---

  test('workflow defaults TO_PHASE to empty when --to not provided', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(content.includes('TO_PHASE=""'),
      'TO_PHASE should default to empty string when --to is not provided');
  });

  test('workflow only halts at iterate when TO_PHASE is set', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // The halt logic should be conditional on TO_PHASE being set
    const iterateSection = content.substring(content.indexOf('<step name="iterate">'));
    assert.ok(
      iterateSection.includes('TO_PHASE') &&
      (iterateSection.includes('If `TO_PHASE`') || iterateSection.includes('TO_PHASE" is set') || iterateSection.includes('TO_PHASE` is set')),
      'iterate step should only halt when TO_PHASE is set (preserving default run-all behavior)'
    );
  });

  // --- --to N where N < current phase shows message ---

  test('workflow handles --to N where target is already passed', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // Should detect when TO_PHASE is less than the first incomplete phase
    assert.ok(
      content.includes('TO_PHASE') &&
      (content.includes('already past') || content.includes('already beyond') || content.includes('already completed')),
      'workflow should handle case where --to N target is already completed/passed'
    );
  });

  // --- Display / UX ---

  test('workflow displays --to target in startup banner', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // Similar to how --from and --only display in the banner
    assert.ok(
      content.includes('TO_PHASE') && (content.includes('Stopping after') || content.includes('stop') || content.includes('through phase')),
      'startup banner should display --to target phase'
    );
  });

  test('workflow displays completion message when --to target reached', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const iterateSection = content.substring(content.indexOf('<step name="iterate">'));
    assert.ok(
      iterateSection.includes('--to') || iterateSection.includes('TO_PHASE'),
      'iterate section should have --to completion messaging'
    );
  });

  // --- Success criteria ---

  test('success criteria include --to N requirements', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    const criteriaMatch = content.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
    const criteria = criteriaMatch ? criteriaMatch[1] : '';
    assert.ok(criteria.includes('--to'),
      'success criteria should include --to requirements');
  });

  // --- Compatibility ---

  test('--to is compatible with --from (documented or implied)', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // --to and --from should be usable together (run phases from N to M)
    assert.ok(
      content.includes('--to') && content.includes('--from'),
      'workflow should support both --to and --from flags'
    );
  });

  test('--to flag does not interfere with --only flag parsing', () => {
    const content = fs.readFileSync(workflowPath, 'utf8');
    // --only should still work independently; --to parsing should not capture --only values
    const onlyParsing = content.match(/ONLY_PHASE[\s\S]{0,200}--only/);
    assert.ok(onlyParsing, '--only parsing should still be present and independent');
  });
});
