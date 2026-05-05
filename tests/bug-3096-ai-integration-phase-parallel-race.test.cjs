'use strict';
// allow-test-rule: reads product workflow markdown (ai-integration-phase.md) to verify structural ordering contract — not a source-grep test

// Regression guard for bug #3096.
//
// ai-integration-phase.md listed Steps 7+8 (gsd-ai-researcher +
// gsd-domain-researcher) without an explicit sequential ordering constraint.
// An orchestrator optimizing for speed could reasonably parallelize them
// since the sections appeared disjoint. When parallelized, gsd-domain-researcher's
// Write call at finalization replaced the whole AI-SPEC.md file with its
// in-memory copy (pre-researcher state), silently overwriting Sections 3/4.
//
// Confirmed at 40% incidence rate on a real run (2 of 5 worktree agents hit it).
// Recovery cost: one extra ai-researcher dispatch (~18 min wall).
//
// Fix:
//   1. Explicit "MUST run sequentially" note on Steps 7 and 8
//   2. Edit-only tool discipline injected into both agent prompts

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(
  path.join(ROOT, 'get-shit-done', 'workflows', 'ai-integration-phase.md'),
  'utf8',
);

describe('bug #3096: ai-integration-phase sequential ordering and Edit-only discipline', () => {
  test('Step 7 documents sequential ordering requirement', () => {
    assert.ok(
      src.includes('sequentially') || src.includes('sequential'),
      'Steps 7+8 ordering note is missing — parallel dispatch race can recur',
    );
  });

  test('Step 7 gsd-ai-researcher prompt includes Edit-only tool discipline', () => {
    // The discipline block must appear before </objective> for gsd-ai-researcher
    const step7Idx = src.indexOf('## 7. Spawn gsd-ai-researcher');
    const step8Idx = src.indexOf('## 8. Spawn gsd-domain-researcher');
    assert.ok(step7Idx !== -1, 'Step 7 not found');
    assert.ok(step8Idx !== -1, 'Step 8 not found');
    const step7Block = src.slice(step7Idx, step8Idx);
    assert.ok(
      step7Block.includes('Edit tool') && step7Block.includes('NEVER use Write'),
      'Step 7 agent prompt missing Edit-only tool discipline',
    );
  });

  test('Step 8 gsd-domain-researcher prompt includes Edit-only tool discipline', () => {
    const step8Idx = src.indexOf('## 8. Spawn gsd-domain-researcher');
    const step9Idx = src.indexOf('## 9. Spawn gsd-eval-planner');
    assert.ok(step8Idx !== -1, 'Step 8 not found');
    assert.ok(step9Idx !== -1, 'Step 9 not found');
    const step8Block = src.slice(step8Idx, step9Idx);
    assert.ok(
      step8Block.includes('Edit tool') && step8Block.includes('NEVER use Write'),
      'Step 8 agent prompt missing Edit-only tool discipline',
    );
  });

  test('Step 8 references the wait instruction', () => {
    const step8Idx = src.indexOf('## 8. Spawn gsd-domain-researcher');
    const step9Idx = src.indexOf('## 9. Spawn gsd-eval-planner');
    const step8Block = src.slice(step8Idx, step9Idx);
    assert.ok(
      step8Block.includes('Wait') || step8Block.includes('wait') || step8Block.includes('complete'),
      'Step 8 does not instruct orchestrator to wait for Step 7',
    );
  });
});
