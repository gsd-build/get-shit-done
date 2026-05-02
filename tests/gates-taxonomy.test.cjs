// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Validates the gates taxonomy reference document (#1715).
 *
 * Ensures the reference file exists, defines all 4 canonical gate types,
 * includes the gate matrix table, and is cross-referenced from workflows.
 */
const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GATES_REF = path.join(ROOT, 'get-shit-done', 'references', 'gates.md');

describe('gates taxonomy (#1715)', () => {
  test('reference file exists', () => {
    assert.ok(
      fs.existsSync(GATES_REF),
      'get-shit-done/references/gates.md must exist'
    );
  });

  test('defines all 4 canonical gate types', () => {
    const content = fs.readFileSync(GATES_REF, 'utf-8');
    const gateTypes = ['Pre-flight Gate', 'Revision Gate', 'Escalation Gate', 'Abort Gate'];

    for (const gate of gateTypes) {
      assert.ok(
        content.includes(`### ${gate}`),
        `gates.md must define "${gate}" as an h3 heading`
      );
    }
  });

  test('each gate type has Purpose, Behavior, Recovery, and Examples', () => {
    const content = fs.readFileSync(GATES_REF, 'utf-8');
    const sections = content.split('### ').slice(1); // split by h3, drop preamble

    for (const section of sections) {
      const name = section.split('\n')[0].trim();
      // Only check gate type sections (not other h3s if any)
      if (!name.endsWith('Gate')) continue;

      for (const field of ['**Purpose:**', '**Behavior:**', '**Recovery:**', '**Examples:**']) {
        assert.ok(
          section.includes(field),
          `Gate "${name}" must include ${field}`
        );
      }
    }
  });

  test('contains Gate Matrix table', () => {
    const content = fs.readFileSync(GATES_REF, 'utf-8');
    assert.ok(
      content.includes('## Gate Matrix'),
      'gates.md must include a "Gate Matrix" section'
    );
    // Verify table header row
    assert.ok(
      content.includes('| Workflow |'),
      'Gate Matrix must contain a table with Workflow column'
    );
    // Verify key workflow rows exist
    assert.ok(content.includes('plan-phase'), 'Gate Matrix must reference plan-phase');
    assert.ok(content.includes('execute-phase'), 'Gate Matrix must reference execute-phase');
    assert.ok(content.includes('verify-work'), 'Gate Matrix must reference verify-work');
    assert.ok(content.includes('| next |'), 'Gate Matrix must reference next workflow');
  });

  test('plan-phase.md references gates.md', () => {
    const planPhase = path.join(ROOT, 'get-shit-done', 'workflows', 'plan-phase.md');
    const content = fs.readFileSync(planPhase, 'utf-8');
    assert.ok(
      content.includes('references/gates.md'),
      'plan-phase.md must reference gates.md in its required_reading block'
    );
  });

  test('execute-phase.md references gates.md', () => {
    const execPhase = path.join(ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
    const content = fs.readFileSync(execPhase, 'utf-8');
    assert.ok(
      content.includes('references/gates.md'),
      'execute-phase.md must reference gates.md in its required_reading block'
    );
  });

  test('gsd-plan-checker.md references gates.md in required_reading block', () => {
    const planChecker = path.join(ROOT, 'agents', 'gsd-plan-checker.md');
    const content = fs.readFileSync(planChecker, 'utf-8');
    const match = content.match(/<required_reading>\r?\n([\s\S]*?)\r?\n<\/required_reading>/);
    assert.ok(
      match,
      'gsd-plan-checker.md must have a <required_reading> block'
    );
    assert.ok(
      match[1].includes('references/gates.md'),
      'gsd-plan-checker.md must reference gates.md inside <required_reading>'
    );
  });

  test('gsd-verifier.md references gates.md in required_reading block', () => {
    const verifier = path.join(ROOT, 'agents', 'gsd-verifier.md');
    const content = fs.readFileSync(verifier, 'utf-8');
    const match = content.match(/<required_reading>\r?\n([\s\S]*?)\r?\n<\/required_reading>/);
    assert.ok(
      match,
      'gsd-verifier.md must have a <required_reading> block'
    );
    assert.ok(
      match[1].includes('references/gates.md'),
      'gsd-verifier.md must reference gates.md inside <required_reading>'
    );
  });

  test('Revision Gate recovery mentions stall detection', () => {
    const content = fs.readFileSync(GATES_REF, 'utf-8');
    assert.ok(
      content.includes('stall detection'),
      'Revision Gate recovery must mention stall detection (early escalation when issues stop decreasing)'
    );
  });
});
