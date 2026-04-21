/**
 * Regression test for #2501.
 *
 * The worktree-merge resurrection-detection block introduced by #1764
 * had inverted logic: it staged `git rm` against every path that the
 * merge commit added under `.planning/` — including legitimate new
 * files from executor agents (SUMMARY.md etc.).
 *
 * Failure mode in parallel mode: first worktree merges, post-merge
 * loop stages `rm` on its own `SUMMARY.md`, second worktree's merge
 * aborts with "Your local changes to the following files would be
 * overwritten by merge".
 *
 * Fix: the check must ask git history whether the candidate path was
 * ever deleted on main — not merely whether it existed in main's tree
 * immediately before the merge.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const EXECUTE_PHASE_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'execute-phase.md');
const QUICK_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'quick.md');

const FILES = [
  { label: 'execute-phase.md', path: EXECUTE_PHASE_PATH },
  { label: 'quick.md',          path: QUICK_PATH },
];

describe('worktree merge: resurrection detection (#2501)', () => {
  for (const { label, path: p } of FILES) {
    test(`${label} does not delete every newly-added path under .planning/`, () => {
      const content = fs.readFileSync(p, 'utf-8');

      // The broken pattern checked "not in pre-merge tree" and staged rm.
      // Any fresh file (like SUMMARY.md) satisfies that trivially, so the
      // pattern must be gone.
      assert.ok(
        !/PRE_MERGE_FILES=\$\(git ls-files/.test(content),
        `${label} still snapshots PRE_MERGE_FILES — the inverted resurrection check must be removed (#2501)`,
      );

      assert.ok(
        !/if ! echo "\$PRE_MERGE_FILES" \| grep -qxF/.test(content),
        `${label} still contains the broken "not in pre-merge tree → rm" condition (#2501)`,
      );
    });

    test(`${label} uses git history to identify true resurrections`, () => {
      const content = fs.readFileSync(p, 'utf-8');

      // The correct check consults git log for prior deletions of the
      // candidate path. Without this, we cannot distinguish a brand-new
      // SUMMARY.md from an archived phase directory being re-added.
      assert.ok(
        /git log HEAD~1 --diff-filter=D/.test(content),
        `${label} must use \`git log HEAD~1 --diff-filter=D\` to detect true resurrections (#2501)`,
      );
    });

    test(`${label} amend condition references the new resurrection variable`, () => {
      const content = fs.readFileSync(p, 'utf-8');

      // The amend guard previously checked [ -n "$DELETED_FILES" ] — that
      // variable name is misleading (it held added paths) and is removed
      // together with the broken loop. The amend should now key off the
      // new RESURRECTED_FILES variable.
      assert.ok(
        /\[ -n "\$RESURRECTED_FILES" \]/.test(content),
        `${label} amend condition must reference RESURRECTED_FILES (#2501)`,
      );
    });
  }
});
