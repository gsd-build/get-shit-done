/**
 * Regression tests for bug #2661:
 *   `/gsd-execute-phase N --auto` with parallelization: true, use_worktrees: false
 *   left ROADMAP plan checkboxes unchecked until a manual
 *   `roadmap update-plan-progress` was run.
 *
 * Root cause (workflow-level): execute-plan.md Checkpoint A was wrapped in a
 * "Skip in parallel mode" guard that also short-circuited the
 * parallelization-without-worktrees case, leaving Checkpoint B (worktree-merge
 * post-step) and Checkpoint C (phase.complete) as the only syncs.
 *
 * Fix: remove the guard — make Checkpoint A unconditional. The handler is
 * idempotent and atomically serialized via readModifyWriteRoadmapMd's lockfile.
 *
 * These tests exercise the handler directly (the workflow change is markdown
 * that drives an LLM prompt and cannot be meaningfully unit-tested end-to-end)
 * plus a structural assertion that the guard is gone from the workflow.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runGsdTools, createTempProject, cleanup } = require('./helpers.cjs');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-plan.md');

function writeRoadmap(tmpDir, content) {
  fs.writeFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), content);
}

function readRoadmap(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, '.planning', 'ROADMAP.md'), 'utf-8');
}

function seedPhase(tmpDir, phaseNum, planIds, summaryIds) {
  const phaseDir = path.join(tmpDir, '.planning', 'phases', `${String(phaseNum).padStart(2, '0')}-test`);
  fs.mkdirSync(phaseDir, { recursive: true });
  for (const id of planIds) {
    fs.writeFileSync(path.join(phaseDir, `${id}-PLAN.md`), `# Plan ${id}`);
  }
  for (const id of summaryIds) {
    fs.writeFileSync(path.join(phaseDir, `${id}-SUMMARY.md`), `# Summary ${id}`);
  }
}

const THREE_PLAN_ROADMAP = `# Roadmap

- [ ] Phase 1: Test phase with three parallel plans
  - [ ] 01-01-PLAN.md
  - [ ] 01-02-PLAN.md
  - [ ] 01-03-PLAN.md

### Phase 1: Test
**Goal:** Parallel execution regression test
**Plans:** 3 plans

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Test | v1.0 | 0/3 | Planned |  |
`;

// ─── Structural: workflow guard removed ──────────────────────────────────────

describe('bug #2661: execute-plan.md Checkpoint A guard removed', () => {
  test('update_roadmap step does not skip in parallel mode', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
    const stepMatch = content.match(
      /<step name="update_roadmap">([\s\S]*?)<\/step>/
    );
    assert.ok(stepMatch, 'update_roadmap step must exist');
    const step = stepMatch[1];

    assert.ok(
      !/Skip (in parallel|this step if running in parallel)/i.test(step),
      'update_roadmap must no longer instruct the agent to skip in parallel mode'
    );
    assert.ok(
      !/IS_WORKTREE/.test(step),
      'update_roadmap must no longer gate the sync on an IS_WORKTREE branch'
    );
    assert.ok(
      /gsd-sdk query roadmap\.update-plan-progress/.test(step),
      'update_roadmap must still invoke roadmap.update-plan-progress'
    );
  });
});

// ─── Handler-level: idempotence + multi-plan sync ────────────────────────────

describe('bug #2661: roadmap update-plan-progress handler', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject('gsd-2661-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('three parallel SUMMARY.md files produce three [x] plan checkboxes', () => {
    writeRoadmap(tmpDir, THREE_PLAN_ROADMAP);
    seedPhase(tmpDir, 1, ['01-01', '01-02', '01-03'], ['01-01', '01-02', '01-03']);

    const result = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(result.success, `handler failed: ${result.error}`);

    const roadmap = readRoadmap(tmpDir);
    assert.ok(roadmap.includes('[x] 01-01-PLAN.md'), 'plan 01-01 should be checked');
    assert.ok(roadmap.includes('[x] 01-02-PLAN.md'), 'plan 01-02 should be checked');
    assert.ok(roadmap.includes('[x] 01-03-PLAN.md'), 'plan 01-03 should be checked');
    assert.ok(roadmap.includes('3/3'), 'progress row should reflect 3/3');
  });

  test('handler is idempotent — second call produces identical content', () => {
    writeRoadmap(tmpDir, THREE_PLAN_ROADMAP);
    seedPhase(tmpDir, 1, ['01-01', '01-02', '01-03'], ['01-01', '01-02', '01-03']);

    const first = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(first.success, first.error);
    const afterFirst = readRoadmap(tmpDir);

    const second = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(second.success, second.error);
    const afterSecond = readRoadmap(tmpDir);

    assert.strictEqual(afterSecond, afterFirst,
      'repeated invocation must not mutate ROADMAP.md further (idempotent)');
  });

  test('partial completion: only plans with SUMMARY.md get [x]', () => {
    writeRoadmap(tmpDir, THREE_PLAN_ROADMAP);
    // Only plan 01-02 has a SUMMARY.md
    seedPhase(tmpDir, 1, ['01-01', '01-02', '01-03'], ['01-02']);

    const result = runGsdTools('roadmap update-plan-progress 1', tmpDir);
    assert.ok(result.success, result.error);

    const roadmap = readRoadmap(tmpDir);
    assert.ok(roadmap.includes('[ ] 01-01-PLAN.md'), 'plan 01-01 should remain unchecked');
    assert.ok(roadmap.includes('[x] 01-02-PLAN.md'), 'plan 01-02 should be checked');
    assert.ok(roadmap.includes('[ ] 01-03-PLAN.md'), 'plan 01-03 should remain unchecked');
    assert.ok(roadmap.includes('1/3'), 'progress row should reflect 1/3');
  });

  test('concurrent handler invocations do not corrupt ROADMAP.md', async () => {
    writeRoadmap(tmpDir, THREE_PLAN_ROADMAP);
    seedPhase(tmpDir, 1, ['01-01', '01-02', '01-03'], ['01-01', '01-02', '01-03']);

    // Simulate Checkpoint A firing concurrently from three parallel plans.
    const invocations = Array.from({ length: 3 }, () =>
      new Promise((resolve) => {
        const r = runGsdTools('roadmap update-plan-progress 1', tmpDir);
        resolve(r);
      })
    );
    const results = await Promise.all(invocations);

    for (const r of results) {
      assert.ok(r.success, `concurrent handler invocation failed: ${r.error}`);
    }

    const roadmap = readRoadmap(tmpDir);
    // Structural integrity: each checkbox appears exactly once, progress row intact.
    for (const id of ['01-01', '01-02', '01-03']) {
      const occurrences = roadmap.split(`[x] ${id}-PLAN.md`).length - 1;
      assert.strictEqual(occurrences, 1,
        `plan ${id} checkbox should appear exactly once (got ${occurrences})`);
    }
    assert.ok(roadmap.includes('3/3'), 'progress row should reflect 3/3 after concurrent runs');
    // Lockfile should have been cleaned up after the final release.
    assert.ok(
      !fs.existsSync(path.join(tmpDir, '.planning', 'ROADMAP.md.lock')),
      'ROADMAP.md.lock should be released after concurrent invocations settle'
    );
  });
});
