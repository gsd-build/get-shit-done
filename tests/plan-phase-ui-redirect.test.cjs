'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('plan-phase UI-SPEC missing behavior', () => {
  const workflowPath = path.join(
    __dirname,
    '..',
    'get-shit-done',
    'workflows',
    'plan-phase.md'
  );

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(workflowPath), `Expected workflow file at ${workflowPath}`);
  });

  test('does NOT contain hard-blocking exit redirect to /gsd-ui-phase', () => {
    const text = fs.readFileSync(workflowPath, 'utf8');
    // The hard redirect pattern: AskUserQuestion option exits with "Run /gsd-ui-phase... Exit workflow."
    // This is the pattern from line ~503 in the original file
    const hardExitPattern = /Generate UI-SPEC first.*Exit workflow/s;
    assert.ok(
      !hardExitPattern.test(text),
      'plan-phase.md must NOT contain a hard "Generate UI-SPEC first → Exit workflow" redirect. ' +
      'It should offer a primary recommendation with --skip-ui bypass option instead.'
    );
  });

  test('contains --skip-ui bypass option when UI-SPEC.md is missing', () => {
    const text = fs.readFileSync(workflowPath, 'utf8');
    assert.ok(
      text.includes('--skip-ui'),
      'plan-phase.md must include --skip-ui as a bypass option when UI-SPEC.md is missing'
    );
  });

  test('contains a primary recommendation block for missing UI-SPEC', () => {
    const text = fs.readFileSync(workflowPath, 'utf8');
    const hasRecommendationPattern =
      text.includes('Recommended next step') &&
      text.includes('gsd-ui-phase');
    assert.ok(
      hasRecommendationPattern,
      'plan-phase.md must include a "Recommended next step" recommendation for /gsd-ui-phase when UI-SPEC.md is missing'
    );
  });
});
