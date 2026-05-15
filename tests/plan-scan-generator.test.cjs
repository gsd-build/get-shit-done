'use strict';

/**
 * Parity test — verifies that plan-scan.generated.cjs produces identical
 * results to the compiled SDK ESM output for all exported functions.
 *
 * SDK side: import('../sdk/dist/query/plan-scan.js')
 * CJS side: require('../get-shit-done/bin/lib/plan-scan.generated.cjs')
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

/**
 * Build a unique-to-this-run path that is guaranteed not to exist. Hardcoded
 * `/tmp/...` paths are a flake source on shared CI runners where the path can
 * be left over from a prior run. We synthesize a random suffix under
 * `os.tmpdir()` and force-remove the path first.
 */
function uniqueMissingPath(prefix = 'gsd-missing') {
  const suffix = `${prefix}-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const p = path.join(os.tmpdir(), suffix);
  // The probability of collision is negligible, but force-clean anyway to make
  // the precondition explicit. Errors swallowed (path didn't exist — desired).
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* noop */ }
  return p;
}

const requireFromRoot = createRequire(__filename);

// CJS side — direct require works fine
const cjs = requireFromRoot('../get-shit-done/bin/lib/plan-scan.generated.cjs');

// ── isRootPlanFile ────────────────────────────────────────────────────────

describe('plan-scan-generator parity: isRootPlanFile', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  const fixtures = [
    { label: 'accepts bare PLAN.md', name: 'PLAN.md', expected: true },
    { label: 'accepts canonical -PLAN.md', name: '01-01-PLAN.md', expected: true },
    { label: 'accepts extended PLAN-01-setup.md', name: 'PLAN-01-setup.md', expected: true },
    { label: 'rejects -PLAN-OUTLINE.md', name: 'something-PLAN-OUTLINE.md', expected: false },
    { label: 'rejects .pre-bounce.md', name: 'PLAN.pre-bounce.md', expected: false },
    { label: 'rejects SUMMARY.md', name: 'SUMMARY.md', expected: false },
    { label: 'rejects unrelated file', name: 'README.md', expected: false },
  ];

  for (const { label, name, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.isRootPlanFile(name);
      const cjsResult = cjs.isRootPlanFile(name);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── isNestedPlanFile ──────────────────────────────────────────────────────

describe('plan-scan-generator parity: isNestedPlanFile', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  const fixtures = [
    { label: 'accepts PLAN-01-setup.md', name: 'PLAN-01-setup.md', expected: true },
    { label: 'accepts 1-PLAN-01-setup.md', name: '1-PLAN-01-setup.md', expected: true },
    { label: 'rejects PLAN-OUTLINE.md', name: 'PLAN-01-OUTLINE.md', expected: false },
    { label: 'rejects .pre-bounce.md', name: 'PLAN-01.pre-bounce.md', expected: false },
    { label: 'rejects bare PLAN.md', name: 'PLAN.md', expected: false },
    { label: 'rejects unrelated file', name: 'SUMMARY-01-setup.md', expected: false },
  ];

  for (const { label, name, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.isNestedPlanFile(name);
      const cjsResult = cjs.isNestedPlanFile(name);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── isRootSummaryFile ─────────────────────────────────────────────────────

describe('plan-scan-generator parity: isRootSummaryFile', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  const fixtures = [
    { label: 'accepts bare SUMMARY.md', name: 'SUMMARY.md', expected: true },
    { label: 'accepts 01-01-SUMMARY.md', name: '01-01-SUMMARY.md', expected: true },
    { label: 'rejects PLAN.md', name: 'PLAN.md', expected: false },
    { label: 'rejects unrelated file', name: 'README.md', expected: false },
  ];

  for (const { label, name, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.isRootSummaryFile(name);
      const cjsResult = cjs.isRootSummaryFile(name);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── isNestedSummaryFile ───────────────────────────────────────────────────

describe('plan-scan-generator parity: isNestedSummaryFile', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  const fixtures = [
    { label: 'accepts SUMMARY-01-summary.md', name: 'SUMMARY-01-summary.md', expected: true },
    { label: 'accepts 1-SUMMARY-01.md', name: '1-SUMMARY-01.md', expected: true },
    { label: 'rejects bare SUMMARY.md', name: 'SUMMARY.md', expected: false },
    { label: 'rejects PLAN file', name: 'PLAN-01-setup.md', expected: false },
  ];

  for (const { label, name, expected } of fixtures) {
    test(label, () => {
      const sdkResult = sdk.isNestedSummaryFile(name);
      const cjsResult = cjs.isNestedSummaryFile(name);
      assert.strictEqual(sdkResult, expected, `SDK: ${label}`);
      assert.strictEqual(cjsResult, expected, `CJS: ${label}`);
      assert.strictEqual(sdkResult, cjsResult, `SDK/CJS parity: ${label}`);
    });
  }
});

// ── scanPhasePlans ────────────────────────────────────────────────────────

describe('plan-scan-generator parity: scanPhasePlans (non-existent dir)', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  test('returns zero counts for non-existent directory', () => {
    const nonExistent = uniqueMissingPath('gsd-plan-scan-nonexistent');
    const sdkResult = sdk.scanPhasePlans(nonExistent);
    const cjsResult = cjs.scanPhasePlans(nonExistent);
    assert.deepStrictEqual(sdkResult, {
      planCount: 0,
      summaryCount: 0,
      completed: false,
      hasNestedPlans: false,
      planFiles: [],
      summaryFiles: [],
    });
    assert.deepStrictEqual(sdkResult, cjsResult, 'SDK/CJS parity: non-existent dir');
  });
});

describe('plan-scan-generator parity: scanPhasePlans (flat layout)', async () => {
  const sdk = await import('../sdk/dist/query/plan-scan.js');

  test('detects flat plan and summary files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-plan-scan-test-'));
    try {
      fs.writeFileSync(path.join(tmpDir, '01-01-PLAN.md'), '# Plan');
      fs.writeFileSync(path.join(tmpDir, '01-01-SUMMARY.md'), '# Summary');
      fs.writeFileSync(path.join(tmpDir, 'README.md'), '# Readme');

      const sdkResult = sdk.scanPhasePlans(tmpDir);
      const cjsResult = cjs.scanPhasePlans(tmpDir);

      assert.strictEqual(sdkResult.planCount, 1, 'SDK: planCount');
      assert.strictEqual(sdkResult.summaryCount, 1, 'SDK: summaryCount');
      assert.strictEqual(sdkResult.completed, true, 'SDK: completed');
      assert.strictEqual(sdkResult.hasNestedPlans, false, 'SDK: hasNestedPlans');
      assert.deepStrictEqual(sdkResult, cjsResult, 'SDK/CJS parity: flat layout');
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});

describe('plan-scan-generator parity: module.exports call style', async () => {
  test('default export is callable as function (CJS caller pattern)', () => {
    // CJS callers do: const scanPhasePlans = require('./plan-scan.cjs')
    // then call it directly: scanPhasePlans(phaseDir)
    assert.strictEqual(typeof cjs, 'function', 'default export is a function');
    const result = cjs(uniqueMissingPath('gsd-plan-scan-cjs-default'));
    assert.deepStrictEqual(result, {
      planCount: 0,
      summaryCount: 0,
      completed: false,
      hasNestedPlans: false,
      planFiles: [],
      summaryFiles: [],
    });
  });
});
