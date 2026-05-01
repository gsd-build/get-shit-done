/**
 * Regression test for bug #2964
 *
 * The release-sdk hotfix workflow's auto_cherry_pick loop aborted the entire
 * run if any commit between the base tag and origin/main had an empty diff
 * against its parent (e.g. a squash-merge whose contents were already merged
 * via an earlier PR). `git cherry-pick -x` exits non-zero on empty commits
 * with "The previous cherry-pick is now empty", and the workflow's loop
 * (`if ! git cherry-pick -x "$SHA"; then ... exit 1`) treated any non-zero
 * as a hard conflict — bricking every hotfix the moment a no-op commit
 * landed on main.
 *
 * Fix: pass `--allow-empty --keep-redundant-commits` so empty picks are
 * preserved on the hotfix branch (with `-x` provenance, matching main 1:1)
 * and picks whose diff resolves to empty after applying to the new base
 * also pass cleanly. Real conflicts still surface — the flags only change
 * the empty-commit exit code.
 *
 * This test asserts both:
 *   1. Static — the workflow YAML carries the flags on the cherry-pick call
 *      inside the auto_cherry_pick loop. If a future edit drops them, this
 *      regresses immediately.
 *   2. Behavioral — `git cherry-pick -x --allow-empty --keep-redundant-commits`
 *      against a real empty commit in a throwaway repo exits 0 (proves the
 *      flags semantically do what we claim), while plain `git cherry-pick -x`
 *      exits non-zero against the same commit (proves the bug exists without
 *      the flags).
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// The release-sdk.yml workflow IS the product for hotfix automation —
// GitHub Actions executes the YAML's shell verbatim. Testing the text
// content tests the deployed contract: if the flags are absent, the
// empty-commit guarantee is absent.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'release-sdk.yml');

function git(cwd, args, env = {}) {
  // Force-disable signing inline so a developer's global gpgsign / sshsign
  // config can't fail commits in this throwaway repo. Don't rely on env
  // because gpg.format/user.signingkey live in gitconfig, not env vars.
  const signingOff = ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', '-c', 'gpg.format=openpgp', '-c', 'user.signingkey='];
  return spawnSync('git', [...signingOff, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env, GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 't@t' },
  });
}

describe('bug-2964: release-sdk hotfix cherry-pick survives empty commits', () => {
  test('release-sdk.yml passes --allow-empty --keep-redundant-commits in the auto_cherry_pick loop', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');

    // Find the auto_cherry_pick block by anchoring on a line unique to it,
    // then assert the cherry-pick invocation inside that block carries both
    // flags. We deliberately scope to the loop — a stray `git cherry-pick`
    // elsewhere in the file (none today) would not satisfy this contract.
    const loopAnchor = yaml.indexOf('CANDIDATES=$(git cherry HEAD origin/main');
    assert.ok(
      loopAnchor !== -1,
      'release-sdk.yml must contain the auto_cherry_pick loop that derives candidates via `git cherry HEAD origin/main` (#2964)'
    );

    // The cherry-pick call lives within the auto_cherry_pick loop. Bound
    // the slice generously after the anchor so future pre-skip guards /
    // classification scaffolding (e.g. the merge-commit pre-skip added
    // on PR #2970, the workflow-file pre-skip added on PR for #2980,
    // the PIPESTATUS-snapshot hardening added on PR for #2984's CR
    // findings) don't push the call out of range, but still tight
    // enough to avoid matching unrelated cherry-pick refs elsewhere in
    // the workflow file.
    // Allow arbitrary git options between `git` and `cherry-pick` (e.g.
    // `git -c merge.conflictStyle=merge cherry-pick ...` added for #2966)
    // so this test doesn't false-fail on legitimate option additions.
    const window = yaml.slice(loopAnchor, loopAnchor + 8000);
    const pickMatch = /git\b[^\n]*?cherry-pick[^\n]*"\$SHA"/.exec(window);
    assert.ok(
      pickMatch,
      'auto_cherry_pick loop must invoke `git ... cherry-pick ... "$SHA"` (#2964)'
    );

    const pickLine = pickMatch[0];
    assert.ok(
      pickLine.includes('--allow-empty'),
      `auto_cherry_pick must pass --allow-empty so empty no-op commits on main do not abort the hotfix (#2964). Found: ${pickLine}`
    );
    assert.ok(
      pickLine.includes('--keep-redundant-commits'),
      `auto_cherry_pick must pass --keep-redundant-commits so commits whose diff resolves to empty after rebasing onto the base tag do not abort the hotfix (#2964). Found: ${pickLine}`
    );
  });

  test('git cherry-pick with --allow-empty --keep-redundant-commits succeeds on an empty commit; without them it fails', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2964-'));
    try {
      // Build a synthetic repo with one real commit on main and one truly
      // empty commit on top — same shape as the real upstream artifact
      // (b328f326 on origin/main has tree == its parent's tree).
      assert.equal(git(tmp, ['init', '-q', '-b', 'main']).status, 0, 'git init');
      fs.writeFileSync(path.join(tmp, 'README.md'), 'base\n');
      assert.equal(git(tmp, ['add', 'README.md']).status, 0, 'git add');
      assert.equal(git(tmp, ['commit', '-q', '-m', 'base']).status, 0, 'base commit');
      assert.equal(git(tmp, ['tag', 'v0.0.0']).status, 0, 'tag base');
      // Make a genuinely empty commit on main.
      assert.equal(git(tmp, ['commit', '--allow-empty', '-q', '-m', 'fix: noop on main']).status, 0, 'empty commit');
      const empty = git(tmp, ['rev-parse', 'HEAD']).stdout.trim();
      assert.ok(empty.length === 40, `expected sha, got ${empty}`);

      // Reset to the base tag (simulates the hotfix branch starting from v0.0.0).
      assert.equal(git(tmp, ['checkout', '-q', '-b', 'hotfix/0.0.1', 'v0.0.0']).status, 0, 'checkout hotfix');

      // Without the flags: cherry-pick of an empty commit fails.
      const without = git(tmp, ['cherry-pick', '-x', empty]);
      assert.notEqual(
        without.status,
        0,
        'plain `git cherry-pick -x` MUST fail on an empty commit — if this passes, git semantics changed and the bug premise is gone (#2964)'
      );
      // Reset cherry-pick state for the next run.
      git(tmp, ['cherry-pick', '--abort']);
      // git may have already auto-resolved to a clean state; ensure we're back to v0.0.0.
      git(tmp, ['reset', '--hard', 'v0.0.0']);

      // With the flags (matching what the workflow now uses): success.
      const withFlags = git(tmp, ['cherry-pick', '-x', '--allow-empty', '--keep-redundant-commits', empty]);
      assert.equal(
        withFlags.status,
        0,
        `git cherry-pick -x --allow-empty --keep-redundant-commits MUST succeed on an empty commit (#2964). stderr: ${withFlags.stderr}`
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
