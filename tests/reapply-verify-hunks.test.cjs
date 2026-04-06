/**
 * GSD Tools Tests - reapply-patches post-merge verification
 *
 * Validates that the reapply-patches workflow includes post-merge
 * verification to detect dropped hunks during three-way merge.
 *
 * Closes: #1758
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(
  __dirname, '..', 'commands', 'gsd', 'reapply-patches.md'
);

describe('reapply-patches post-merge verification (#1758)', () => {
  let content;

  before(() => {
    content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  });

  test('workflow file contains "Post-merge verification" section', () => {
    assert.ok(
      content.includes('Post-merge verification'),
      'workflow must contain a "Post-merge verification" section'
    );
  });

  test('workflow mentions "Hunk presence check"', () => {

    assert.ok(
      content.includes('Hunk presence check'),
      'workflow must describe hunk presence checking'
    );
  });

  test('workflow mentions "Line-count check"', () => {

    assert.ok(
      content.includes('Line-count check'),
      'workflow must describe line-count sanity checking'
    );
  });

  test('success criteria includes verification', () => {

    const criteria = content.split('<success_criteria>')[1] || '';
    assert.ok(
      criteria.includes('Post-merge verification') ||
      criteria.includes('dropped hunks'),
      'success_criteria must reference post-merge verification or dropped hunks'
    );
  });

  test('verification warns but never auto-reverts', () => {

    assert.ok(
      content.includes('do not block'),
      'verification must be advisory (do not block)'
    );
  });

  test('verification references backup availability for recovery', () => {

    assert.ok(
      content.includes('Backup available'),
      'verification warning must reference backup path for manual recovery'
    );
  });

  test('verification tracks per-file status', () => {

    assert.ok(
      content.includes('Merged (verified)') &&
      content.includes('hunks may be missing'),
      'verification must distinguish "Merged (verified)" from "hunks may be missing" status'
    );
  });

  test('verification section appears between merge-write and status-report steps', () => {
    const mergeWritePos = content.indexOf('Write merged result');
    const verificationPos = content.indexOf('Post-merge verification');
    const statusReportPos = content.indexOf('Report status per file');

    assert.ok(mergeWritePos > -1, 'workflow must contain "Write merged result" step');
    assert.ok(verificationPos > -1, 'workflow must contain "Post-merge verification" section');
    assert.ok(statusReportPos > -1, 'workflow must contain "Report status per file" step');

    assert.ok(
      mergeWritePos < verificationPos,
      'Post-merge verification must appear after "Write merged result"'
    );
    assert.ok(
      verificationPos < statusReportPos,
      'Post-merge verification must appear before "Report status per file"'
    );
  });
});
