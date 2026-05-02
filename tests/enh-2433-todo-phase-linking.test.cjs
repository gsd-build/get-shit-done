'use strict';

// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Tests for gsd-new-milestone todo-to-phase linking (#2433).
 * Verifies the workflow text contains the correct linking and auto-close steps.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const NEW_MILESTONE = fs.readFileSync(
  path.join(ROOT, 'get-shit-done/workflows/new-milestone.md'), 'utf-8'
);
const EXECUTE_PHASE = fs.readFileSync(
  path.join(ROOT, 'get-shit-done/workflows/execute-phase.md'), 'utf-8'
);

test('new-milestone.md: step 10.5 links pending todos to roadmap phases', () => {
  assert.ok(NEW_MILESTONE.includes('10.5'), 'step 10.5 should exist');
  assert.ok(NEW_MILESTONE.includes('resolves_phase'), 'should reference resolves_phase field');
  assert.ok(NEW_MILESTONE.includes('.planning/todos/pending'), 'should scan pending todos directory');
});

test('new-milestone.md: todo linking runs after roadmap commit', () => {
  const roadmapCommitIdx = NEW_MILESTONE.indexOf('docs: create milestone v[X.Y] roadmap');
  const step105Idx = NEW_MILESTONE.indexOf('10.5. Link Pending Todos');
  const step11Idx = NEW_MILESTONE.indexOf('## 11. Done');
  assert.ok(roadmapCommitIdx < step105Idx, 'step 10.5 should come after roadmap commit');
  assert.ok(step105Idx < step11Idx, 'step 10.5 should come before step 11');
});

test('new-milestone.md: todo linking is best-effort and leaves unmatched todos unmodified', () => {
  assert.ok(NEW_MILESTONE.includes('best-effort'), 'should describe best-effort matching');
  assert.ok(NEW_MILESTONE.includes('unmatched'), 'should mention leaving unmatched todos alone');
  assert.ok(NEW_MILESTONE.includes('confident match'), 'should gate on confident match');
});

test('new-milestone.md: step 10.5 commits tagged todos', () => {
  assert.ok(NEW_MILESTONE.includes('gsd-sdk query commit'), 'should commit tagged todos');
  assert.ok(NEW_MILESTONE.includes('resolves_phase after milestone'), 'commit message should mention resolves_phase');
});

test('new-milestone.md: success_criteria includes todo linking', () => {
  assert.ok(NEW_MILESTONE.includes('resolves_phase: N'), 'success_criteria should mention resolves_phase tagging');
});

test('execute-phase.md: close_phase_todos step exists', () => {
  assert.ok(EXECUTE_PHASE.includes('close_phase_todos'), 'close_phase_todos step should exist');
  assert.ok(EXECUTE_PHASE.includes('resolves_phase'), 'should check resolves_phase in todos');
});

test('execute-phase.md: auto-close moves todos to completed directory', () => {
  assert.ok(EXECUTE_PHASE.includes('.planning/todos/completed'), 'should move to completed dir');
  assert.ok(EXECUTE_PHASE.includes('.planning/todos/pending'), 'should scan pending dir');
  assert.ok(EXECUTE_PHASE.includes('mv "$TODO_FILE" "$COMPLETED_DIR/"'), 'should use mv to move files');
});

test('execute-phase.md: close_phase_todos runs after update_roadmap', () => {
  const updateRoadmapIdx = EXECUTE_PHASE.indexOf('name="update_roadmap"');
  const closeTodosIdx = EXECUTE_PHASE.indexOf('name="close_phase_todos"');
  assert.ok(updateRoadmapIdx < closeTodosIdx, 'close_phase_todos should run after update_roadmap');
});

test('execute-phase.md: auto-close never blocks phase completion', () => {
  const closeTodosSection = EXECUTE_PHASE.slice(
    EXECUTE_PHASE.indexOf('name="close_phase_todos"'),
    EXECUTE_PHASE.indexOf('name="update_project_md"')
  );
  assert.ok(
    closeTodosSection.includes('never blocks') || closeTodosSection.includes('additive'),
    'close_phase_todos should be non-blocking'
  );
});

test('execute-phase.md: awk extracts resolves_phase from YAML frontmatter', () => {
  assert.ok(EXECUTE_PHASE.includes('awk'), 'should use awk for frontmatter extraction');
  assert.ok(EXECUTE_PHASE.includes('resolves_phase:'), 'awk pattern should match resolves_phase key');
});
