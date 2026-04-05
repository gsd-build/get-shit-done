/**
 * GSD Tools Tests - reapply-patches post-merge verification
 *
 * Validates that the reapply-patches workflow includes post-merge
 * verification to detect dropped hunks during three-way merge.
 *
 * Closes: #1758
 */

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(
  __dirname, '..', 'commands', 'gsd', 'reapply-patches.md'
);

describe('reapply-patches post-merge verification (#1758)', () => {
  test('workflow file contains "Post-merge verification" section', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('Post-merge verification'),
      'workflow must contain a "Post-merge verification" section'
    );
  });

  test('workflow mentions "Hunk presence check"', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('Hunk presence check'),
      'workflow must describe hunk presence checking'
    );
  });

  test('workflow mentions "Line-count check"', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('Line-count check'),
      'workflow must describe line-count sanity checking'
    );
  });

  test('success criteria includes verification', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const criteria = content.split('<success_criteria>')[1] || '';
    assert.ok(
      criteria.includes('Post-merge verification') ||
      criteria.includes('dropped hunks'),
      'success_criteria must reference post-merge verification or dropped hunks'
    );
  });

  test('verification warns but never auto-reverts', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('do not block'),
      'verification must be advisory (do not block)'
    );
  });

  test('verification references backup availability for recovery', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('Backup available'),
      'verification warning must reference backup path for manual recovery'
    );
  });

  test('verification tracks per-file status', () => {
    const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.ok(
      content.includes('Merged (verified)') &&
      content.includes('hunks may be missing'),
      'verification must distinguish "Merged (verified)" from "hunks may be missing" status'
    );
  });
});
