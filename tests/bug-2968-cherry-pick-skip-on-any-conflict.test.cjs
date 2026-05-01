/**
 * Regression test for bug #2968
 *
 * Full-automation policy: any cherry-pick conflict in the release-sdk
 * hotfix loop — context-missing OR real merge conflict — must be
 * skipped, logged to the SKIPPED list with a classified reason, and
 * the loop continues. The hotfix run completes with whatever applies
 * cleanly; the SKIPPED list is the operator's post-hoc review queue.
 *
 * Pre-#2968 behavior: real conflicts (HEAD section non-empty)
 * triggered the abort/push-partial/error path, blocking every hotfix
 * run whose base tag had diverged from main. v1.39.1 hit this on
 * commit 0fb992d (run 25227493387) because v1.39.0 was tagged on the
 * `feat/hermes-runtime-2841` branch, which had restructured files that
 * pre-hermes fixes still patched against the old structure.
 *
 * This test asserts the workflow:
 *   1. No longer carries the abort-on-real-conflict control flow
 *      (no `git cherry-pick --abort` followed by `exit 1` for picks
 *      that have unmerged paths).
 *   2. Calls `git cherry-pick --skip` unconditionally on any
 *      cherry-pick failure inside the auto_cherry_pick loop.
 *   3. Annotates the SKIPPED list with `merge conflict` for real
 *      conflicts (so operators can find them in the run summary).
 *   4. Still records `context absent at base` for the empty-HEAD case
 *      — the classifier's diagnostic value is preserved even though
 *      the control flow no longer branches on it.
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
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'release-sdk.yml');

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
 * Extract just the body of the `if ! git ... cherry-pick ... ; then ... fi`
 * conditional inside the auto_cherry_pick loop, so assertions can target
 * the failure path without matching unrelated cherry-pick references
 * (e.g. the operator-recovery hint in `$GITHUB_STEP_SUMMARY` echoes).
 *
 * Walks bash `if`/`fi` nesting to find the matching `fi` for the failure
 * branch — naïve string matching wouldn't survive nested conditionals.
 */
function extractCherryPickFailureBlock(script) {
  const lines = script.split('\n');
  const startIdx = lines.findIndex(l => /if ! git[^\n]*cherry-pick[^\n]*"\$SHA"; then/.test(l));
  if (startIdx === -1) throw new Error('cherry-pick failure conditional not found in auto_cherry_pick loop');
  let depth = 1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^\s*if[\s(]/.test(lines[i]) || /;\s*then\s*$/.test(lines[i])) depth++;
    if (/^\s*fi\s*$/.test(lines[i])) {
      depth--;
      if (depth === 0) return lines.slice(startIdx + 1, i).join('\n');
    }
  }
  throw new Error('matching `fi` for cherry-pick failure conditional not found');
}

