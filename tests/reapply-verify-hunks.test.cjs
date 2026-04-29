/**
 * GSD Tools Tests - reapply-patches post-merge verification
 *
 * Validates that the reapply-patches workflow includes post-merge
 * verification to detect dropped hunks during three-way merge.
 *
 * Closes: #1758
 *
 * #2790: reapply-patches.md (combined command+workflow) was consolidated into
 * update.md as the --reapply flag. The workflow content now lives in
 * get-shit-done/workflows/reapply-patches.md.
 */

// allow-test-rule: source-text-is-the-product
// get-shit-done/workflows/reapply-patches.md is the installed runtime workflow —
// its text IS the deployed behavioral contract for the --reapply path.

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(
  __dirname, '..', 'get-shit-done', 'workflows', 'reapply-patches.md'
);

function extractTagBlock(markdown, tagName) {
  const start = markdown.indexOf(`<${tagName}>`);
  const end = markdown.indexOf(`</${tagName}>`);
  assert.notEqual(start, -1, `Missing <${tagName}> block in workflow`);
  assert.notEqual(end, -1, `Missing </${tagName}> block in workflow`);
  return markdown.slice(start, end);
}

describe('reapply-patches post-merge verification (#1758)', () => {
  let content;

  before(() => {
    content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  });

  test('workflow file contains "Post-merge verification" section', () => {
    assert.ok(
      content.includes('Post-merge verification'),
      'reapply-patches.md workflow must contain a "Post-merge verification" section'
    );
  });

  test('workflow mentions "Hunk presence check"', () => {
    assert.ok(
      content.includes('Hunk presence check'),
      'workflow must describe the hunk presence check step'
    );
  });

  test('workflow mentions "Line-count check"', () => {
    assert.ok(
      content.includes('Line-count check'),
      'workflow must describe the line-count verification step'
    );
  });

  test('success criteria includes verification', () => {
    // Scope to the structured <success_criteria> block so the assertion can't
    // false-pass when the phrase appears elsewhere (e.g. inline prose).
    const successCriteriaBlock = extractTagBlock(content, 'success_criteria');
    assert.ok(
      successCriteriaBlock.includes('Post-merge verification checks each file for dropped hunks'),
      'workflow success_criteria block must include post-merge verification requirement'
    );
  });

  test('verification warns but never auto-reverts', () => {
    assert.ok(
      content.includes('do not block') || content.includes('Report warnings inline'),
      'verification must warn and continue — never auto-revert'
    );
  });

  test('verification references backup availability for recovery', () => {
    assert.ok(
      content.includes('Backup available') || content.includes('backup available'),
      'verification warnings must reference backup path for manual recovery'
    );
  });

  test('verification tracks per-file status via Hunk Verification Table', () => {
    assert.ok(
      content.includes('Hunk Verification Table') &&
        content.includes('one row per hunk per file') &&
        content.includes('verified'),
      'workflow must track verification status per hunk per file via the Hunk Verification Table contract'
    );
  });

  test('verification section appears between merge-write and status-report steps', () => {
    const verifyIdx = content.indexOf('Post-merge verification');
    const writeIdx = content.indexOf('Write merged result');
    const reportIdx = content.indexOf('Step 7: Report');
    assert.notEqual(writeIdx, -1, 'Missing "Write merged result" anchor in reapply-patches.md');
    assert.notEqual(verifyIdx, -1, 'Missing "Post-merge verification" anchor in reapply-patches.md');
    assert.notEqual(reportIdx, -1, 'Missing "Step 7: Report" anchor in reapply-patches.md');
    assert.ok(
      writeIdx < verifyIdx && verifyIdx < reportIdx,
      'Post-merge verification must appear between "Write merged result" and "Step 7: Report"'
    );
  });
});
