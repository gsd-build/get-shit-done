/**
 * Regression test for bug #2980
 *
 * The release-sdk hotfix cherry-pick loop's `fix:`/`chore:` filter is
 * too broad: it picks anything with that conventional-commit type
 * regardless of whether the diff can affect the published npm package.
 * That caused two compounding problems:
 *
 *   1. CI-only fixes (release-sdk.yml, hotfix tooling) were cherry-picked
 *      into hotfix branches even though they cannot change what ships.
 *   2. The subset of those CI-only fixes touching `.github/workflows/*`
 *      caused the prepare job's `git push` to be rejected by GitHub —
 *      the default GITHUB_TOKEN lacks the `workflow` scope:
 *
 *         ! [remote rejected] hotfix/X.YY.Z -> hotfix/X.YY.Z
 *           (refusing to allow a GitHub App to create or update workflow
 *            ... without `workflows` permission)
 *
 *      v1.39.1 hit this on PR #2977 (run 25232010071): #2977 cherry-
 *      picked cleanly because earlier workflow-file fixes had been
 *      skipped on conflict, then the push exploded.
 *
 * Fix (root cause): pre-pick guard that checks whether the candidate
 * commit's diff intersects the npm tarball's shipped paths (entries in
 * `package.json` `files` plus `package.json` itself). Non-shipping
 * commits are skipped with an informational summary entry; the
 * workflow-file rejection is now a non-issue because workflow files
 * are not in `files`.
 *
 * The shipped-paths classifier lives in
 * `scripts/diff-touches-shipped-paths.cjs` rather than inline in the
 * workflow YAML so its rules are unit-testable.
 *
 * This test covers two layers:
 *   - Static workflow assertions (the loop calls the script before
 *     attempting the pick, the result drives a NON_SHIPPED_SKIPPED
 *     bucket, and the run summary surfaces it).
 *   - Behavioral assertions on the classifier script itself (matches
 *     `npm pack` semantics for `files` entries).
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// release-sdk.yml IS the product for hotfix automation; the static
// assertions extract the "Prepare hotfix branch" run block via
// indentation-aware YAML parsing rather than raw-text grep across the
// whole document.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.join(__dirname, '..');
const WORKFLOW_PATH = path.join(REPO_ROOT, '.github', 'workflows', 'release-sdk.yml');
const CLASSIFIER_PATH = path.join(REPO_ROOT, 'scripts', 'diff-touches-shipped-paths.cjs');

function extractStepRun(workflowText, stepName) {
  const lines = workflowText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- name:\s*(.+?)\s*$/);
    if (!m || m[2] !== stepName) continue;
    const stepIndent = m[1].length;
    let j = i + 1;
    while (j < lines.length) {
      const peek = lines[j];
      if (/^\s*- /.test(peek)) {
        const peekIndent = peek.match(/^(\s*)/)[1].length;
        if (peekIndent <= stepIndent) break;
      }
      const runMatch = peek.match(/^(\s*)run:\s*\|(?:[+-])?\s*$/);
      if (runMatch) {
        const blockIndent = runMatch[1].length + 2;
        const body = [];
        for (let k = j + 1; k < lines.length; k++) {
          const bodyLine = lines[k];
          if (bodyLine.length === 0) {
            body.push('');
            continue;
          }
          const lead = bodyLine.match(/^(\s*)/)[1].length;
          if (lead < blockIndent && bodyLine.trim() !== '') break;
          body.push(bodyLine.slice(blockIndent));
        }
        return body.join('\n');
      }
      j++;
    }
    throw new Error(`step "${stepName}" found but no run: | block before step end`);
  }
  throw new Error(`step "${stepName}" not found in workflow`);
}

/**
 * Slice the lines from the merge-commit pre-skip guard up to (but not
 * including) the cherry-pick attempt. Any new pre-pick guard MUST live
 * in this region to fire before the pick.
 */
function extractPrePickRegion(script) {
  const lines = script.split('\n');
  const startIdx = lines.findIndex(l => /merge commit — manual -m parent selection required/.test(l));
  if (startIdx === -1) throw new Error('merge-commit pre-skip guard not found — sentinel for pre-pick region');
  const endIdx = lines.findIndex((l, i) => i > startIdx && /git[^\n]*cherry-pick[^\n]*"\$SHA"/.test(l));
  if (endIdx === -1) throw new Error('cherry-pick attempt not found after merge-commit guard');
  return lines.slice(startIdx, endIdx).join('\n');
}

