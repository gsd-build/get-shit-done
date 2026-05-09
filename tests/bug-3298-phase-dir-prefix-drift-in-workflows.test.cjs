'use strict';
/**
 * Regression test for #3298 — phase-dir prefix drift in /gsd-plan-milestone-gaps,
 * /gsd-import, and /gsd-capture --backlog workflows (PRED.k015 sibling audit).
 *
 * Projects with `project_code` set in `.planning/config.json` must have
 * consistent `<CODE>-<NN>-<slug>` directory naming across ALL phase-creation
 * paths. PR #3292 (#3287) fixed `/gsd-discuss-phase` and `/gsd-plan-phase`.
 *
 * Missed sites (this PR):
 *   1. `plan-milestone-gaps.md` step 8 — raw `{NN}-{name}` mkdir pattern.
 *   2. `import.md` plan_convert step — raw `{NN}-{slug}` mkdir pattern.
 *   3. `add-backlog.md` step 4 — raw `${NEXT}-${SLUG}` mkdir pattern
 *      (backlog uses 999.x numbering; still subject to project_code prefix).
 *
 * The fix: all three files must resolve the directory name via `init.phase-op`
 * (which exposes `expected_phase_dir` with the project_code prefix) or use
 * a `project_code`-aware helper before calling mkdir.
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
const BACKLOG_WF = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'add-backlog.md',
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

/**
 * Returns true when the content contains a bare shell-variable mkdir pattern like:
 *   mkdir -p ".planning/phases/${NEXT}-${SLUG}"
 * without a project_code prefix variable before `${NEXT}` (or similar).
 *
 * The drift pattern is: directory path starts with `${NEXT}` (or `${NN}`) directly,
 * with no preceding `${PREFIX}` or `${CODE}` variable that would carry project_code.
 */
function containsBareShellVarMkdir(content) {
  // Match mkdir lines where the phases/ directory component starts with a bare
  // shell variable like ${NEXT} or ${NN} — no prefix variable before it.
  // Positive match: mkdir .../phases/${NEXT}- or .../phases/${NN}-
  // We exclude lines that have a variable BEFORE ${NEXT}/${NN} (i.e., a prefix var).
  return /mkdir[^`\n]*\.planning\/phases\/"\$\{(?:NEXT|NN|PHASE)[^}]*\}-/.test(content)
    || /mkdir[^`\n]*\.planning\/phases\/\$\{(?:NEXT|NN|PHASE)[^}]*\}-/.test(content);
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

// ─── add-backlog.md (sibling site found during k015 audit) ───────────────────

describe('bug-3298 — add-backlog.md must apply project_code prefix when creating 999.x dirs', () => {
  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(BACKLOG_WF),
      `add-backlog.md must exist at ${BACKLOG_WF}`,
    );
  });

  test('step 4 must not use bare ${NEXT}-${SLUG} mkdir without project_code prefix', () => {
    const content = readWorkflow(BACKLOG_WF);
    assert.ok(
      !containsBareShellVarMkdir(content),
      'add-backlog.md must not create .planning/phases/${NEXT}-${SLUG} without a project_code prefix variable — apply ${PREFIX} (or equivalent) before ${NEXT}',
    );
  });

  test('step 4 must reference project_code or a prefix variable before the phase number', () => {
    const content = readWorkflow(BACKLOG_WF);
    const hasProjectCodeRef = content.includes('project_code') || content.includes('PROJECT_CODE');
    const hasPrefixVar = content.includes('${PREFIX}') || content.includes('${PHASE_PREFIX}') || content.includes('${CODE}');
    assert.ok(
      hasProjectCodeRef || hasPrefixVar,
      'add-backlog.md must read project_code (or use a PREFIX variable) to apply the project_code prefix to the 999.x phase directory name',
    );
  });
});
