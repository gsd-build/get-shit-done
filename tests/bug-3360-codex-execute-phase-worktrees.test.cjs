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

describe('#3360 — Codex execute-phase fails closed for unsupported worktree isolation', () => {
  test('execute-phase reads runtime before worktree dispatch and blocks Codex worktree mode', () => {
    const workflow = fs.readFileSync(EXECUTE_PHASE, 'utf8');
    const runtimeIdx = workflow.indexOf('RUNTIME=$(gsd-sdk query config-get runtime --default claude');
    const guardIdx = workflow.indexOf('Codex execute-phase worktree isolation is unsupported');
    const worktreeDispatchIdx = workflow.indexOf('isolation="worktree"');

    assert.notEqual(runtimeIdx, -1, 'workflow must read runtime before dispatch');
    assert.notEqual(guardIdx, -1, 'workflow must fail closed for Codex + worktrees');
    assert.notEqual(worktreeDispatchIdx, -1, 'test expects the Claude worktree dispatch path to exist');
    assert.ok(
      runtimeIdx < guardIdx && guardIdx < worktreeDispatchIdx,
      'Codex worktree guard must run before any isolation="worktree" dispatch guidance',
    );
  });

  test('Codex adapter documents that worktree isolation has no direct spawn_agent mapping', () => {
    const header = getCodexSkillAdapterHeader('gsd-execute-phase');
    assert.match(header, /isolation="worktree"/);
    assert.match(header, /no direct Codex mapping/i);
  });
});
