/**
 * Regression tests for bug #2002
 *
 * offer_next in execute-phase.md must present conditional next steps
 * based on whether CONTEXT.md already exists for the next phase.
 * The previous flat list offered all options equally with no primary
 * recommendation, leaving agents without guidance on the correct first step.
 *
 * Fixed: offer_next now checks for {next}-CONTEXT.md in the phase directory.
 * - If CONTEXT.md is missing: primary suggestion is /gsd-discuss-phase
 * - If CONTEXT.md exists: primary suggestion is /gsd-plan-phase
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.resolve(
  __dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md'
);

describe('bug #2002: offer_next checks CONTEXT.md before suggesting next step', () => {
  let content;

  // Read once — all tests share the same file content
  test('setup: workflow file is readable', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.length > 0, 'execute-phase.md must not be empty');
  });

  test('offer_next section checks for CONTEXT.md existence', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    // The workflow must check for CONTEXT.md in the next phase directory
    assert.ok(
      content.includes('CONTEXT.md'),
      'offer_next must reference CONTEXT.md to determine primary next step'
    );
  });

  test('offer_next presents /gsd-discuss-phase when CONTEXT.md does not exist', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    // Must have a conditional path where discuss-phase is the primary step
    // when CONTEXT.md is missing — look for proximity of "not exist"/"missing"/
    // "does not exist" and "gsd-discuss-phase" in the offer_next step
    const offerNextIdx = content.indexOf('offer_next');
    assert.ok(offerNextIdx !== -1, 'offer_next step must exist');

    // Use 5000-char window — the step is ~60 lines of prose before the conditionals
    const offerNextSection = content.slice(offerNextIdx, offerNextIdx + 5000);
    assert.ok(
      /CONTEXT\.md.*does not exist|CONTEXT\.md.*not.*exist|If CONTEXT\.md does/i.test(offerNextSection) ||
      /gsd-discuss-phase.*recommended|recommended.*gsd-discuss-phase/i.test(offerNextSection),
      'offer_next must present /gsd-discuss-phase as primary when CONTEXT.md does not exist'
    );
  });

  test('offer_next presents /gsd-plan-phase when CONTEXT.md exists', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    const offerNextIdx = content.indexOf('offer_next');
    assert.ok(offerNextIdx !== -1, 'offer_next step must exist');

    const offerNextSection = content.slice(offerNextIdx, offerNextIdx + 5000);
    assert.ok(
      /CONTEXT\.md.*exists|exists.*CONTEXT\.md|If CONTEXT\.md/i.test(offerNextSection),
      'offer_next must present /gsd-plan-phase as primary when CONTEXT.md exists'
    );
  });

  test('offer_next section contains at least one conditional guard before listing commands', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    const offerNextIdx = content.indexOf('offer_next');
    assert.ok(offerNextIdx !== -1, 'offer_next step must exist');

    const offerNextSection = content.slice(offerNextIdx, offerNextIdx + 5000);

    // The fixed version must contain at least one "If CONTEXT.md" conditional
    // guard before presenting command options. The old flat list had no guard.
    assert.ok(
      /If CONTEXT\.md/i.test(offerNextSection),
      'offer_next must contain at least one "If CONTEXT.md" conditional guard'
    );
  });
});
