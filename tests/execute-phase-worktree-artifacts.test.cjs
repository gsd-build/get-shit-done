/**
 * Execute-phase worktree shared artifact ownership tests
 *
 * Guards against bug #1571: worktree executor agents independently writing
 * STATE.md and ROADMAP.md, causing last-merge-wins overwrites.
 *
 * Fix: In parallel worktree mode, remove STATE.md/ROADMAP.md update requirements
 * from the executor agent success_criteria. The orchestrator owns those writes
 * after each wave via single-writer post-wave commands.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');

describe('execute-phase worktree: shared artifact ownership (#1571)', () => {
  test('workflow file exists', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'workflows/execute-phase.md should exist');
  });

  test('worktree executor agent success_criteria does NOT include STATE.md update', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

    // Extract the worktree Task() block (between "Worktree mode" and "Sequential mode")
    const worktreeMatch = content.match(
      /\*\*Worktree mode\*\*[\s\S]*?<success_criteria>([\s\S]*?)<\/success_criteria>/
    );
    assert.ok(worktreeMatch, 'should find success_criteria inside the worktree mode Task block');

    const criteria = worktreeMatch[1];
    assert.ok(
      !criteria.includes('STATE.md'),
      'worktree executor success_criteria must NOT reference STATE.md (orchestrator owns this write)'
    );
  });

  test('worktree executor agent success_criteria does NOT include ROADMAP.md update', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

    // Extract the worktree Task() block
    const worktreeMatch = content.match(
      /\*\*Worktree mode\*\*[\s\S]*?<success_criteria>([\s\S]*?)<\/success_criteria>/
    );
    assert.ok(worktreeMatch, 'should find success_criteria inside the worktree mode Task block');

    const criteria = worktreeMatch[1];
    assert.ok(
      !criteria.includes('ROADMAP.md'),
      'worktree executor success_criteria must NOT reference ROADMAP.md (orchestrator owns this write)'
    );
  });

  test('worktree executor agent success_criteria includes SUMMARY.md creation', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

    // SUMMARY.md is plan-local and safe for worktree agents to create
    const worktreeMatch = content.match(
      /\*\*Worktree mode\*\*[\s\S]*?<success_criteria>([\s\S]*?)<\/success_criteria>/
    );
    assert.ok(worktreeMatch, 'should find success_criteria inside the worktree mode Task block');

    const criteria = worktreeMatch[1];
    assert.ok(
      criteria.includes('SUMMARY.md'),
      'worktree executor success_criteria should still require SUMMARY.md creation'
    );
  });

  test('post-wave orchestrator runs roadmap update-plan-progress for each completed plan', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      content.includes('roadmap update-plan-progress'),
      'post-wave section should contain orchestrator-owned roadmap update-plan-progress command'
    );
    // Confirm it is in a post-wave context, not only inside an agent prompt
    const postWaveIdx = content.indexOf('roadmap update-plan-progress');
    const worktreeAgentStart = content.indexOf('isolation="worktree"');
    const worktreeAgentEnd = content.indexOf('**Sequential mode**');
    assert.ok(
      postWaveIdx < worktreeAgentStart || postWaveIdx > worktreeAgentEnd,
      'roadmap update-plan-progress must appear outside the worktree agent prompt (orchestrator-owned)'
    );
  });

  test('ghost state update-position command removed from post-wave section (#1627)', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    assert.ok(
      !content.includes('state update-position'),
      'state update-position was a ghost reference (command never existed in CLI dispatcher) — should be removed'
    );
  });

  test('sequential mode executor agent success_criteria still includes STATE.md update', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

    // Extract the sequential mode Task() block
    const seqMatch = content.match(
      /\*\*Sequential mode\*\*[\s\S]*?<success_criteria>([\s\S]*?)<\/success_criteria>/
    );
    assert.ok(seqMatch, 'should find success_criteria inside the sequential mode Task block');

    const criteria = seqMatch[1];
    assert.ok(
      criteria.includes('STATE.md'),
      'sequential executor success_criteria should still require STATE.md update (no conflict risk)'
    );
  });

  test('sequential mode executor agent success_criteria still includes ROADMAP.md update', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');

    // Extract the sequential mode Task() block
    const seqMatch = content.match(
      /\*\*Sequential mode\*\*[\s\S]*?<success_criteria>([\s\S]*?)<\/success_criteria>/
    );
    assert.ok(seqMatch, 'should find success_criteria inside the sequential mode Task block');

    const criteria = seqMatch[1];
    assert.ok(
      criteria.includes('ROADMAP.md'),
      'sequential executor success_criteria should still require ROADMAP.md update (no conflict risk)'
    );
  });
});
