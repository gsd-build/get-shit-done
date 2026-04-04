/**
 * GSD Worktree Sequential Dispatch Tests
 *
 * Validates that execute-phase workflow includes sequential dispatch
 * instructions to prevent git config.lock contention when multiple
 * agents create worktrees in parallel within the same wave.
 *
 * See: https://github.com/gsd-build/get-shit-done/issues/1511
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, '..', 'get-shit-done', 'workflows');

describe('worktree sequential dispatch', () => {
  const executePhasePath = path.join(WORKFLOWS_DIR, 'execute-phase.md');
  let content;

  test('execute-phase.md exists', () => {
    assert.ok(fs.existsSync(executePhasePath), 'execute-phase.md should exist');
  });

  test('execute-phase explains git config.lock contention', () => {
    content = fs.readFileSync(executePhasePath, 'utf-8');
    assert.ok(
      content.includes('config.lock'),
      'execute-phase.md should explain the git config.lock race condition'
    );
  });

  test('execute-phase requires sequential dispatch with run_in_background', () => {
    content = content || fs.readFileSync(executePhasePath, 'utf-8');
    assert.ok(
      content.includes('run_in_background'),
      'execute-phase.md should instruct one-at-a-time dispatch with run_in_background'
    );
  });

  test('execute-phase warns against multiple Task calls in single message', () => {
    content = content || fs.readFileSync(executePhasePath, 'utf-8');
    assert.ok(
      content.includes('WRONG') && content.includes('single message'),
      'execute-phase.md should warn against sending multiple Task() calls simultaneously'
    );
  });
});
