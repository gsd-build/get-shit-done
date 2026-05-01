/**
 * Regression test for bug #2980
 *
 * The default GITHUB_TOKEN issued to a workflow run lacks the `workflow`
 * scope. Pushing a branch that contains a commit modifying any file under
 * `.github/workflows/` is rejected with:
 *
 *   ! [remote rejected] hotfix/X.YY.Z -> hotfix/X.YY.Z
 *     (refusing to allow a GitHub App to create or update workflow
 *      `.github/workflows/release-sdk.yml` without `workflows` permission)
 *
 * Pre-#2980 behavior: the cherry-pick loop happily picked workflow-file
 * commits, then the push step at the end of `Prepare hotfix branch`
 * rejected them. The hotfix run aborted with no clear signal that a
 * specific commit was the cause. v1.39.1 hit this on PR #2977 (run
 * 25232010071): #2977 cherry-picked cleanly because earlier workflow-
 * file fixes had been skipped on conflict, then the push exploded.
 *
 * #2980 policy: pre-pick check for any commit whose diff touches
 * `.github/workflows/*`. Skip such commits up-front, log them in their
 * own WORKFLOW_SKIPPED bucket, AND emit a `::warning::` annotation so
 * the operator sees a yellow flag in the GitHub UI rather than silently
 * shipping a hotfix that dropped a workflow-file fix.
 *
 * This test asserts:
 *   1. The pre-pick guard exists in the auto_cherry_pick loop, runs
 *      BEFORE the cherry-pick attempt, and uses `git diff-tree` to
 *      detect workflow-file changes.
 *   2. The skip path emits a `::warning::` annotation (loud signal
 *      requirement — silent drops were rejected as a failure mode).
 *   3. Skipped commits land in WORKFLOW_SKIPPED, not CONFLICT_SKIPPED
 *      or POLICY_SKIPPED — operators reviewing the run summary need
 *      these distinct.
 *   4. The run summary surfaces WORKFLOW_SKIPPED in its own section,
 *      separate from the conflict-review queue.
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

describe('bug-2980: release-sdk hotfix skips cherry-picks that touch .github/workflows/*', () => {
  test('pre-pick guard inspects commit file paths via `git diff-tree` before attempting the pick', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    // Must use `git diff-tree` (or equivalent file-list inspection) on
    // the candidate SHA — `git show --stat` etc. would also work but
    // diff-tree is the cheapest and matches what the implementation
    // chose. The test asserts the chosen primitive is present so a
    // future refactor doesn't accidentally drop the guard while keeping
    // the surrounding scaffolding.
    assert.match(
      prePick,
      /git diff-tree[^\n]*"\$SHA"/,
      'pre-pick region must inspect the candidate SHA\'s file list with `git diff-tree` to detect workflow-file commits before attempting the cherry-pick (#2980)'
    );
    assert.match(
      prePick,
      /\^\\\.github\/workflows\//,
      'pre-pick region must match paths under `.github/workflows/` (anchored regex) when classifying commits (#2980)'
    );
  });

  test('workflow-file skip emits a ::warning:: annotation (loud signal)', () => {
    // Silent drops were explicitly rejected as a failure mode during the
    // option-1/2/3 tradeoff discussion. The skip MUST surface as a
    // yellow ::warning:: in the GitHub Actions UI so the operator sees
    // it without scrolling through the run log.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    assert.match(
      prePick,
      /::warning::[^\n]*\.github\/workflows/,
      'workflow-file skip must emit a `::warning::` annotation mentioning .github/workflows so the GitHub Actions UI surfaces a yellow flag — silent drops are a rejected failure mode (#2980)'
    );
  });

  test('workflow-file skips land in their own bucket, not CONFLICT_SKIPPED or POLICY_SKIPPED', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');
    const prePick = extractPrePickRegion(script);

    // Dedicated bucket: operators reviewing the run summary need to
    // distinguish "this fix needs to land via a different path" (workflow)
    // from "this fix had a real merge conflict" (conflict). Mixing them
    // buries the workflow case in the manual-review queue.
    assert.match(
      prePick,
      /^\s*WORKFLOW_SKIPPED="\$\{WORKFLOW_SKIPPED\}/m,
      'workflow-file skip must append to its own WORKFLOW_SKIPPED bucket — distinct from CONFLICT_SKIPPED (real conflicts) and POLICY_SKIPPED (feat/refactor exclusions) (#2980)'
    );
    assert.doesNotMatch(
      prePick,
      /^\s*CONFLICT_SKIPPED="\$\{CONFLICT_SKIPPED\}[^\n]*\$SHA[^\n]*workflow/im,
      'workflow-file skip must NOT reuse CONFLICT_SKIPPED — those are commits that need manual conflict resolution, which is the wrong remediation for the workflow-file case (#2980)'
    );
  });

  test('WORKFLOW_SKIPPED is initialized at the top of the cherry-pick loop alongside the other buckets', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    // Bash treats unset variables as empty under `set -u`, but the
    // existing buckets are explicitly initialized. Match that pattern so
    // a `set -u` enablement in the future doesn't silently break this
    // bucket.
    assert.match(
      script,
      /^\s*WORKFLOW_SKIPPED=""\s*$/m,
      'WORKFLOW_SKIPPED must be initialized to empty alongside POLICY_SKIPPED and CONFLICT_SKIPPED (#2980)'
    );
  });

  test('run summary surfaces WORKFLOW_SKIPPED in its own section, distinct from the conflict-review queue', () => {
    // The summary block writes to $GITHUB_STEP_SUMMARY. Operators see
    // this rendered as Markdown on the run page. The workflow-file skip
    // section must be present and must NOT collapse into the
    // "cherry-pick conflict (manual review)" heading.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const script = extractStepRun(yaml, 'Prepare hotfix branch');

    assert.match(
      script,
      /if \[ -n "\$WORKFLOW_SKIPPED" \]/,
      'run summary must conditionally render the WORKFLOW_SKIPPED bucket so empty hotfixes don\'t print an empty section (#2980)'
    );
    assert.match(
      script,
      /\.github\/workflows\/\*/,
      'run summary section header for WORKFLOW_SKIPPED must mention `.github/workflows/*` so operators understand the skip reason without clicking through to the log (#2980)'
    );
  });
});
