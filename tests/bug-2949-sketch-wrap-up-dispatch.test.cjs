// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * GSD Tests — /gsd-sketch --wrap-up silently no-ops (#2949)
 *
 * The --wrap-up flag was documented in commands/gsd/sketch.md but never dispatched.
 * The sketch-wrap-up.md micro-skill entry point was deleted in #2790 and the dispatch
 * wiring was never added to the command or workflow.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKETCH_COMMAND = path.join(ROOT, 'commands/gsd/sketch.md');
const SKETCH_WORKFLOW = path.join(ROOT, 'get-shit-done/workflows/sketch.md');

describe('bug-2949: sketch --wrap-up dispatch wiring', () => {
  test('commands/gsd/sketch.md contains --wrap-up dispatch logic', () => {
    const content = fs.readFileSync(SKETCH_COMMAND, 'utf8');
    assert.ok(
      content.includes('--wrap-up'),
      'sketch.md should contain --wrap-up dispatch logic'
    );
    // The dispatch should route to sketch-wrap-up workflow
    assert.ok(
      content.includes('sketch-wrap-up'),
      'sketch.md should reference sketch-wrap-up in dispatch logic'
    );
  });

  test('commands/gsd/sketch.md has sketch-wrap-up in execution_context section', () => {
    const content = fs.readFileSync(SKETCH_COMMAND, 'utf8');
    // Find execution_context block
    const execCtxMatch = content.match(/<execution_context>([\s\S]*?)<\/execution_context>/);
    assert.ok(execCtxMatch, 'sketch.md must have an <execution_context> block');
    const execCtx = execCtxMatch[1];
    assert.ok(
      execCtx.includes('sketch-wrap-up'),
      `execution_context block should include sketch-wrap-up workflow; got: ${execCtx}`
    );
  });

  test('workflows/sketch.md does NOT contain old /gsd-sketch-wrap-up form', () => {
    const content = fs.readFileSync(SKETCH_WORKFLOW, 'utf8');
    assert.ok(
      !content.includes('/gsd-sketch-wrap-up'),
      'workflows/sketch.md must not reference the old /gsd-sketch-wrap-up command'
    );
  });

  test('workflows/sketch.md DOES contain new /gsd-sketch --wrap-up form', () => {
    const content = fs.readFileSync(SKETCH_WORKFLOW, 'utf8');
    assert.ok(
      content.includes('/gsd-sketch --wrap-up'),
      'workflows/sketch.md should reference /gsd-sketch --wrap-up (the new form)'
    );
  });
});
