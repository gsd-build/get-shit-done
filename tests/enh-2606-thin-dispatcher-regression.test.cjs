'use strict';

/**
 * Regression guards for #2606: thin dispatcher shape.
 *
 * Asserts that commands/gsd/plan-phase.md retains its thin-dispatcher
 * structure and does not drift back to inline workflow loading.
 *
 * Closes: #2606
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PLAN_PHASE_CMD = path.join(__dirname, '..', 'commands', 'gsd', 'plan-phase.md');
const content = fs.readFileSync(PLAN_PHASE_CMD, 'utf-8');

// ─── Whole-file presence (TEST-01, TEST-02, TEST-04) ────────────────────────

describe('[presence] thin dispatcher invariants (#2606)', () => {
  test('contains general-purpose subagent type (TEST-01)', () => {
    assert.ok(
      content.includes('general-purpose'),
      'plan-phase.md must reference general-purpose subagent type'
    );
  });

  test('contains dispatch-state.json checkpoint reference (TEST-02)', () => {
    assert.ok(
      content.includes('dispatch-state.json'),
      'plan-phase.md must reference dispatch-state.json checkpoint file'
    );
  });

  test('contains all four valid last_completed values (TEST-04)', () => {
    for (const stage of ['"init"', '"research"', '"planning"', '"verification"']) {
      assert.ok(
        content.includes(stage),
        `plan-phase.md must contain last_completed value ${stage}`
      );
    }
  });
});

// ─── Frontmatter-scoped absence (TEST-05) ───────────────────────────────────

describe('[absence/frontmatter] no agent: key (#2606)', () => {
  test('frontmatter does not contain agent: (TEST-05)', () => {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\n---(?:\r?\n|$)/);
    assert.ok(fmMatch !== null, 'plan-phase.md must have a valid frontmatter block');
    const frontmatter = fmMatch[1];
    assert.ok(
      !/^agent:/m.test(frontmatter),
      'plan-phase.md must not have agent: in frontmatter (inert key removed in Phase 1)'
    );
  });
});

// ─── Block-scoped absence (TEST-03) ─────────────────────────────────────────

describe('[absence/block] no inline @file import in execution_context (#2606)', () => {
  test('file does not contain inline workflow @file import (TEST-03)', () => {
    assert.ok(
      !content.includes('@~/.claude/get-shit-done/workflows/plan-phase.md'),
      'plan-phase.md must not load workflow inline via @file anywhere in the file'
    );
  });
});
