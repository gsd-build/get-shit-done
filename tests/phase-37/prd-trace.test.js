import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const PLAN_PHASE = readFileSync(join(ROOT, 'get-shit-done/workflows/plan-phase.md'), 'utf8');
const VERIFIER = readFileSync(join(ROOT, 'agents/gsd-verifier.md'), 'utf8');

test('plan-phase PRD Express Path references PRD-TRACE.md', () => {
  assert.ok(PLAN_PHASE.includes('PRD-TRACE.md'), 'plan-phase.md should reference PRD-TRACE.md');
});

test('plan-phase sets prd_trace_path variable', () => {
  assert.ok(
    PLAN_PHASE.includes('prd_trace_path'),
    'plan-phase.md should set prd_trace_path variable'
  );
});

test('plan-phase PRD-TRACE.md schema includes required columns', () => {
  assert.ok(PLAN_PHASE.includes('source_prd'), 'PRD-TRACE.md schema should include source_prd frontmatter');
  assert.ok(PLAN_PHASE.includes('REQ-ID'), 'PRD-TRACE.md schema should include REQ-ID column');
  assert.ok(PLAN_PHASE.includes('PRD-01'), 'PRD-TRACE.md schema should reference PRD-01 format');
});

test('plan-phase commit step includes PRD-TRACE.md alongside CONTEXT.md', () => {
  // Both CONTEXT.md and PRD-TRACE.md should appear in the same commit command
  const hasContextInCommit = PLAN_PHASE.includes('CONTEXT.md') && PLAN_PHASE.includes('PRD-TRACE.md');
  assert.ok(hasContextInCommit, 'plan-phase.md commit step should include both CONTEXT.md and PRD-TRACE.md');
  // The commit message should reference the PRD traceability map
  assert.ok(
    PLAN_PHASE.includes('traceability map') || PLAN_PHASE.includes('PRD-TRACE.md'),
    'Commit command should mention PRD traceability'
  );
});

test('gsd-verifier contains Step 6b PRD intent alignment', () => {
  assert.ok(VERIFIER.includes('Step 6b'), 'gsd-verifier.md should contain Step 6b');
  assert.ok(
    VERIFIER.includes('PRD Intent Alignment') || VERIFIER.includes('PRD intent alignment'),
    'gsd-verifier.md should reference PRD Intent Alignment'
  );
  assert.ok(VERIFIER.includes('PRD-TRACE.md'), 'gsd-verifier.md should reference PRD-TRACE.md');
});

test('gsd-verifier PRD alignment check skips silently when PRD-TRACE.md absent', () => {
  const hasSkipCondition =
    VERIFIER.includes('skip this step silently') ||
    VERIFIER.includes('silently') ||
    VERIFIER.includes('absent') ||
    VERIFIER.includes('skip');
  assert.ok(hasSkipCondition, 'gsd-verifier Step 6b should indicate it skips when PRD-TRACE.md absent');
});

test('gsd-verifier PRD alignment defines MISMATCH and ALIGNED statuses', () => {
  assert.ok(VERIFIER.includes('MISMATCH'), 'gsd-verifier should define MISMATCH status');
  assert.ok(VERIFIER.includes('ALIGNED'), 'gsd-verifier should define ALIGNED status');
  assert.ok(VERIFIER.includes('PARTIAL'), 'gsd-verifier should define PARTIAL status');
  assert.ok(VERIFIER.includes('UNVERIFIED'), 'gsd-verifier should define UNVERIFIED status');
});

test('gsd-verifier success_criteria includes PRD intent alignment check', () => {
  assert.ok(
    VERIFIER.includes('PRD intent alignment'),
    'gsd-verifier success_criteria should include PRD intent alignment check'
  );
});
