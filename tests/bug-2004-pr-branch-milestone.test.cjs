/**
 * Regression tests for bug #2004
 *
 * /gsd-pr-branch must not exclude milestone archive and structural planning
 * commits. The previous implementation filtered ALL .planning/-only commits,
 * including STATE.md, ROADMAP.md, MILESTONES.md, and milestones/** updates
 * that are needed to preserve repository planning state after a merge.
 *
 * Fixed: pr-branch.md now distinguishes:
 *   - Transient planning commits (phase plans, summaries, research, context) → EXCLUDE
 *   - Structural planning commits (STATE.md, ROADMAP.md, MILESTONES.md,
 *     PROJECT.md, milestones/**) → INCLUDE
 *   - Code commits (any non-.planning/ file) → INCLUDE
 *   - Mixed commits (code + planning) → INCLUDE
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.resolve(
  __dirname, '..', 'get-shit-done', 'workflows', 'pr-branch.md'
);

describe('bug #2004: pr-branch preserves structural planning commits', () => {
  let content;

  test('setup: pr-branch workflow is readable', () => {
    content = fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(content.length > 0, 'pr-branch.md must not be empty');
  });

  test('workflow distinguishes structural vs transient planning commits', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    // Must contain language distinguishing structural from transient/phase planning files
    assert.ok(
      /structural|milestone.*archive|STATE\.md.*INCLUDE|preserve.*milestone|milestone.*preserve/i.test(content),
      'pr-branch.md must distinguish structural planning commits from transient ones'
    );
  });

  test('workflow lists STATE.md and ROADMAP.md as structural files to preserve', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('STATE.md'),
      'pr-branch.md must reference STATE.md as a structural file to preserve'
    );
    assert.ok(
      content.includes('ROADMAP.md'),
      'pr-branch.md must reference ROADMAP.md as a structural file to preserve'
    );
  });

  test('workflow lists MILESTONES.md or milestones/ as structural files to preserve', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    assert.ok(
      content.includes('MILESTONES.md') || content.includes('milestones/'),
      'pr-branch.md must reference MILESTONES.md or milestones/ as structural files to preserve'
    );
  });

  test('workflow has four commit categories (code, planning-only, mixed, structural)', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    // Must have at least a "structural" or "milestone" category beyond the original three
    assert.ok(
      /structural.*commit|milestone.*commit|commit.*structural|commit.*milestone/i.test(content) ||
      /INCLUDE.*STATE\.md|STATE\.md.*INCLUDE/i.test(content),
      'pr-branch.md must classify structural planning commits as INCLUDE'
    );
  });

  test('create_pr_branch step does not rm -r --cached all of .planning/', () => {
    content = content || fs.readFileSync(workflowPath, 'utf-8');
    // The original bug: `git rm -r --cached .planning/` nuked structural files.
    // The fix must either remove this wholesale rm or scope it to transient dirs.
    // Acceptable: narrowed rm targeting only phase/, quick/, research/, etc.
    // Not acceptable: `git rm -r --cached .planning/` with no scoping.
    const hasUnscoped = /git rm -r --cached \.planning\/(?!\*)?(?!phases|quick|research|threads|todos|debug|seeds|ui-reviews|codebase)/
      .test(content);
    assert.ok(
      !hasUnscoped,
      'create_pr_branch must not use unscoped "git rm -r --cached .planning/" — scope to transient subdirectories only'
    );
  });
});
