/**
 * Regression test for bug #3360.
 *
 * Codex does not expose Claude Code's literal
 * `Agent(... isolation="worktree")` parameter, but Codex-managed subagent
 * workspaces preserve the contract that executors do not edit the
 * orchestrator checkout. The execute-phase workflow must not fail closed
 * solely because runtime=codex and workflow.use_worktrees=true.
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
        hasStaleCodexWorktreeGuard: body.includes('Codex execute-phase worktree isolation is unsupported'),
        codexManagedWorkspaceGuidance: body.includes('Codex-managed subagent workspace isolation'),
        codexNoMainCheckoutFallback: body.includes('If a future Codex session does not expose `spawn_agent`'),
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
    initializeHasStaleCodexWorktreeGuard: initialize.hasStaleCodexWorktreeGuard,
    initializeHasCodexManagedWorkspaceGuidance: initialize.codexManagedWorkspaceGuidance,
    initializeHasCodexNoMainCheckoutFallback: initialize.codexNoMainCheckoutFallback,
    guardStepPrecedesWorktreeDispatch: initializeIndex <= firstWorktreeDispatchIndex,
  };
}

describe('#3360 — Codex execute-phase preserves worktree-mode subagent isolation', () => {
  test('execute-phase reads runtime before worktree dispatch and allows Codex managed workspaces', () => {
    const workflow = fs.readFileSync(EXECUTE_PHASE, 'utf8');
    const contract = executePhaseWorktreeContract(workflow);

    assert.deepEqual(contract, {
      initializeReadsRuntimeConfig: true,
      initializeHasStaleCodexWorktreeGuard: false,
      initializeHasCodexManagedWorkspaceGuidance: true,
      initializeHasCodexNoMainCheckoutFallback: true,
      guardStepPrecedesWorktreeDispatch: true,
    });
  });

  test('Codex adapter maps worktree isolation to managed subagent workspaces', () => {
    const header = getCodexSkillAdapterHeader('gsd-execute-phase');
    assert.match(header, /isolation="worktree"/);
    assert.match(header, /Codex-managed subagent workspace isolation/i);
    assert.match(header, /Do not fail closed solely because `runtime=codex`/);
    assert.match(header, /no managed workspace\/subagent tool/i);
    assert.doesNotMatch(header, /no direct Codex mapping/i);
  });
});
