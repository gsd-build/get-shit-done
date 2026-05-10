/**
 * Regression test for bug #3360.
 *
 * Codex does not have a direct equivalent of Claude Code's
 * `Agent(... isolation="worktree")`. The execute-phase workflow must fail
 * closed for Codex + workflow.use_worktrees=true instead of spawning
 * workspace-write executors in the main checkout.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const EXECUTE_PHASE = path.join(ROOT, 'get-shit-done', 'workflows', 'execute-phase.md');
const { getCodexSkillAdapterHeader } = require('../bin/install.js');

function parseWorkflowSteps(content) {
  return [...content.matchAll(/<step name="([^"]+)"[^>]*>([\s\S]*?)<\/step>/g)]
    .map((match) => {
      const body = match[2];
      return {
        name: match[1],
        readsRuntimeConfig: body.includes('RUNTIME=$(gsd-sdk query config-get runtime --default claude'),
        codexWorktreeGuard: body.includes('Codex execute-phase worktree isolation is unsupported'),
        worktreeDispatchGuidance: body.includes('isolation="worktree"'),
      };
    });
}

function executePhaseWorktreeContract(content) {
  const steps = parseWorkflowSteps(content);
  const initializeIndex = steps.findIndex((step) => step.name === 'initialize');
  const firstWorktreeDispatchIndex = steps.findIndex((step) => step.worktreeDispatchGuidance);
  assert.notEqual(initializeIndex, -1, 'workflow must have an initialize step');
  assert.notEqual(firstWorktreeDispatchIndex, -1, 'workflow must still document worktree dispatch guidance');

  const initialize = steps[initializeIndex];
  return {
    initializeReadsRuntimeConfig: initialize.readsRuntimeConfig,
    initializeHasCodexWorktreeGuard: initialize.codexWorktreeGuard,
    guardStepPrecedesWorktreeDispatch: initializeIndex <= firstWorktreeDispatchIndex,
  };
}

describe('#3360 — Codex execute-phase fails closed for unsupported worktree isolation', () => {
  test('execute-phase reads runtime before worktree dispatch and blocks Codex worktree mode', () => {
    const workflow = fs.readFileSync(EXECUTE_PHASE, 'utf8');
    const contract = executePhaseWorktreeContract(workflow);

    assert.deepEqual(contract, {
      initializeReadsRuntimeConfig: true,
      initializeHasCodexWorktreeGuard: true,
      guardStepPrecedesWorktreeDispatch: true,
    });
  });

  test('Codex adapter documents that worktree isolation has no direct spawn_agent mapping', () => {
    const header = getCodexSkillAdapterHeader('gsd-execute-phase');
    assert.match(header, /isolation="worktree"/);
    assert.match(header, /no direct Codex mapping/i);
  });
});