describe('bug-2980: release-sdk hotfix only picks commits that touch shipped paths', () => {
  test('pre-pick guard runs the shipped-paths classifier before attempting the pick', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    // Must call the classifier script. Inline grep on `.github/workflows/`
    // would only catch the workflow-file subset of the bug — the broader
    // root cause is "any non-shipping commit in a hotfix is meaningless"
    // and the classifier encodes the precise `files`-whitelist rule.
    assert.match(
      prePick,
      /git diff-tree --no-commit-id --name-only -r "\$SHA"/,
      'pre-pick region must extract the candidate SHA\'s file list with `git diff-tree` so the classifier has accurate input (#2980)'
    );
    // After #2983 the classifier is invoked via the staged $CLASSIFIER
    // variable (not the in-tree path), to survive the working-tree swap
    // performed by `git checkout -b "$BRANCH" "$BASE_TAG"`. Either form
    // proves the classifier participates; the bug-2983 test enforces
    // the staged-path form specifically.
    assert.match(
      prePick,
      /node "\$CLASSIFIER"/,
      'pre-pick region must invoke `node "$CLASSIFIER"` (the staged classifier) — the in-tree path is unsafe after the base-tag checkout (#2980, #2983)'
    );
    // Skip-on-exit-1 dispatch: pre-#2983 used `if ! ... ; then skip`,
    // but that conflated classifier errors (exit 2+) with the
    // legitimate "not shipped" signal. Post-#2983 the dispatch is
    // explicit `case "$CLASSIFIER_RC" in 1) skip ;; *) error ;; esac`.
    // This test accepts the modern form; bug-2983 enforces it.
    assert.match(
      prePick,
      /case "\$CLASSIFIER_RC" in[\s\S]+?1\)[\s\S]+?continue/,
      'pre-pick region must skip on exit 1 via case-dispatch on $CLASSIFIER_RC — the post-#2983 shape that distinguishes "not shipped" from classifier errors (#2980, #2983)'
    );
  });

  test('non-shipped skips land in NON_SHIPPED_SKIPPED, distinct from CONFLICT_SKIPPED and POLICY_SKIPPED', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    assert.match(
      prePick,
      /^\s*NON_SHIPPED_SKIPPED="\$\{NON_SHIPPED_SKIPPED\}/m,
      'non-shipped skip must append to NON_SHIPPED_SKIPPED — distinct from CONFLICT_SKIPPED (manual-review queue) and POLICY_SKIPPED (feat/refactor exclusions) (#2980)'
    );
    // The bucket must be initialized at the top of the loop alongside
    // the other two — so a future `set -u` doesn't silently break it.
    assert.match(
      script,
      /^\s*NON_SHIPPED_SKIPPED=""\s*$/m,
      'NON_SHIPPED_SKIPPED must be initialized to empty alongside POLICY_SKIPPED and CONFLICT_SKIPPED (#2980)'
    );
  });

  test('non-shipped skip emits no ::warning:: — the change cannot affect the package', () => {
    // A non-shipped commit is by definition incapable of changing what
    // ships, so the skip needs no operator alert. The summary bucket is
    // informational; a yellow warning would imply remediation is
    // possible, which would mislead operators.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    assert.doesNotMatch(
      prePick,
      /::warning::/,
      'non-shipped skip must NOT emit a ::warning:: — the commit cannot change what ships, so a warning would falsely imply remediation is needed (#2980)'
    );
  });

  test('run summary surfaces NON_SHIPPED_SKIPPED in its own section, framed as informational', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /if \[ -n "\$NON_SHIPPED_SKIPPED" \]/,
      'run summary must conditionally render the NON_SHIPPED_SKIPPED bucket so empty hotfixes don\'t print an empty section (#2980)'
    );
    // The header must NOT use "manual review" framing — that's the
    // CONFLICT_SKIPPED queue. Non-shipped skips need no manual action.
    assert.doesNotMatch(
      script,
      /Skipped — touches no shipped paths[^\n]*manual review/,
      'NON_SHIPPED_SKIPPED summary header must NOT imply manual review — non-shipping commits need no remediation (#2980)'
    );
    assert.match(
      script,
      /Skipped — touches no shipped paths[^\n]*informational/,
      'NON_SHIPPED_SKIPPED summary header must signal "informational" so operators don\'t mistake it for the manual-review queue (#2980)'
    );
  });
});

