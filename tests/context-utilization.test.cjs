'use strict';

/**
 * Pure classifier for the gsd-health --context guard.
 *
 * Thresholds:
 *   < 60%   healthy
 *   60–70%  warning
 *   ≥ 70%   critical (fracture point)
 *
 * The classifier is a pure (tokensUsed, contextWindow) → { percent, state }
 * function. Recommendation copy is owned by the SDK renderer (see
 * tests/validate-context.test.cjs), not this module.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { classifyContextUtilization, STATES } = require('../get-shit-done/bin/lib/context-utilization.cjs');

describe('STATES constant exposes the three boundary names', () => {
  test('exports HEALTHY, WARNING, CRITICAL', () => {
    assert.deepStrictEqual(
      [STATES.HEALTHY, STATES.WARNING, STATES.CRITICAL],
      ['healthy', 'warning', 'critical'],
    );
  });
});

describe('classifyContextUtilization — state thresholds', () => {
  test('0 tokens used → healthy at 0%', () => {
    const r = classifyContextUtilization(0, 200_000);
    assert.strictEqual(r.percent, 0);
    assert.strictEqual(r.state, STATES.HEALTHY);
  });

  test('just under 60% → healthy (state uses exact ratio, not rounded percent)', () => {
    // 119_999 / 200_000 = 59.9995% — rounds to 60 for display, healthy by ratio.
    const r = classifyContextUtilization(119_999, 200_000);
    assert.strictEqual(r.state, STATES.HEALTHY);
  });

  test('exactly 60% → warning (inclusive lower bound)', () => {
    const r = classifyContextUtilization(120_000, 200_000);
    assert.strictEqual(r.percent, 60);
    assert.strictEqual(r.state, STATES.WARNING);
  });

  test('between 60% and 70% → warning', () => {
    const r = classifyContextUtilization(130_000, 200_000);
    assert.strictEqual(r.percent, 65);
    assert.strictEqual(r.state, STATES.WARNING);
  });

  test('just under 70% → warning', () => {
    // 139_999 / 200_000 = 69.9995% — rounds to 70 for display, warning by ratio.
    const r = classifyContextUtilization(139_999, 200_000);
    assert.strictEqual(r.state, STATES.WARNING);
  });

  test('exactly 70% → critical (fracture point, inclusive lower bound)', () => {
    const r = classifyContextUtilization(140_000, 200_000);
    assert.strictEqual(r.percent, 70);
    assert.strictEqual(r.state, STATES.CRITICAL);
  });

  test('above 70% → critical', () => {
    const r = classifyContextUtilization(180_000, 200_000);
    assert.strictEqual(r.percent, 90);
    assert.strictEqual(r.state, STATES.CRITICAL);
  });

  test('tokensUsed >= contextWindow clamps to 100%', () => {
    const r = classifyContextUtilization(250_000, 200_000);
    assert.strictEqual(r.percent, 100);
    assert.strictEqual(r.state, STATES.CRITICAL);
  });
});

describe('classifyContextUtilization — return shape', () => {
  test('result is exactly { percent, state } — no recommendation field', () => {
    // Recommendation copy lives in the renderer, not the classifier.
    // Keeping this contract narrow lets the prose evolve without
    // re-validating the math layer.
    const r = classifyContextUtilization(100_000, 200_000);
    assert.deepStrictEqual(Object.keys(r).sort(), ['percent', 'state']);
  });
});

describe('classifyContextUtilization — input validation', () => {
  test('negative tokensUsed throws', () => {
    assert.throws(() => classifyContextUtilization(-1, 200_000), /tokensUsed/);
  });

  test('non-integer tokensUsed throws', () => {
    assert.throws(() => classifyContextUtilization(1.5, 200_000), /tokensUsed/);
  });

  test('zero contextWindow throws', () => {
    assert.throws(() => classifyContextUtilization(100, 0), /contextWindow/);
  });

  test('negative contextWindow throws', () => {
    assert.throws(() => classifyContextUtilization(100, -1), /contextWindow/);
  });

  test('non-number inputs throw via Number.isInteger', () => {
    assert.throws(() => classifyContextUtilization('100', 200_000), /tokensUsed/);
    assert.throws(() => classifyContextUtilization(100, '200000'), /contextWindow/);
    assert.throws(() => classifyContextUtilization(NaN, 200_000), /tokensUsed/);
    assert.throws(() => classifyContextUtilization(100, Infinity), /contextWindow/);
  });
});

describe('classifyContextUtilization — percent rounding', () => {
  test('display percent rounds; state uses exact ratio', () => {
    // 119_998 / 200_000 = 59.999% — display rounds to 60, state stays healthy.
    const r = classifyContextUtilization(119_998, 200_000);
    assert.strictEqual(r.state, STATES.HEALTHY);
    assert.ok([59, 60].includes(r.percent), `expected percent ∈ {59,60}, got ${r.percent}`);
  });
});
