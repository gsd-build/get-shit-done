/**
 * Regression test for bug #2983
 *
 * Two compounding bugs surfaced by CodeRabbit's post-merge review of
 * PR #2981 (which shipped #2980's shipped-paths cherry-pick filter):
 *
 * 1. Overloaded exit code: scripts/diff-touches-shipped-paths.cjs
 *    used exit 1 for the legitimate classifier result "no shipped
 *    paths." Node's default exit on uncaught throw is also 1, so any
 *    classifier failure was indistinguishable from a normal skip.
 *    The workflow's `if ! ... ; then skip` idiom would silently drop
 *    a commit on tool failure.
 *
 * 2. Classifier missing at the base tag: the workflow runs
 *    `git checkout -b "$BRANCH" "$BASE_TAG"` BEFORE the cherry-pick
 *    loop, which replaces the working tree with the base tag's
 *    contents. Base tags predating #2980 (notably v1.39.0, the most
 *    likely next hotfix base) don't have
 *    `scripts/diff-touches-shipped-paths.cjs` at all. `node <missing>`
 *    exits non-zero → workflow treats as "not shipped" → every
 *    commit gets silently dropped → empty hotfix branch published.
 *    This is strictly worse than the original #2980 push-rejection,
 *    which at least failed loudly.
 *
 * Fix:
 *   - Script: distinct exit codes (0 = shipped, 1 = not shipped,
 *     2 = classifier error). All uncaught failure paths
 *     (uncaughtException, unhandledRejection, fs/JSON errors) route
 *     to exit 2.
 *   - Workflow: stage the classifier into $RUNNER_TEMP at the top of
 *     `Prepare hotfix branch` (before `git checkout -b "$BASE_TAG"`)
 *     and reference $CLASSIFIER in the loop. Capture exit code via
 *     ${PIPESTATUS[1]} and dispatch via case: 0 → proceed, 1 → skip
 *     (NON_SHIPPED_SKIPPED), anything else → ::error:: + exit. The
 *     workflow refuses to start if the classifier source is missing
 *     in the dispatched ref.
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

describe('bug-2983: shipped-paths classifier exit-code discipline', () => {
  function runClassifier({ stdin, cwd }) {
    return spawnSync('node', [CLASSIFIER_PATH], {
      cwd,
      input: stdin,
      encoding: 'utf8',
    });
  }

  function makeFixtureRepo({ files, raw }) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2983-'));
    if (raw !== undefined) {
      fs.writeFileSync(path.join(tmp, 'package.json'), raw);
    } else if (files !== undefined) {
      fs.writeFileSync(
        path.join(tmp, 'package.json'),
        JSON.stringify({ name: 'fixture', version: '0.0.0', files }, null, 2)
      );
    }
    return tmp;
  }

  test('exit 0 still means "at least one shipped path"', () => {
    const tmp = makeFixtureRepo({ files: ['bin'] });
    try {
      const r = runClassifier({ stdin: 'bin/foo.js\n', cwd: tmp });
      assert.equal(r.status, 0, `expected exit 0 for shipped path; stderr=${r.stderr}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('exit 1 still means "no shipped paths" — preserved across the #2983 refactor', () => {
    const tmp = makeFixtureRepo({ files: ['bin'] });
    try {
      const r = runClassifier({ stdin: 'tests/foo.test.cjs\n.github/workflows/release-sdk.yml\n', cwd: tmp });
      assert.equal(r.status, 1, `expected exit 1 for non-shipping diff; stderr=${r.stderr}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('exit 2 when package.json is missing — distinguishable from "not shipped"', () => {
    // Run in a temp dir with no package.json. Pre-#2983 this would
    // surface as exit 1 (Node default for uncaught throw), which the
    // workflow would have silently treated as "not shipped." Post-fix
    // it's exit 2, which the workflow MUST treat as a hard error.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bug-2983-no-pkg-'));
    try {
      const r = runClassifier({ stdin: 'bin/foo.js\n', cwd: tmp });
      assert.equal(r.status, 2, `expected exit 2 for missing package.json; got ${r.status}; stderr=${r.stderr}`);
      assert.match(r.stderr, /diff-touches-shipped-paths/, 'classifier error must be tagged in stderr so the workflow operator can find it');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('exit 2 when package.json is malformed JSON', () => {
    const tmp = makeFixtureRepo({ raw: '{ this is not json' });
    try {
      const r = runClassifier({ stdin: 'bin/foo.js\n', cwd: tmp });
      assert.equal(r.status, 2, `expected exit 2 for malformed package.json; got ${r.status}; stderr=${r.stderr}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('module exports the exit-code constants so workflow tests can reference them by name', () => {
    // Decoupling intent (EXIT_NOT_SHIPPED) from value (1) is what makes
    // a future "let's renumber" edit safe. Importers should reference
    // the constants, not the literals.
    const mod = require(CLASSIFIER_PATH);
    assert.equal(mod.EXIT_SHIPPED, 0, 'EXIT_SHIPPED must be 0');
    assert.equal(mod.EXIT_NOT_SHIPPED, 1, 'EXIT_NOT_SHIPPED must be 1');
    assert.equal(mod.EXIT_ERROR, 2, 'EXIT_ERROR must be 2 (distinct from 0 and 1)');
  });
});

describe('bug-2983: workflow stages the classifier and dispatches on exit code', () => {
  test('classifier is staged into $RUNNER_TEMP before any working-tree-mutating git command', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // The staging cp must appear before `git checkout -b ... "$BASE_TAG"`
    // — that's the operation that overwrites the working tree with the
    // base tag's contents, which may not contain the classifier.
    const stageIdx = script.search(/cp "\$CLASSIFIER_SRC" "\$CLASSIFIER"/);
    const checkoutIdx = script.search(/git checkout -b "\$BRANCH" "\$BASE_TAG"/);
    assert.ok(
      stageIdx !== -1,
      'workflow must `cp` the classifier from its in-tree path to a stable location ($CLASSIFIER) before the working tree is swapped (#2983)'
    );
    assert.ok(
      checkoutIdx !== -1,
      'workflow must contain the base-tag checkout — sentinel that establishes the staging-must-precede ordering constraint'
    );
    assert.ok(
      stageIdx < checkoutIdx,
      `classifier staging must precede \`git checkout -b ... "$BASE_TAG"\` so the source file isn't already gone (#2983). Found stage at offset ${stageIdx}, checkout at ${checkoutIdx}.`
    );
  });

  test('staging targets $RUNNER_TEMP — survives the working-tree swap and is auto-cleaned by the runner', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /CLASSIFIER="\$\{RUNNER_TEMP\}\/diff-touches-shipped-paths\.cjs"/,
      '$CLASSIFIER must point at $RUNNER_TEMP — that path survives `git checkout` (lives outside the repo) and is cleaned automatically by the runner (#2983)'
    );
  });

  test('workflow refuses to run if the classifier source is missing in the dispatched ref', () => {
    // Defense in depth: if a future edit reorders the steps so the
    // first checkout doesn't put the classifier on disk, the workflow
    // must fail loudly rather than skip every commit.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /if \[ ! -f "\$CLASSIFIER_SRC" \][\s\S]{0,200}::error::shipped-paths classifier not found/,
      'workflow must fail-fast if scripts/diff-touches-shipped-paths.cjs is missing in the dispatched ref (#2983)'
    );
    assert.match(
      script,
      /if \[ ! -f "\$CLASSIFIER" \][\s\S]{0,200}failed to stage classifier/,
      'workflow must fail-fast if cp didn\'t actually produce $CLASSIFIER (defense against silent cp failure on RUNNER_TEMP corner cases) (#2983)'
    );
  });

  test('cherry-pick loop captures classifier exit code via $PIPESTATUS and dispatches on the value', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // The pre-#2983 form was `if ! ... | node ...; then skip; fi` which
    // collapses every non-zero exit (including missing-script and
    // uncaught-throw cases) into the skip path. The required new shape
    // is: run the pipeline, snapshot $PIPESTATUS into a local array
    // immediately, dispatch via case.
    //
    // CodeRabbit on PR #2984 caught a subtler bug in the first iteration
    // of this fix: `pipeline || true; RC=${PIPESTATUS[1]}` doesn't work
    // because `|| true` runs `true` as a one-command pipeline when the
    // pipeline fails (exit 1 or 2 — exactly the cases we care about),
    // overwriting PIPESTATUS to (0). The hardened form snapshots
    // PIPESTATUS into a local array on the line immediately after the
    // pipeline, with no intervening commands.
    assert.match(
      script,
      /PIPE_RC=\("\$\{PIPESTATUS\[@\]\}"\)/,
      'cherry-pick loop must snapshot the entire $PIPESTATUS array via `PIPE_RC=("${PIPESTATUS[@]}")` immediately after the classifier pipeline — `${PIPESTATUS[1]}` direct-read is unsafe under any subsequent simple command, and `|| true; ${PIPESTATUS[1]}` is broken because `|| true` runs `true` as its own pipeline on the failure paths (CodeRabbit on PR #2984)'
    );
    // The pipeline must run under `set +e` to allow the snapshot — at
    // the workflow's top-level `set -euo pipefail`, a non-zero exit
    // from the pipeline would otherwise terminate the step before the
    // snapshot line runs.
    assert.match(
      script,
      /set \+e[\s\S]{0,200}node "\$CLASSIFIER"[\s\S]{0,80}PIPE_RC=\("\$\{PIPESTATUS\[@\]\}"\)[\s\S]{0,40}set -e/,
      'classifier pipeline must be wrapped `set +e` ... pipeline ... `PIPE_RC=("${PIPESTATUS[@]}")` ... `set -e` — any other shape either misses the snapshot or terminates the step early (#2983, CodeRabbit on PR #2984)'
    );
    // Must NOT use the broken `pipeline || true; RC=${PIPESTATUS[1]}` form.
    // The `|| true` rewrites PIPESTATUS on the failure paths.
    assert.doesNotMatch(
      script,
      /node "\$CLASSIFIER"\s*\|\|\s*true\s*\n\s*CLASSIFIER_RC="\$\{PIPESTATUS\[1\]\}"/,
      'classifier pipeline must NOT use `|| true` followed by `${PIPESTATUS[1]}` — `|| true` runs `true` as a one-command pipeline on the failure paths and overwrites PIPESTATUS to (0), so PIPESTATUS[1] becomes unset (CodeRabbit on PR #2984)'
    );
    // Must NOT use the original `if ! ... | node ...; then` shape either.
    assert.doesNotMatch(
      script,
      /if ! git diff-tree[\s\S]{0,200}node[\s\S]{0,200}\.cjs[^|\n]*; then/,
      'cherry-pick loop must NOT use `if ! ... | node classifier; then skip` — that shape silently treats classifier errors as skips (#2983)'
    );
    // The case dispatch must explicitly handle 0, 1, and a default branch.
    assert.match(
      script,
      /case "\$CLASSIFIER_RC" in[\s\S]+?0\)[\s\S]+?1\)[\s\S]+?\*\)/,
      'case dispatch on $CLASSIFIER_RC must list 0, 1, and a default-error branch in that order so each is handled explicitly (#2983)'
    );
  });

  test('git diff-tree failure is also fail-fast (not silently classified as not-shipped)', () => {
    // The new array-snapshot form gives us $DIFFTREE_RC for free.
    // git diff-tree is unlikely to fail on a known-good $SHA, but if
    // it does (e.g., $SHA is corrupt or fetch was incomplete), we must
    // not pipe partial/empty output into the classifier and call it
    // "not shipped." Fail-fast with ::error:: instead.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /DIFFTREE_RC="\$\{PIPE_RC\[0\]\}"/,
      'workflow must extract git diff-tree\'s exit from PIPE_RC[0] so a partial-pipeline failure can be distinguished from a clean classifier result (CodeRabbit on PR #2984)'
    );
    assert.match(
      script,
      /if \[ "\$DIFFTREE_RC" -ne 0 \][\s\S]{0,200}::error::git diff-tree failed/,
      'workflow must emit ::error:: and exit when git diff-tree itself fails — silently passing partial input to the classifier would defeat the whole point of #2983 (CodeRabbit on PR #2984)'
    );
  });

  test('hotfix run summary no longer falsely advertises a merge-back PR', () => {
    // CodeRabbit on PR #2984: the Summary block still printed
    // "Merge-back PR opened against main" even though the merge-back
    // step was removed. Operators reading the summary would expect a PR
    // that was never opened. Replace with explicit non-action text so
    // the summary accurately describes what happened.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');

    assert.doesNotMatch(
      yaml,
      /echo "- Merge-back PR opened against main"/,
      'run summary must NOT advertise a merge-back PR — the step was removed in #2983 and the line is stale (CodeRabbit on PR #2984)'
    );
    assert.match(
      yaml,
      /No merge-back PR \(auto-picked commits are already on main\)/,
      'run summary must explicitly state that no merge-back PR exists, with the rationale, so operators understand it\'s intentional rather than missing (CodeRabbit on PR #2984)'
    );
  });

  test('default-error branch fails the workflow with ::error:: rather than continuing', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // Must emit ::error:: AND exit non-zero. Either alone is
    // insufficient: ::error:: without exit just decorates the log;
    // exit without ::error:: hides the cause.
    assert.match(
      script,
      /\*\)[\s\S]+?::error::shipped-paths classifier failed[\s\S]+?exit "\$CLASSIFIER_RC"/,
      'classifier-error branch must emit ::error:: AND `exit "$CLASSIFIER_RC"` — silently continuing would defeat the whole point of #2983 (#2983)'
    );
  });

  test('merge-back PR step is removed (auto-cherry-pick hotfix has nothing to merge back)', () => {
    // Auto-cherry-pick only picks commits already on main, so by
    // construction every code change on the hotfix branch is already
    // there. The only hotfix-branch-only commit is `chore: bump version
    // ... for hotfix`, which either no-ops or rewinds main's
    // in-progress version. The merge-back step was vestigial and was
    // additionally blocked by org policy ("GitHub Actions is not
    // permitted to create or approve pull requests"). Run 25232968975
    // was the trigger.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    assert.doesNotMatch(
      yaml,
      /Open merge-back PR \(hotfix only\)/,
      'merge-back PR step must be removed — nothing to merge back when every commit is already on main (#2983)'
    );
    assert.doesNotMatch(
      yaml,
      /chore: merge hotfix v\$\{VERSION\} back to main/,
      'merge-back PR title must be gone — vestigial from a different release flow (#2983)'
    );
    // Job-level pull-requests permission was granted solely for the
    // merge-back step. Removing the step means revoking the permission
    // (least-privilege).
    assert.doesNotMatch(
      yaml,
      /pull-requests: write/,
      'release job must NOT request `pull-requests: write` after the merge-back removal — least-privilege requires dropping the unused scope (#2983)'
    );
  });

  test('the staged path is what the loop invokes, not the in-tree path', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // Find the cherry-pick loop's classifier invocation and ensure it
    // references "$CLASSIFIER", not scripts/diff-touches-shipped-paths.cjs
    // directly. Allowing the in-tree path here would re-introduce the
    // base-tag-missing bug.
    const loopAnchor = script.indexOf('CANDIDATES=$(git cherry HEAD origin/main');
    assert.ok(loopAnchor !== -1, 'cherry-pick loop sentinel not found');
    // 8 KB window matching the bug-2964 test's bound (raised from 6 KB
    // when the PIPESTATUS-snapshot hardening on PR for #2984's CR
    // findings pushed the cherry-pick call further past the loop anchor).
    const window = script.slice(loopAnchor, loopAnchor + 8000);
    assert.match(
      window,
      /node "\$CLASSIFIER"/,
      'cherry-pick loop must invoke `node "$CLASSIFIER"` (the staged copy), not `node scripts/diff-touches-shipped-paths.cjs` (the in-tree path) — the in-tree path may have been replaced by `git checkout -b "$BASE_TAG"` (#2983)'
    );
    assert.doesNotMatch(
      window,
      /node scripts\/diff-touches-shipped-paths\.cjs/,
      'cherry-pick loop must NOT invoke `node scripts/diff-touches-shipped-paths.cjs` — base tags predating #2980 don\'t have that file in their tree (#2983)'
    );
  });
});
