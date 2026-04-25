/**
 * GSD Tools Tests — Bug #2630
 *
 * Regression guard: `state milestone-switch` resets STATE.md YAML frontmatter
 * (milestone, milestone_name, status, progress.*) AND the `## Current Position`
 * body in a single atomic write. Prior to the fix, the `/gsd:new-milestone`
 * workflow rewrote the body but left the frontmatter pointing at the previous
 * milestone, so every downstream reader (state.json, getMilestoneInfo, etc.)
 * reported the stale milestone.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const STALE_STATE = `---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Foundation
status: completed
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Current Position

Phase: 5 (Foundation) — COMPLETED
Plan: 3 of 3
Status: v1.0 milestone complete
Last activity: 2026-04-20 -- v1.0 shipped

## Accumulated Context

### Decisions

- [Phase 1]: Use Node 20
`;

describe('state milestone-switch (#2630)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      STALE_STATE,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'ROADMAP.md'),
      '# Roadmap\n\n## v1.1 Notifications\n\n### Phase 6: Notify\n',
      'utf-8',
    );
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'config.json'),
      '{}',
      'utf-8',
    );
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('writes new milestone into frontmatter and resets progress + Current Position', () => {
    const result = runGsdTools(
      ['state', 'milestone-switch', '--milestone', 'v1.1', '--name', 'Notifications'],
      tmpDir,
    );
    assert.equal(result.success, true, result.error || result.output);

    const after = fs.readFileSync(
      path.join(tmpDir, '.planning', 'STATE.md'),
      'utf-8',
    );

    // Frontmatter reflects the NEW milestone — the core of bug #2630.
    assert.match(after, /^milestone:\s*v1\.1\s*$/m, 'frontmatter milestone not switched');
    assert.match(
      after,
      /^milestone_name:\s*Notifications\s*$/m,
      'frontmatter milestone_name not switched',
    );
    assert.match(after, /^status:\s*planning\s*$/m, 'status not reset to planning');
    // Progress counters reset to zero.
    assert.match(after, /^\s*completed_phases:\s*0\s*$/m, 'completed_phases not reset');
    assert.match(after, /^\s*completed_plans:\s*0\s*$/m, 'completed_plans not reset');
    assert.match(after, /^\s*percent:\s*0\s*$/m, 'percent not reset');

    // Body Current Position reset to the new-milestone template.
    assert.match(after, /Status:\s*Defining requirements/, 'body Status not reset');
    assert.match(
      after,
      /Phase:\s*Not started \(defining requirements\)/,
      'body Phase not reset',
    );

    // Accumulated Context is preserved.
    assert.match(after, /\[Phase 1\]:\s*Use Node 20/, 'Accumulated Context lost');
  });

  test('rejects missing --milestone', () => {
    const result = runGsdTools(
      ['state', 'milestone-switch', '--name', 'Something'],
      tmpDir,
    );
    // gsd-tools emits JSON with { error: ... } to stdout even on error paths.
    const combined = (result.output || '') + (result.error || '');
    assert.match(combined, /milestone required/i);
  });
});
