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
    assert.ok(
      content.includes('Post-merge verification checks each file for dropped hunks'),
      'workflow success_criteria must include post-merge verification requirement'
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

  test('verification tracks per-file status', () => {
    assert.ok(
      content.includes('per-file') || content.includes('Track verification status'),
      'workflow must track verification status per file'
    );
  });

  test('verification section appears between merge-write and status-report steps', () => {
    const verifyIdx = content.indexOf('Post-merge verification');
    const writeIdx = content.indexOf('Write merged result');
    const reportIdx = content.indexOf('Step 7: Report');
    assert.ok(
      writeIdx < verifyIdx && verifyIdx < reportIdx,
      'Post-merge verification must appear between "Write merged result" and "Step 7: Report"'
    );
  });
});
