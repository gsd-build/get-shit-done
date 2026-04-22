/**
 * Tests for verification overrides reference document (#1747)
 *
 * Verifies that the verification-overrides.md reference exists, documents
 * the YAML frontmatter override format, and is referenced by gsd-verifier.md.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

describe('verification overrides reference (#1747)', () => {

  // ── Reference document ────────────────────────────────────────────────────

  describe('get-shit-done/references/verification-overrides.md', () => {
    const refPath = path.join(ROOT, 'get-shit-done', 'references', 'verification-overrides.md');
    let content;

    test('file exists', () => {
      assert.ok(fs.existsSync(refPath), 'verification-overrides.md should exist');
      content = fs.readFileSync(refPath, 'utf-8');
    });

    test('contains Override Format section', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('## Override Format'),
        'should contain an "Override Format" section'
      );
    });

    test('contains Matching Rules section', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('## Matching Rules'),
        'should contain a "Matching Rules" section'
      );
    });

    test('contains Verifier Behavior section', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('## Verifier Behavior'),
        'should contain a "Verifier Behavior" section'
      );
    });

    test('documents YAML frontmatter overrides block with must_have field', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('overrides:') && content.includes('must_have:') && content.includes('reason:'),
        'should document the YAML frontmatter format with overrides, must_have, and reason fields'
      );
    });

    test('does not use criterion field (must use must_have)', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      // criterion: as a YAML field name should not appear; must_have: is the correct field
      const lines = content.split('\n');
      const criterionLines = lines.filter((l) => /^\s+criterion:/.test(l));
      assert.strictEqual(
        criterionLines.length,
        0,
        'should use must_have field, not criterion field'
      );
    });

    test('documents required accepted_by field', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('accepted_by'),
        'should document the accepted_by field'
      );
    });

    test('documents required accepted_at field', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('accepted_at'),
        'should document the accepted_at field'
      );
    });

    test('marks accepted_by as required (not optional)', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      // The field table should list accepted_by as required, not optional
      assert.ok(
        content.includes('accepted_by') && content.includes('Required'),
        'accepted_by should be described as a required field'
      );
    });

    test('marks accepted_at as required (not optional)', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('accepted_at') && content.includes('Required'),
        'accepted_at should be described as a required field'
      );
    });

    test('describes fuzzy matching behavior', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('fuzzy matching') || content.includes('fuzzy-match'),
        'should describe fuzzy matching for pairing overrides with must-haves'
      );
    });

    test('describes case-insensitive matching', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.toLowerCase().includes('case-insensitive'),
        'should describe case-insensitive matching'
      );
    });

    test('describes 80% word overlap matching threshold', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('80%'),
        'should describe 80% word overlap matching threshold'
      );
    });

    test('does not use a threshold lower than 80%', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      // 60% threshold is too loose — should not appear as the matching threshold
      assert.ok(
        !content.includes('60% token overlap') && !content.includes('60% word overlap'),
        'should not describe a 60% matching threshold (too loose — use 80%)'
      );
    });

    test('documents PASSED (override) status', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('PASSED (override)'),
        'should document the PASSED (override) status marker'
      );
    });

    test('includes example VERIFICATION.md', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('## Example VERIFICATION.md'),
        'should include an example VERIFICATION.md section'
      );
    });

    test('documents When to Use guidance', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('## When to Use'),
        'should contain a "When to Use" section'
      );
    });

    test('documents When NOT to Use guardrails', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('When NOT to Use') || content.includes('NOT appropriate'),
        'should contain guardrails explaining when overrides are not appropriate'
      );
    });

    test('documents overrides_applied counter field', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('overrides_applied'),
        'should document the overrides_applied counter field in frontmatter'
      );
    });

    test('documents re-verification carryforward behavior', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('carry forward') || content.includes('carryforward') || content.includes('Re-verification') || content.includes('re-verification'),
        'should document that overrides carry forward during re-verification'
      );
    });

    test('documents milestone audit surfacing', () => {
      content = content || fs.readFileSync(refPath, 'utf-8');
      assert.ok(
        content.includes('gsd-audit-milestone') || content.includes('audit-milestone') || content.includes('milestone'),
        'should document that overrides are surfaced during milestone audit'
      );
    });
  });

  // ── Verifier agent reference ──────────────────────────────────────────────

  describe('agents/gsd-verifier.md references overrides', () => {
    const verifierPath = path.join(ROOT, 'agents', 'gsd-verifier.md');
    let verifierContent;

    test('gsd-verifier.md exists', () => {
      assert.ok(fs.existsSync(verifierPath), 'gsd-verifier.md should exist');
      verifierContent = fs.readFileSync(verifierPath, 'utf-8');
    });

    test('references verification-overrides.md in required_reading', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('verification-overrides.md'),
        'gsd-verifier.md should reference verification-overrides.md'
      );
    });

    test('required_reading block is between </role> and <project_context>', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      const roleEnd = verifierContent.indexOf('</role>');
      const projectCtx = verifierContent.indexOf('<project_context>');
      // Use regex to find the actual XML tag (on its own line), not backtick-escaped prose mentions
      const reqMatch = verifierContent.match(/^<required_reading>/m);
      const reqReading = reqMatch ? reqMatch.index : -1;
      assert.ok(roleEnd > -1, '</role> tag should exist');
      assert.ok(projectCtx > -1, '<project_context> tag should exist');
      assert.ok(reqReading > -1, '<required_reading> tag should exist');
      assert.ok(
        reqReading > roleEnd && reqReading < projectCtx,
        '<required_reading> should appear between </role> and <project_context>'
      );
    });

    test('verifier includes Step 3b for override check before FAIL', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('Step 3b'),
        'gsd-verifier.md should include a Step 3b override check'
      );
    });

    test('verifier Step 3b uses must_have field (not criterion)', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      // Find the Step 3b section
      const step3bStart = verifierContent.indexOf('## Step 3b');
      assert.ok(step3bStart > -1, 'Step 3b section should exist');
      const step3bEnd = verifierContent.indexOf('\n## Step 4', step3bStart);
      const step3bSection = verifierContent.slice(step3bStart, step3bEnd > -1 ? step3bEnd : undefined);
      assert.ok(
        step3bSection.includes('must_have'),
        'Step 3b should reference the must_have field'
      );
    });

    test('verifier frontmatter template includes overrides_applied', () => {
      verifierContent = verifierContent || fs.readFileSync(verifierPath, 'utf-8');
      assert.ok(
        verifierContent.includes('overrides_applied'),
        'gsd-verifier.md frontmatter template should include overrides_applied counter'
      );
    });
  });
});
