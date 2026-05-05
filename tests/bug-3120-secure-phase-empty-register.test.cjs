'use strict';
// allow-test-rule: reads product workflow markdown (secure-phase.md) to verify structural guard contract — not a source-grep test

// Regression guard for bug #3120.
//
// secure-phase.md Step 3 short-circuited to Step 6 (write SECURITY.md)
// whenever threats_open: 0, without distinguishing between:
//   Case A: All plan-time threat_model threats are CLOSED (legitimate skip)
//   Case B: No threat_model blocks were written at plan time (legacy phases)
//          → rubber-stamps a clean SECURITY.md with zero audit performed
//
// Fix: Step 2c tracks `register_authored_at_plan_time` (true iff ≥1 PLAN
// file contained a parseable <threat_model> block). Step 3 now requires BOTH
// threats_open: 0 AND register_authored_at_plan_time to skip. If only
// threats_open: 0 and NOT register_authored_at_plan_time, Step 5 runs in
// retroactive-STRIDE mode.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(
  path.join(ROOT, 'get-shit-done', 'workflows', 'secure-phase.md'),
  'utf8',
);

describe('bug #3120: secure-phase short-circuit guards', () => {
  test('Step 2c tracks register_authored_at_plan_time', () => {
    assert.ok(
      src.includes('register_authored_at_plan_time'),
      'secure-phase.md does not track register_authored_at_plan_time in Step 2c',
    );
  });

  test('Step 3 short-circuit requires both conditions', () => {
    assert.ok(
      src.includes('threats_open: 0 AND register_authored_at_plan_time'),
      'Step 3 short-circuit does not gate on both threats_open:0 AND register_authored_at_plan_time',
    );
  });

  test('retroactive-STRIDE mode is documented for legacy phases', () => {
    assert.ok(
      src.includes('retroactive') || src.includes('Retroactive'),
      'secure-phase.md does not document retroactive-STRIDE mode for legacy phases (no <threat_model> blocks)',
    );
  });

  test('Step 5 auditor constraint varies by mode', () => {
    assert.ok(
      (src.includes('Verify mitigations') || src.includes('verify mitigations')) &&
      (src.includes('Retroactive') || src.includes('retroactive')),
      'Step 5 does not distinguish planned vs retroactive-STRIDE auditor constraint',
    );
  });
});
