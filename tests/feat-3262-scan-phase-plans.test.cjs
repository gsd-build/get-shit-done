/**
 * Tests for the shared scanPhasePlans() helper (k014).
 *
 * Covers:
 *   - Top-level plans only (flat layout)
 *   - Top-level + nested layout (post-#3139)
 *   - Completed-summary detection (summaries >= plans)
 *   - Ignored files (OUTLINE, pre-bounce, CONTEXT, RESEARCH)
 *   - Empty phase dir → { planCount: 0, summaryCount: 0 }
 *   - Parity: helper produces correct counts for mixed flat+nested fixture tree
 */

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper under test — must exist at this path (GREEN phase wires it up)
const scanPhasePlans = require('../get-shit-done/bin/lib/plan-scan.cjs');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

let tmpDir;

function phaseDir(name = 'phase') {
  const d = path.join(tmpDir, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function touch(dir, ...filenames) {
  for (const f of filenames) {
    fs.writeFileSync(path.join(dir, f), '');
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-plan-scan-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Basic shapes
// ---------------------------------------------------------------------------

describe('scanPhasePlans — flat layout', () => {
  test('empty directory → zero counts', () => {
    const dir = phaseDir();
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 0, 'planCount');
    assert.strictEqual(result.summaryCount, 0, 'summaryCount');
  });

  test('bare PLAN.md counts as one plan', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'planCount');
    assert.strictEqual(result.summaryCount, 0, 'summaryCount');
  });

  test('canonical padded plan file (01-01-PLAN.md)', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'planCount');
  });

  test('canonical padded plan + matching summary → completed', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md', '01-01-SUMMARY.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1);
    assert.strictEqual(result.summaryCount, 1);
    assert.strictEqual(result.completed, true, 'phase should be complete when summaries >= plans');
  });

  test('plan without summary → not completed', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.completed, false);
  });

  test('multiple plans all summarized → completed', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md', '01-02-PLAN.md', '01-01-SUMMARY.md', '01-02-SUMMARY.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 2);
    assert.strictEqual(result.summaryCount, 2);
    assert.strictEqual(result.completed, true);
  });

  test('bare SUMMARY.md counts as one summary', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md', 'SUMMARY.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1);
    assert.strictEqual(result.summaryCount, 1);
  });

  test('extended-layout root file (5-PLAN-01-setup.md style)', () => {
    // roadmap.cjs isPlanFile explicitly matches any .md with PLAN in name at root
    // (not just ending with -PLAN.md). The canonical helper must too.
    // e.g. gsd-plan-phase writes "5-PLAN-01-setup.md".
    const dir = phaseDir();
    // The summary for this file follows the canonical *-SUMMARY.md suffix convention.
    touch(dir, '3-PLAN-01-setup.md', '3-01-SUMMARY.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'extended-layout root plan counted');
    assert.strictEqual(result.summaryCount, 1, 'extended-layout root summary counted');
  });
});

// ---------------------------------------------------------------------------
// Ignored files
// ---------------------------------------------------------------------------

describe('scanPhasePlans — ignored files', () => {
  test('PLAN-OUTLINE file is ignored (flat)', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md', '01-01-PLAN-OUTLINE.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'OUTLINE should not count as a plan');
  });

  test('pre-bounce file is ignored (flat)', () => {
    const dir = phaseDir();
    touch(dir, '01-01-PLAN.md', '01-01-PLAN.pre-bounce.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'pre-bounce should not count as a plan');
  });

  test('CONTEXT.md is not counted as a plan', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md', 'CONTEXT.md', '01-01-CONTEXT.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'CONTEXT files should not be plans');
  });

  test('RESEARCH.md is not counted as a plan', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md', 'RESEARCH.md', '01-01-RESEARCH.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'RESEARCH files should not be plans');
  });

  test('VERIFICATION.md is not counted as a plan', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md', 'VERIFICATION.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'VERIFICATION files should not be plans');
  });
});

// ---------------------------------------------------------------------------
// Nested layout (post-#3139)
// ---------------------------------------------------------------------------

