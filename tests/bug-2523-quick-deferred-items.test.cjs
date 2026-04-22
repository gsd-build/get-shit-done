/**
 * Regression test for bug #2523
 *
 * workflows/quick.md Step 8 ("Build file list") listed PLAN.md, SUMMARY.md,
 * STATE.md, and mode-conditional CONTEXT.md / RESEARCH.md / VERIFICATION.md —
 * but omitted deferred-items.md. When an executor logs out-of-scope findings
 * to ${QUICK_DIR}/${quick_id}-deferred-items.md during task execution, that
 * file was left untracked after the final commit even with commit_docs: true.
 *
 * Fix: add a file-existence-gated entry for deferred-items.md to Step 8.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

describe('bug #2523: quick-task final commit includes deferred-items.md', () => {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'get-shit-done/workflows/quick.md must exist');
  });

  test('Step 8 file list references deferred-items.md', () => {
    const step8Idx = content.indexOf('Step 8: Final commit');
    assert.notEqual(step8Idx, -1, 'Step 8 section must exist in quick.md');

    const step8Section = content.slice(step8Idx, step8Idx + 2000);
    assert.ok(
      step8Section.includes('deferred-items.md'),
      'Step 8 file list must include deferred-items.md. ' +
      'Without this, any out-of-scope findings logged by the executor to ' +
      '${QUICK_DIR}/${quick_id}-deferred-items.md are left untracked after commit (bug #2523).'
    );
  });

  test('deferred-items.md entry is conditional on file existence', () => {
    const deferredIdx = content.indexOf('deferred-items.md');
    assert.notEqual(deferredIdx, -1, 'deferred-items.md must be mentioned in the workflow');

    const surroundingContext = content.slice(Math.max(0, deferredIdx - 200), deferredIdx + 200);
    const isConditional =
      surroundingContext.toLowerCase().includes('exist') ||
      surroundingContext.toLowerCase().includes('if ');
    assert.ok(
      isConditional,
      'The deferred-items.md entry must be gated on file existence (not a mode flag). ' +
      'deferred-items.md can be created in any quick-task run, regardless of mode.'
    );
  });
});
