/**
 * GSD Quick Workflow — Commit Boundary Tests (#1503)
 *
 * Validates that the quick workflow correctly separates executor
 * responsibilities (code commits) from orchestrator responsibilities
 * (docs artifact commit), preventing PLAN.md from being left untracked
 * when the executor runs without worktree isolation.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

describe('quick workflow commit boundary (#1503)', () => {
  const quickPath = path.join(WORKFLOWS_DIR, 'quick.md');
  let content;

  test('quick.md exists', () => {
    assert.ok(fs.existsSync(quickPath), 'workflows/quick.md should exist');
    content = fs.readFileSync(quickPath, 'utf-8');
  });

  test('executor constraints prohibit committing docs artifacts', () => {
    assert.ok(
      content.includes('Do NOT commit docs artifacts'),
      'executor constraints should prohibit committing SUMMARY.md, STATE.md, PLAN.md'
    );
  });

  test('Step 8 explicitly stages artifacts with git add before commit', () => {
    assert.ok(
      content.includes('git add ${file_list}'),
      'Step 8 should explicitly git add the file list before gsd-tools commit'
    );
  });

  test('Step 8 includes PLAN.md in file list', () => {
    assert.ok(
      content.includes('${QUICK_DIR}/${quick_id}-PLAN.md'),
      'Step 8 file list must include PLAN.md'
    );
  });

  test('Step 8 runs unconditionally', () => {
    assert.ok(
      content.includes('MUST always run'),
      'Step 8 should state it must always run regardless of executor commits'
    );
  });
});