describe('scanPhasePlans — nested layout', () => {
  test('nested PLAN-NN-slug.md files counted', () => {
    const dir = phaseDir();
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(plansDir, 'PLAN-01-setup.md', 'PLAN-02-impl.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 2, 'nested plans counted');
    assert.strictEqual(result.hasNestedPlans, true, 'hasNestedPlans flag set');
  });

  test('nested SUMMARY-NN-slug.md files counted', () => {
    const dir = phaseDir();
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(plansDir, 'PLAN-01-setup.md', 'SUMMARY-01-setup.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1);
    assert.strictEqual(result.summaryCount, 1);
    assert.strictEqual(result.completed, true);
  });

  test('flat root + nested plans combined', () => {
    const dir = phaseDir();
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    // root: 1 plan, 1 summary
    touch(dir, '01-01-PLAN.md', '01-01-SUMMARY.md');
    // nested: 2 plans, 1 summary
    touch(plansDir, 'PLAN-01-setup.md', 'PLAN-02-impl.md', 'SUMMARY-01-setup.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 3, 'root + nested plans');
    assert.strictEqual(result.summaryCount, 2, 'root + nested summaries');
    assert.strictEqual(result.completed, false, 'not all plans have summaries');
  });

  test('hasNestedPlans is false when plans/ directory absent', () => {
    const dir = phaseDir();
    touch(dir, 'PLAN.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.hasNestedPlans, false);
  });

  test('nested OUTLINE files are ignored', () => {
    const dir = phaseDir();
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(plansDir, 'PLAN-01-setup.md', 'PLAN-01-OUTLINE.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'OUTLINE excluded in nested');
  });

  test('nested pre-bounce files are ignored', () => {
    const dir = phaseDir();
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(plansDir, 'PLAN-01-setup.md', 'PLAN-01.pre-bounce.md');
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1, 'pre-bounce excluded in nested');
  });

  test('plans/ that is not readable as directory does not throw', () => {
    const dir = phaseDir();
    // Create plans/ as a file (unreadable as directory)
    fs.writeFileSync(path.join(dir, 'plans'), 'not-a-directory');
    touch(dir, 'PLAN.md');
    // Should not throw
    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 1);
    assert.strictEqual(result.hasNestedPlans, false);
  });
});

// ---------------------------------------------------------------------------
// Parity: helper output shape and mixed fixture
// ---------------------------------------------------------------------------

describe('scanPhasePlans — call-site parity on mixed fixture', () => {
  // Build a fixture tree that exercises both flat and nested layout:
  // 01-foundation/
  //   01-01-PLAN.md
  //   01-01-SUMMARY.md
  //   01-01-PLAN-OUTLINE.md   (should be ignored)
  //   01-02-PLAN.md
  //   plans/
  //     PLAN-01-setup.md
  //     SUMMARY-01-setup.md

  function buildMixedPhase() {
    const dir = phaseDir('01-foundation');
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(dir, '01-01-PLAN.md', '01-01-SUMMARY.md', '01-01-PLAN-OUTLINE.md', '01-02-PLAN.md');
    touch(plansDir, 'PLAN-01-setup.md', 'SUMMARY-01-setup.md');
    return dir;
  }

  test('scanPhasePlans() counts match expected values for mixed fixture', () => {
    const dir = buildMixedPhase();
    const result = scanPhasePlans(dir);
    // flat: 01-01-PLAN.md + 01-02-PLAN.md = 2 (OUTLINE ignored)
    // nested: PLAN-01-setup.md = 1
    assert.strictEqual(result.planCount, 3, 'planCount should be 3');
    // flat: 01-01-SUMMARY.md = 1; nested: SUMMARY-01-setup.md = 1
    assert.strictEqual(result.summaryCount, 2, 'summaryCount should be 2');
    assert.strictEqual(result.completed, false, 'not all plans have summaries');
    assert.strictEqual(result.hasNestedPlans, true, 'nested layout present');
  });

  test('scanPhasePlans() output shape has required fields', () => {
    const dir = buildMixedPhase();
    const result = scanPhasePlans(dir);
    assert.ok('planCount' in result, 'planCount field present');
    assert.ok('summaryCount' in result, 'summaryCount field present');
    assert.ok('completed' in result, 'completed field present');
    assert.ok('hasNestedPlans' in result, 'hasNestedPlans field present');
    assert.ok('planFiles' in result, 'planFiles field present');
    assert.ok('summaryFiles' in result, 'summaryFiles field present');
    assert.ok(Array.isArray(result.planFiles), 'planFiles is array');
    assert.ok(Array.isArray(result.summaryFiles), 'summaryFiles is array');
  });

  test('parity baseline: 2 flat + 1 nested plans across all call sites', () => {
    // This test documents the exact expected counts for a representative fixture.
    // After the GREEN phase ports roadmap.cjs/state.cjs/init.cjs to use
    // scanPhasePlans, those call sites delegate here and this assertion is
    // the single contract all of them must satisfy.
    const dir = phaseDir('02-api');
    touch(dir, '02-01-PLAN.md', '02-02-PLAN.md', '02-01-SUMMARY.md');
    const plansDir = path.join(dir, 'plans');
    fs.mkdirSync(plansDir);
    touch(plansDir, 'PLAN-01-impl.md', 'SUMMARY-01-impl.md');

    const result = scanPhasePlans(dir);
    assert.strictEqual(result.planCount, 3, 'helper: 2 flat + 1 nested');
    assert.strictEqual(result.summaryCount, 2, 'helper: 1 flat + 1 nested');
    assert.strictEqual(result.completed, false, '2 summaries < 3 plans');
    assert.strictEqual(result.hasNestedPlans, true, 'plans/ dir exists with plans');
  });
});