describe('bug-2968: release-sdk hotfix cherry-pick skips all conflicts (full automation)', () => {
  test('cherry-pick failure path no longer carries abort-on-real-conflict control flow', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const failureBlock = extractCherryPickFailureBlock(script);

    // The failure block must NOT call `git cherry-pick --abort` — that was
    // the pre-#2968 behavior on real conflicts. Skip-on-any-conflict means
    // we never abort; we always --skip.
    assert.doesNotMatch(
      failureBlock,
      /git cherry-pick --abort/,
      'auto_cherry_pick failure path must not call `git cherry-pick --abort` — full-automation policy is to skip all conflicts (#2968)'
    );
    // The failure block must NOT exit 1 — that bricked every hotfix on
    // a divergent base tag. The workflow continues past conflicts now.
    assert.doesNotMatch(
      failureBlock,
      /exit 1/,
      'auto_cherry_pick failure path must not `exit 1` on cherry-pick conflicts — full-automation policy is to log and continue (#2968)'
    );
    // The failure block must NOT push --force-with-lease — that was the
    // recovery-state push for operator-resolvable conflicts. With
    // skip-on-any-conflict there's no partial-pick state to preserve.
    assert.doesNotMatch(
      failureBlock,
      /git push --force-with-lease/,
      'auto_cherry_pick failure path must not push partial state — full-automation policy is to skip and continue, no recovery state needed (#2968)'
    );
  });

  test('cherry-pick failure path always calls `git cherry-pick --skip` and appends to CONFLICT_SKIPPED', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const failureBlock = extractCherryPickFailureBlock(script);

    // All assertions on `failureBlock` are line-anchored (`^\s*...`, `m`
    // flag) so a comment that mentions a command — e.g. "Calling `--skip`
    // outside an in-progress cherry-pick exits non-zero" — can't satisfy
    // the assertion. Only executable shell lines count. CodeRabbit on
    // PR #2970.
    assert.match(
      failureBlock,
      /^\s*git cherry-pick --skip\b/m,
      'auto_cherry_pick failure path must call `git cherry-pick --skip` to clear cherry-pick state and continue the loop (#2968)'
    );
    // Conflict skips MUST go into a dedicated bucket — operators reviewing
    // the run summary need to find manual-review items without scanning
    // through policy-excluded feat/refactor/etc commits. Bug #2968.
    assert.match(
      failureBlock,
      /^\s*CONFLICT_SKIPPED="\$\{CONFLICT_SKIPPED\}/m,
      'auto_cherry_pick failure path must append to CONFLICT_SKIPPED (a separate bucket from POLICY_SKIPPED) so operators can find manual-review items in the run summary (#2968)'
    );
    assert.doesNotMatch(
      failureBlock,
      /^\s*SKIPPED="\$\{SKIPPED\}/m,
      'auto_cherry_pick failure path must NOT append to the legacy SKIPPED bucket — that buries manual-review conflicts under "feat/refactor/etc — not auto-included" (#2968)'
    );
    assert.match(
      failureBlock,
      /^\s*continue\s*$/m,
      'auto_cherry_pick failure path must `continue` the loop after skipping — full-automation policy is best-effort cherry-pick (#2968)'
    );
  });

  test('merge commits are pre-skipped before cherry-pick is attempted', () => {
    // Cherry-picking a merge commit requires `-m <parent>` which the loop
    // can't choose automatically. Without it, `git cherry-pick <merge-sha>`
    // fails BEFORE entering cherry-pick state — no CHERRY_PICK_HEAD — so
    // the unconditional `--skip` would also fail and brick the loop.
    // The loop must detect parent count > 1 and skip with a distinct
    // reason BEFORE invoking cherry-pick. CodeRabbit on PR #2970.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /git rev-list --parents -n 1 "\$SHA"/,
      'auto_cherry_pick must inspect parent count before invoking cherry-pick — merge commits need `-m <parent>` and we can\'t pick the parent automatically (#2968)'
    );
    assert.match(
      script,
      /merge commit — manual -m parent selection required/,
      'auto_cherry_pick must annotate merge-commit skips with a distinct reason so operators understand why the pick wasn\'t attempted (#2968)'
    );
  });

  test('classifier guards against unreadable / markerless unmerged paths', () => {
    // A degenerate unmerged file (missing, unreadable, or no conflict
    // markers) must NOT be misclassified as "context absent at base" — the
    // auto-skip path. Treat as real so the operator can investigate.
    // Also: `awk` runs under `set -e`; a non-zero exit on a missing file
    // would terminate the step. CodeRabbit on PR #2970.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const failureBlock = extractCherryPickFailureBlock(script);

    // Readability check before invoking the marker classifier.
    assert.match(
      failureBlock,
      /\[\s*!\s*-r\s+"\$CONFLICTED"\s*\]/,
      'auto_cherry_pick must check `[ ! -r "$CONFLICTED" ]` before running the awk classifier so an unreadable unmerged path does not terminate the step under `set -e` (#2968)'
    );
    // Marker-presence check before invoking the marker classifier — a file
    // listed as unmerged but with no `<<<<<<< ` header is anomalous.
    assert.match(
      failureBlock,
      /grep -q '\^<<<<<<< '\s+"\$CONFLICTED"/,
      'auto_cherry_pick must verify `<<<<<<< ` markers exist in the file before running the awk classifier so a markerless unmerged file is not misclassified as context-missing (#2968)'
    );
    // The awk invocation must tolerate non-zero exits (e.g. via 2>/dev/null
    // and `|| echo "real"`) so a transient awk failure can't slip the file
    // into the auto-skip bucket.
    assert.match(
      failureBlock,
      /awk[\s\S]+?\|\|\s*echo\s+"real"/,
      'awk classifier must default to "real" on non-zero exit so transient awk failures do not auto-skip a real conflict (#2968)'
    );
  });

  test('git cherry-pick --skip is guarded by CHERRY_PICK_HEAD existence', () => {
    // If cherry-pick fails for a reason that doesn't enter conflict state
    // (e.g. unreadable commit, ref problem), CHERRY_PICK_HEAD doesn't exist
    // and `git cherry-pick --skip` exits non-zero — bricking the loop.
    // The skip call must be guarded. CodeRabbit on PR #2970.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const failureBlock = extractCherryPickFailureBlock(script);

    assert.match(
      failureBlock,
      /git rev-parse[^\n]*CHERRY_PICK_HEAD/,
      'auto_cherry_pick must check CHERRY_PICK_HEAD exists before calling `git cherry-pick --skip` — calling --skip outside an in-progress cherry-pick fails (#2968)'
    );
  });

  test('run summary uses distinct sections for conflict skips vs policy skips', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // The summary must surface both buckets with distinct headings so
    // operators can act on the right one. Conflict skips are the review
    // queue; policy skips are informational.
    assert.match(
      script,
      /Skipped — cherry-pick conflict \(manual review\)/,
      'run summary must show conflict skips under a "manual review" heading distinct from policy skips (#2968)'
    );
    assert.match(
      script,
      /Not auto-included \(feat\/refactor\/docs\/etc\)/,
      'run summary must show policy skips under a heading that names the excluded categories — they are not failures (#2968)'
    );
    // Both buckets must be referenced when emitting the summary so a
    // future edit can't silently drop one section.
    assert.match(
      script,
      /\$CONFLICT_SKIPPED/,
      'run summary must echo $CONFLICT_SKIPPED so the manual-review queue actually appears (#2968)'
    );
    assert.match(
      script,
      /\$POLICY_SKIPPED/,
      'run summary must echo $POLICY_SKIPPED so policy-excluded commits remain visible to operators (#2968)'
    );
  });

  test('skip reason annotates real merge conflicts distinctly from context-missing', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const failureBlock = extractCherryPickFailureBlock(script);

    // Operators must be able to find real conflicts in the run summary —
    // the "merge conflict" string is the discriminator.
    assert.match(
      failureBlock,
      /merge conflict/i,
      'auto_cherry_pick must annotate real-conflict skips with "merge conflict" so operators can find them in the run summary (#2968)'
    );
    // The empty-HEAD/context-missing classification (#2966) is preserved
    // — its diagnostic value (operator can tell the conflict was "fix
    // patched code that doesn't exist here" vs "fix patched code we
    // restructured") survives the policy change.
    assert.match(
      failureBlock,
      /context absent at base/,
      'auto_cherry_pick must still annotate context-missing skips distinctly from real merge conflicts so operators can distinguish the diagnostic (#2966 + #2968)'
    );
  });
});
