// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression test for #2502: insert-phase does not update STATE.md's
 * next-phase recommendation after inserting a decimal phase.
 *
 * Root cause: insert-phase.md's update_project_state step only added a
 * "Roadmap Evolution" note to STATE.md, but never updated the "Current Phase"
 * / next-run recommendation to point at the newly inserted phase.
 *
 * Fix: insert-phase.md must include a step that updates STATE.md's next-phase
 * pointer (current_phase / next recommended run) to the newly inserted phase.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INSERT_PHASE_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'insert-phase.md'
);

describe('bug-2502: insert-phase must update STATE.md next-phase recommendation', () => {
  test('insert-phase.md exists', () => {
    assert.ok(fs.existsSync(INSERT_PHASE_PATH), 'insert-phase.md should exist');
  });

  test('insert-phase.md contains a STATE.md next-phase update instruction', () => {
    const content = fs.readFileSync(INSERT_PHASE_PATH, 'utf-8');

    // Must reference STATE.md and the concept of updating the next/current phase pointer
    const mentionsStateUpdate = (
      /STATE\.md.{0,200}(next.phase|current.phase|next.run|recommendation)/is.test(content) ||
      /(next.phase|current.phase|next.run|recommendation).{0,200}STATE\.md/is.test(content)
    );

    assert.ok(
      mentionsStateUpdate,
      'insert-phase.md must instruct updating STATE.md\'s next-phase recommendation to point to the newly inserted phase'
    );
  });

  test('insert-phase.md update_project_state step covers next-phase pointer', () => {
    const content = fs.readFileSync(INSERT_PHASE_PATH, 'utf-8');

    const stepMatch = content.match(/<step name="update_project_state">([\s\S]*?)<\/step>/i);
    assert.ok(stepMatch, 'insert-phase.md must contain update_project_state step');
    const stepContent = stepMatch[1];

    const hasNextPhasePointerUpdate = (
      /\bcurrent[_ -]?phase\b/i.test(stepContent) ||
      /\bnext[_ -]?phase\b/i.test(stepContent) ||
      /\bnext recommended run\b/i.test(stepContent)
    );

    assert.ok(
      hasNextPhasePointerUpdate,
      'insert-phase.md update_project_state step must update STATE.md\'s next-phase pointer (current_phase) to the inserted decimal phase'
    );
  });
});
