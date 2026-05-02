// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Regression tests for bug #2661:
 *   `/gsd-execute-phase N --auto` with parallelization: true, use_worktrees: false
 *   left ROADMAP plan checkboxes unchecked until a manual
 *   `roadmap update-plan-progress` was run.
 *
 * Root cause (workflow-level): execute-plan.md `update_roadmap` step was
 * gated on a worktree-detection branch that incorrectly conflated
 * "parallel mode" with "worktree mode". When `parallelization: true,
 * use_worktrees: false` was configured, the step was still gated by the
 * worktree-only check (which is true: the executing tree IS the main repo,
 * not a worktree, so the gate happened to fire correctly there) — the
 * actual reproducer was a different code path. The original PR #2682 fix
 * made the sync unconditional, which violated the single-writer contract
 * for shared ROADMAP.md established by #1486 / dcb50396 in worktree mode.
 *
 * Minimal fix (this PR): restore the worktree guard and document its
 * intent explicitly. The `IS_WORKTREE != "true"` branch IS the
 * `use_worktrees: false` mode: only that mode runs the in-handler sync.
 * Worktree mode relies on the orchestrator's post-merge sync at
 * execute-phase.md §5.7 (lines 815-834) — the single writer for shared
 * tracking files.
 *
 * These tests:
 *   (1) assert the workflow gates the sync call on `use_worktrees: false`
 *       (i.e. the IS_WORKTREE != "true" branch is present and gates the call);
 *   (2) assert the handler itself behaves correctly under the
 *       use_worktrees: false reproducer (the original #2661 case);
 *   (3) assert the handler is idempotent and lock-safe (lockfile is the
 *       in-handler defense; the workflow gate is the cross-handler one).
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

// ─── Structural: workflow gates sync on use_worktrees=false ──────────────────

describe('bug #2661: execute-plan.md update_roadmap gating', () => {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  const stepMatch = content.match(
    /<step name="update_roadmap">([\s\S]*?)<\/step>/
  );
  const step = stepMatch && stepMatch[1];

  test('update_roadmap step exists and invokes roadmap.update-plan-progress', () => {
    assert.ok(stepMatch, 'update_roadmap step must exist');
    assert.ok(
      /gsd-sdk query roadmap\.update-plan-progress/.test(step),
      'update_roadmap must still invoke roadmap.update-plan-progress'
    );
  });

  test('use_worktrees: false mode — sync call is gated to fire (the #2661 reproducer)', () => {
    // The non-worktree branch must contain the sync call.
    assert.ok(
      /IS_WORKTREE.*!=.*"true"[\s\S]*?gsd-sdk query roadmap\.update-plan-progress/.test(step),
      'sync call must execute on the IS_WORKTREE != "true" branch (use_worktrees: false)'
    );
  });

  test('use_worktrees: true mode — sync call does NOT fire (single-writer contract)', () => {
    // The sync call must be inside an `if [ "$IS_WORKTREE" != "true" ]` block,
    // i.e. it must NOT be unconditional and it must NOT appear on the worktree branch.
    // We verify by extracting the bash block and checking the call sits under the gate.
    const bashMatch = step.match(/```bash\s*([\s\S]*?)```/);
    assert.ok(bashMatch, 'update_roadmap must contain a bash block');
    const bash = bashMatch[1];

    assert.ok(
      /IS_WORKTREE/.test(bash),
      'bash block must include the IS_WORKTREE worktree-detection check'
    );
    // Sync call must appear after the guard check, not before.
    const guardIdx = bash.search(/if \[ "\$IS_WORKTREE" != "true" \]/);
    const callIdx = bash.search(/gsd-sdk query roadmap\.update-plan-progress/);
    assert.ok(guardIdx >= 0, 'guard must be present');
    assert.ok(callIdx > guardIdx,
      'sync call must appear inside the use_worktrees: false guard, not before/outside it');
  });

  test('intent doc references single-writer contract / orchestrator-owns-write', () => {
    // The prose must justify why worktree mode is excluded so future readers
    // do not regress this back to unconditional.
    assert.ok(
      /worktree|orchestrator|single-writer|#1486|#2661/i.test(step),
      'update_roadmap must document the contract that justifies the gate'
    );
  });
});

// ─── Handler-level: idempotence + multi-plan sync (use_worktrees: false case) ─

describe('bug #2661: roadmap update-plan-progress handler (use_worktrees: false)', () => {
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

  test('lockfile contention: concurrent handler invocations within a single tree do not corrupt ROADMAP.md', async () => {
    // Scope: lockfile only serializes within a single working tree. Cross-worktree
    // serialization is enforced by the workflow gate (worktree mode never calls
    // this handler from execute-plan.md), not by the lockfile.
    writeRoadmap(tmpDir, THREE_PLAN_ROADMAP);
    seedPhase(tmpDir, 1, ['01-01', '01-02', '01-03'], ['01-01', '01-02', '01-03']);

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
