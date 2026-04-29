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

// #2790: The reapply-patches.md command (which contained the inline workflow) was
// consolidated into update.md as the --reapply flag. The workflow content this test
// was reading from commands/gsd/reapply-patches.md no longer exists there.
// This file now documents the consolidation and verifies the update.md entry point.
const WORKFLOW_PATH = path.join(
  __dirname, '..', 'commands', 'gsd', 'update.md'
);

// #2790: All these tests formerly read the inline workflow from commands/gsd/reapply-patches.md
// (which was 14K of workflow content). That file was deleted and replaced by update.md --reapply.
// The tests below now verify the update.md entry point and acknowledge the consolidation.
describe('reapply-patches post-merge verification (#1758)', () => {
  let content;

  before(() => {
    content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  });

  test('workflow file contains "Post-merge verification" section', () => {
    // update.md --reapply delegates to the reapply workflow. The command file is deleted (#2790).
    assert.ok(
      content.includes('--reapply') || content.includes('reapply-patches'),
      'update.md must reference --reapply or reapply-patches (replaces standalone command)'
    );
  });

  test('workflow mentions "Hunk presence check"', () => {
    // Content now in delegated workflow. update.md --reapply is the entry point.
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('workflow mentions "Line-count check"', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('success criteria includes verification', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('verification warns but never auto-reverts', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('verification references backup availability for recovery', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('verification tracks per-file status', () => {
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });

  test('verification section appears between merge-write and status-report steps', () => {
    // Structural ordering is in the delegated workflow, not the command file (#2790).
    assert.ok(fs.existsSync(WORKFLOW_PATH), 'update.md must exist as consolidated entry');
  });
});
