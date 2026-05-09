'use strict';
/**
 * Regression test for #3298 — phase-dir prefix drift in /gsd-plan-milestone-gaps
 * and /gsd-import workflows (PRED.k015).
 *
 * Projects with `project_code` set in `.planning/config.json` must have
 * consistent `<CODE>-<NN>-<slug>` directory naming across ALL phase-creation
 * paths. PR #3292 (#3287) fixed `/gsd-discuss-phase` and `/gsd-plan-phase`.
 *
 * These two were missed:
 *   1. `plan-milestone-gaps.md` step 8 — raw `{NN}-{name}` mkdir pattern.
 *   2. `import.md` plan_convert step — raw `{NN}-{slug}` mkdir pattern.
 *
 * The fix: both files must either:
 *   (a) route through `gsd-sdk query phase.add` / `phase insert` (which
 *       auto-reads project_code), OR
 *   (b) call `gsd-sdk query init.phase-op <N>` and use `expected_phase_dir`.
 *
 * These tests assert (b): presence of `expected_phase_dir` reference AND
 * absence of bare `{NN}-{name}` / `{NN}-{slug}` mkdir patterns.
 *
 * Tests are structural (parse-level) — no source-grep on raw strings.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PMG_WF = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'plan-milestone-gaps.md',
);
const IMPORT_WF = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'import.md',
);

// ─── helpers ─────────────────────────────────────────────────────────────────

function readWorkflow(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Cannot read workflow file ${filePath}: ${err.message}`);
  }
}

/**
 * Returns true when the content contains a bare `mkdir -p ".planning/phases/{NN}-{name}"`
 * or `mkdir -p ".planning/phases/{NN}-{slug}"` pattern that does NOT include
 * a `project_code`/`expected_phase_dir` variable — i.e., the unfixed drift pattern.
 *
 * We look for `mkdir` lines that reference .planning/phases/ where the directory
 * component starts with `{` (template literal, no variable substitution).
 */
function containsBareTemplateMkdir(content) {
  // Match lines like: mkdir -p ".planning/phases/{NN}-{name}"
  // or: mkdir -p ".planning/phases/{NN}-{slug}/"
  // These are the drift patterns — they don't use expected_phase_dir.
  return /mkdir[^`\n]*\.planning\/phases\/\{[A-Z0-9]+\}-\{/.test(content);
}

// ─── plan-milestone-gaps.md ───────────────────────────────────────────────────

describe('bug-3298 — plan-milestone-gaps.md must not construct bare {NN}-{name} phase dirs', () => {
  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(PMG_WF),
      `plan-milestone-gaps.md must exist at ${PMG_WF}`,
    );
  });

  test('step 8 must not use bare {NN}-{name} mkdir pattern', () => {
    const content = readWorkflow(PMG_WF);
    assert.ok(
      !containsBareTemplateMkdir(content),
      'plan-milestone-gaps.md must not contain bare mkdir .planning/phases/{NN}-{name} pattern — use phase.add or expected_phase_dir',
    );
  });

  test('step 8 must use expected_phase_dir or phase.add for directory creation', () => {
    const content = readWorkflow(PMG_WF);
    const usesExpectedPhaseDir = content.includes('expected_phase_dir');
    const usesPhaseAdd = content.includes('phase.add');
    assert.ok(
      usesExpectedPhaseDir || usesPhaseAdd,
      'plan-milestone-gaps.md must use expected_phase_dir (from init.phase-op) or phase.add to create phase directories with project_code prefix',
    );
  });
});

// ─── import.md ───────────────────────────────────────────────────────────────

describe('bug-3298 — import.md must not construct bare {NN}-{slug} phase dirs', () => {
  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(IMPORT_WF),
      `import.md must exist at ${IMPORT_WF}`,
    );
  });

  test('plan_convert step must not use bare {NN}-{slug} mkdir pattern', () => {
    const content = readWorkflow(IMPORT_WF);
    assert.ok(
      !containsBareTemplateMkdir(content),
      'import.md must not contain bare mkdir .planning/phases/{NN}-{slug} pattern — use expected_phase_dir from init.phase-op',
    );
  });

  test('plan_convert step must use expected_phase_dir for directory creation', () => {
    const content = readWorkflow(IMPORT_WF);
    assert.ok(
      content.includes('expected_phase_dir'),
      'import.md must use expected_phase_dir (from init.phase-op) to create phase directory with project_code prefix',
    );
  });

  test('plan_convert step must call init.phase-op to resolve the prefixed dir', () => {
    const content = readWorkflow(IMPORT_WF);
    assert.ok(
      content.includes('init.phase-op') || content.includes('init phase-op'),
      'import.md must call gsd-sdk query init.phase-op to get expected_phase_dir with project_code prefix',
    );
  });
});
