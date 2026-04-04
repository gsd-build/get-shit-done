/**
 * Tests for verifier deferred-items filtering (#1624)
 *
 * Verifies that the gsd-verifier agent filters gaps addressed in later
 * milestone phases, preventing false-positive gap reports.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('verifier deferred-items filtering (#1624)', () => {

  // ── gsd-verifier.md ────────────────────────────────────────────────────────

  describe('agents/gsd-verifier.md', () => {
    const verifierPath = path.join(ROOT, 'agents', 'gsd-verifier.md');
    let verifierContent;

    test('file exists', () => {
      assert.ok(fs.existsSync(verifierPath), 'gsd-verifier.md should exist');
      verifierContent = fs.readFileSync(verifierPath, 'utf-8');
    });

    test('contains Step 9b for filtering deferred items', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('Step 9b') || verifierContent.includes('Filter Deferred'),
        'gsd-verifier.md should contain Step 9b or "Filter Deferred" section'
      );
    });

    test('Step 9b references roadmap analyze for cross-referencing', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('roadmap analyze'),
        'Step 9b should reference "roadmap analyze" command for loading full milestone data'
      );
    });

    test('VERIFICATION.md frontmatter template includes deferred section', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('deferred:'),
        'VERIFICATION.md template should include a deferred: section in frontmatter'
      );
    });

    test('deferred section includes addressed_in field', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('addressed_in'),
        'deferred items should include an addressed_in field referencing the later phase'
      );
    });

    test('deferred section includes evidence field', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('evidence'),
        'deferred items should include an evidence field with matching goal/criteria'
      );
    });

    test('deferred section is conditional (only if deferred items exist)', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('if deferred items exist') ||
        verifierContent.includes('If deferred items exist') ||
        verifierContent.includes('Only if deferred'),
        'deferred section should be conditional — only included when deferred items exist'
      );
    });

    test('deferred items do not affect status determination', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('do NOT affect the status') ||
        verifierContent.includes('do not affect status') ||
        verifierContent.includes('Deferred items do NOT affect'),
        'should explicitly state that deferred items do not affect status'
      );
    });

    test('includes conservative matching guidance', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('conservative') || verifierContent.includes('when in doubt'),
        'should include guidance to be conservative when matching gaps to later phases'
      );
    });

    test('report body template includes Deferred Items table', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('### Deferred Items'),
        'report body template should include a Deferred Items section'
      );
    });

    test('success criteria mentions deferred filtering', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('Deferred items filtered') ||
        verifierContent.includes('deferred items filtered') ||
        verifierContent.includes('Deferred items structured'),
        'success criteria should reference deferred item filtering'
      );
    });
  });

  // ── verify-phase.md (workflow) ─────────────────────────────────────────────

  describe('get-shit-done/workflows/verify-phase.md', () => {
    const workflowPath = path.join(ROOT, 'get-shit-done', 'workflows', 'verify-phase.md');
    let workflowContent;

    test('file exists', () => {
      assert.ok(fs.existsSync(workflowPath), 'verify-phase.md should exist');
      workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    });

    test('loads roadmap analyze in context step', () => {
      workflowContent = workflowContent || fs.readFileSync(workflowPath, 'utf-8');
      assert.ok(
        workflowContent.includes('roadmap analyze'),
        'verify-phase.md should load roadmap analyze in its context step'
      );
    });

    test('contains filter_deferred_items step', () => {
      workflowContent = workflowContent || fs.readFileSync(workflowPath, 'utf-8');
      assert.ok(
        workflowContent.includes('filter_deferred_items') ||
        workflowContent.includes('Filter Deferred'),
        'verify-phase.md should contain a deferred-item filtering step'
      );
    });

    test('success criteria mentions deferred filtering', () => {
      workflowContent = workflowContent || fs.readFileSync(workflowPath, 'utf-8');
      assert.ok(
        workflowContent.includes('Deferred items filtered') ||
        workflowContent.includes('deferred items filtered'),
        'success criteria should mention deferred item filtering'
      );
    });
  });

  // ── verify-phase.md (SDK variant) ──────────────────────────────────────────

  describe('sdk/prompts/workflows/verify-phase.md', () => {
    const sdkPath = path.join(ROOT, 'sdk', 'prompts', 'workflows', 'verify-phase.md');
    let sdkContent;

    test('file exists', () => {
      assert.ok(fs.existsSync(sdkPath), 'SDK verify-phase.md should exist');
      sdkContent = fs.readFileSync(sdkPath, 'utf-8');
    });

    test('loads roadmap analyze in context step', () => {
      sdkContent = sdkContent || fs.readFileSync(sdkPath, 'utf-8');
      assert.ok(
        sdkContent.includes('roadmap analyze'),
        'SDK verify-phase.md should reference roadmap analyze for deferred-item filtering'
      );
    });

    test('contains deferred-item filtering step', () => {
      sdkContent = sdkContent || fs.readFileSync(sdkPath, 'utf-8');
      assert.ok(
        sdkContent.includes('filter_deferred_items') ||
        sdkContent.includes('deferred'),
        'SDK verify-phase.md should contain deferred-item filtering logic'
      );
    });
  });

  // ── planner-gap-closure.md ─────────────────────────────────────────────────

  describe('get-shit-done/references/planner-gap-closure.md', () => {
    const closurePath = path.join(ROOT, 'get-shit-done', 'references', 'planner-gap-closure.md');
    let closureContent;

    test('file exists', () => {
      assert.ok(fs.existsSync(closurePath), 'planner-gap-closure.md should exist');
      closureContent = fs.readFileSync(closurePath, 'utf-8');
    });

    test('mentions skipping deferred items', () => {
      closureContent = closureContent || fs.readFileSync(closurePath, 'utf-8');
      const lower = closureContent.toLowerCase();
      assert.ok(
        lower.includes('deferred') && lower.includes('skip'),
        'planner-gap-closure.md should mention skipping deferred items'
      );
    });

    test('distinguishes gaps from deferred sections', () => {
      closureContent = closureContent || fs.readFileSync(closurePath, 'utf-8');
      assert.ok(
        closureContent.includes('gaps:') && closureContent.includes('deferred:'),
        'should reference both gaps: and deferred: sections to distinguish them'
      );
    });

    test('explains that deferred items are not actionable', () => {
      closureContent = closureContent || fs.readFileSync(closurePath, 'utf-8');
      assert.ok(
        closureContent.includes('NOT gaps') || closureContent.includes('not gaps') ||
        closureContent.includes('must be ignored'),
        'should explain that deferred items are not actionable gaps'
      );
    });
  });
});