describe('bug-2980: scripts/diff-touches-shipped-paths.cjs classifier semantics', () => {
  function runClassifier(stdin, cwd) {
    return spawnSync('node', [CLASSIFIER_PATH], {
      cwd,
      input: stdin,
      encoding: 'utf8',
    });
  }

  function makeFixtureRepo(filesArray) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2980-'));
    fs.writeFileSync(
      path.join(tmp, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '0.0.0', files: filesArray }, null, 2)
    );
    return tmp;
  }

  test('directory entry in `files` matches paths under that directory but not sibling prefixes', () => {
    const tmp = makeFixtureRepo(['bin', 'sdk/dist']);
    try {
      // bin/foo.js is shipped (under bin/).
      assert.equal(runClassifier('bin/foo.js\n', tmp).status, 0, 'bin/foo.js must be shipped');
      // bin alone (the directory entry itself) is shipped.
      assert.equal(runClassifier('bin\n', tmp).status, 0, 'bin (exact match) must be shipped');
      // binaries/foo.js must NOT match bin (prefix-without-slash bug).
      assert.equal(runClassifier('binaries/foo.js\n', tmp).status, 1, 'binaries/foo.js must NOT match bin/ — prefix without slash boundary is a classic bug');
      // sdk/dist/cli.js is shipped.
      assert.equal(runClassifier('sdk/dist/cli.js\n', tmp).status, 0, 'sdk/dist/cli.js must be shipped');
      // sdk/src/cli.ts is NOT shipped (only sdk/dist is in `files`).
      assert.equal(runClassifier('sdk/src/cli.ts\n', tmp).status, 1, 'sdk/src/cli.ts must NOT be shipped when only sdk/dist is whitelisted');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('package.json is always shipped even when not in `files`', () => {
    // `npm pack` always includes package.json regardless of `files`. The
    // classifier must mirror that, so a version-bump-only commit isn't
    // wrongly skipped.
    const tmp = makeFixtureRepo([]);
    try {
      assert.equal(runClassifier('package.json\n', tmp).status, 0, 'package.json must be classified as shipped — `npm pack` always includes it');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('package-lock.json is NOT shipped unless explicitly in `files`', () => {
    // `npm pack` does NOT include package-lock.json by default. A
    // lockfile-only commit can't change the published package's runtime
    // behavior (consumers resolve their own lockfile from `dependencies`).
    const tmp = makeFixtureRepo(['bin']);
    try {
      assert.equal(runClassifier('package-lock.json\n', tmp).status, 1, 'package-lock.json must NOT be classified as shipped when absent from `files` — `npm pack` excludes it by default');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('mixed diff is shipped if ANY path is shipped', () => {
    // A commit that touches both a shipped file and a non-shipped file
    // must be classified as shipped — the non-shipped paths are along
    // for the ride, but the commit can still affect what ships.
    const tmp = makeFixtureRepo(['bin']);
    try {
      const stdin = '.github/workflows/release-sdk.yml\nbin/foo.js\ntests/bar.test.cjs\n';
      assert.equal(runClassifier(stdin, tmp).status, 0, 'mixed diff with at least one shipped path must classify as shipped');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('purely CI/test/docs commit is NOT shipped (the actual #2980 case)', () => {
    // The classic case: a fix(release-sdk): commit that touches only
    // .github/workflows/release-sdk.yml and a regression test under
    // tests/. Pre-#2980 the loop picked it; the cherry-pick succeeded;
    // the push then failed because of the workflow-file scope rule.
    // Post-#2980 the loop skips it pre-pick — the push problem and the
    // "meaningless pick" problem dissolve together.
    const tmp = makeFixtureRepo(['bin', 'commands', 'sdk/dist']);
    try {
      const stdin = '.github/workflows/release-sdk.yml\ntests/bug-2980-shipped-paths.test.cjs\nCHANGELOG.md\n';
      assert.equal(runClassifier(stdin, tmp).status, 1, 'CI-only commit (workflow + test + changelog) must classify as NOT shipped — the canonical #2980 case');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('empty stdin classifies as not-shipped (defensive — empty diff means no candidate paths)', () => {
    const tmp = makeFixtureRepo(['bin']);
    try {
      assert.equal(runClassifier('', tmp).status, 1, 'empty stdin must classify as not-shipped — no paths can\'t intersect any whitelist');
      assert.equal(runClassifier('\n\n\n', tmp).status, 1, 'whitespace-only stdin must classify as not-shipped');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
