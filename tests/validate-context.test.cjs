'use strict';

/**
 * SDK CLI integration tests for `gsd-tools validate context`.
 *
 * The pure classifier's behavior is covered by
 * tests/context-utilization.test.cjs — these tests focus on what the CLI
 * adds on top: argument parsing, JSON vs human-readable rendering,
 * recommendation-string formatting, and exit-code semantics.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { runGsdTools } = require('./helpers.cjs');

describe('gsd-tools validate context — CLI argument errors', () => {
  test('missing --tokens-used fails with named flag in stderr', () => {
    const r = runGsdTools(['validate', 'context', '--context-window', '200000']);
    assert.strictEqual(r.success, false);
    assert.match(r.error, /tokens-used/i);
  });

  test('missing --context-window fails with named flag in stderr', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '100000']);
    assert.strictEqual(r.success, false);
    assert.match(r.error, /context-window/i);
  });

  test('non-numeric --tokens-used reports the offending flag', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', 'abc', '--context-window', '200000']);
    assert.strictEqual(r.success, false);
    assert.match(r.error, /tokens-used/i);
  });

  test('negative --tokens-used reports the offending flag', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '-1', '--context-window', '200000']);
    assert.strictEqual(r.success, false);
    assert.match(r.error, /tokens-used/i);
  });
});

describe('gsd-tools validate context — JSON vs human rendering', () => {
  test('--json emits the classifier result plus a recommendation field', () => {
    // Single round-trip test confirms (a) classifier integration,
    // (b) JSON serialization, and (c) recommendation lookup. Per-state
    // classifier behavior is covered by context-utilization.test.cjs.
    const r = runGsdTools(['validate', 'context', '--tokens-used', '50000', '--context-window', '200000', '--json']);
    assert.strictEqual(r.success, true, `expected success, got: ${r.error}`);
    const obj = JSON.parse(r.output);
    assert.deepStrictEqual(Object.keys(obj).sort(), ['percent', 'recommendation', 'state']);
    assert.strictEqual(obj.percent, 25);
    assert.strictEqual(obj.state, 'healthy');
    assert.strictEqual(obj.recommendation, null);
  });

  test('human mode (default) prints percent, state, and recommendation', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '140000', '--context-window', '200000']);
    assert.strictEqual(r.success, true);
    assert.match(r.output, /70%/);
    assert.match(r.output, /critical/);
    assert.match(r.output, /\/gsd-thread/);
  });

  test('human mode omits the recommendation line for healthy state', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '40000', '--context-window', '200000']);
    assert.strictEqual(r.success, true);
    assert.match(r.output, /20%/);
    assert.match(r.output, /healthy/);
    assert.doesNotMatch(r.output, /\/gsd-thread/, 'healthy output must not nag the user');
  });
});

describe('gsd-tools validate context — recommendation copy per state', () => {
  // The CLI owns the recommendation strings (the classifier does not).
  // These tests pin the wording so a regression to the prose is caught.
  test('warning state recommends /gsd-thread', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '130000', '--context-window', '200000', '--json']);
    const obj = JSON.parse(r.output);
    assert.strictEqual(obj.state, 'warning');
    assert.match(obj.recommendation, /\/gsd-thread/);
  });

  test('critical state names the fracture-point reasoning risk', () => {
    const r = runGsdTools(['validate', 'context', '--tokens-used', '160000', '--context-window', '200000', '--json']);
    const obj = JSON.parse(r.output);
    assert.strictEqual(obj.state, 'critical');
    assert.match(obj.recommendation, /\/gsd-thread/);
    assert.match(obj.recommendation, /reasoning|degrade|fracture/i);
  });
});
