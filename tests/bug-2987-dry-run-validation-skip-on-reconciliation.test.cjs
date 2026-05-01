/**
 * Regression test for bug #2987
 *
 * The release-sdk workflow's `Dry-run publish validation` step ran
 * `npm publish --dry-run --tag "$TAG"` unconditionally. `npm publish
 * --dry-run` contacts the registry and exits 1 when the version is
 * already published:
 *
 *   npm error You cannot publish over the previously published
 *   versions: 1.39.1.
 *
 * The earlier `Detect prior publish (reconciliation mode)` step
 * already detects this case and sets
 * `steps.prior_publish.outputs.skip_publish=true` — and the real
 * publish step at line ~648 is gated on that. The dry-run validation
 * was missing the same gate, so re-runs of an already-published
 * hotfix (the operator's typical recovery path when a later step
 * like merge-back fails) blew up at the rehearsal before reaching
 * any of the reconciliation logic.
 *
 * Trigger run: 25233855236 — re-attempted v1.39.1 hotfix after the
 * prior run had landed v1.39.1 on npm.
 *
 * Fix: gate the dry-run validation step on
 * `steps.prior_publish.outputs.skip_publish != 'true'`, matching the
 * publish step.
 */

'use strict';

// allow-test-rule: source-text-is-the-product
// release-sdk.yml IS the product for hotfix automation; the assertions
// extract the workflow text and check the step-level `if:` guard via
// indentation-aware YAML parsing rather than raw-text grep.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', '.github', 'workflows', 'release-sdk.yml');

/**
 * Find a step by name and return the lines belonging to it (from the
 * `- name:` line up to but not including the next `- name:` at the
 * same indent or the next dedent-back-to-job).
 */
function extractStepBlock(workflowText, stepName) {
  const lines = workflowText.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)- name:\s*(.+?)\s*$/);
    if (!m || m[2] !== stepName) continue;
    const stepIndent = m[1].length;
    const start = i;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const peek = lines[j];
      if (peek.length === 0) continue;
      const lead = peek.match(/^(\s*)/)[1].length;
      // Next sibling step or dedent past step indent terminates this block.
      if (lead <= stepIndent && peek.trim().length > 0) {
        if (/^\s*- /.test(peek) || lead < stepIndent) {
          end = j;
          break;
        }
      }
    }
    return lines.slice(start, end).join('\n');
  }
  throw new Error(`step "${stepName}" not found in workflow`);
}

describe('bug-2987: dry-run publish validation skips when reconciliation mode is active', () => {
  test('Dry-run publish validation step has an `if:` guard tied to skip_publish', () => {
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const block = extractStepBlock(yaml, 'Dry-run publish validation');

    // The guard must reference steps.prior_publish.outputs.skip_publish
    // — the exact output set by the `Detect prior publish` step.
    // Loosely accepting any boolean expression here would risk a future
    // edit that gates on the wrong signal (e.g., inputs.dry_run, which
    // is the user-facing dry-run flag, not registry reconciliation).
    assert.match(
      block,
      /^\s*if:\s*\$\{\{\s*steps\.prior_publish\.outputs\.skip_publish\s*!=\s*'true'\s*\}\}\s*$/m,
      "Dry-run publish validation must be gated on `steps.prior_publish.outputs.skip_publish != 'true'` so reconciliation re-runs (version already on npm) don't fail at the rehearsal (#2987)"
    );
  });

  test('the gate matches the actual publish step\'s gate (consistency with downstream skip)', () => {
    // The publish step ("Publish to npm (CC bundle, ...)" further
    // down) ALSO honors skip_publish. The rehearsal must honor it too;
    // otherwise reconciliation runs always fail at the rehearsal.
    // This test reads both gates and asserts the skip_publish
    // sub-expression is identical between them. It allows the publish
    // step to ALSO check inputs.dry_run (which it does, and which the
    // rehearsal correctly does NOT — the rehearsal is the dry-run).
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const dryRunBlock = extractStepBlock(yaml, 'Dry-run publish validation');
    const publishBlock = extractStepBlock(yaml, 'Publish to npm (CC bundle, SDK included as both loose tree and .tgz)');

    const skipPattern = /steps\.prior_publish\.outputs\.skip_publish\s*!=\s*'true'/;
    assert.match(
      dryRunBlock,
      skipPattern,
      'Dry-run validation must check skip_publish (#2987)'
    );
    assert.match(
      publishBlock,
      skipPattern,
      'Publish step must check skip_publish (sentinel — if this fails the workflow has changed and the test\'s premise needs review)'
    );
  });

  test('the workflow still runs the rehearsal in normal flows (gate is skip-only, not always-skip)', () => {
    // Defense against the wrong fix: someone could pass-through-fix
    // this by gating on `false` (always skip) which would silently
    // disable the rehearsal even on first publishes. The gate must
    // be specifically tied to the skip_publish signal, not a generic
    // `false` or `inputs.action == 'something'` discriminator.
    const yaml = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    const block = extractStepBlock(yaml, 'Dry-run publish validation');

    // The gate string itself must contain a comparison against 'true' —
    // i.e., it's an opt-out for the prior-publish case, not an
    // unconditional skip.
    const ifLine = block.split('\n').find((l) => /^\s*if:/.test(l));
    assert.ok(ifLine, 'Dry-run validation must have an `if:` line (#2987)');
    assert.match(
      ifLine,
      /skip_publish\s*!=\s*'true'/,
      'gate must be `skip_publish != true` (run when not skipping), not an unconditional skip — the rehearsal still has value on first publishes (#2987)'
    );
    assert.doesNotMatch(
      ifLine,
      /:\s*false\s*\}\}/,
      'gate must not be `if: false` — the rehearsal is meaningful when the version isn\'t yet on npm (#2987)'
    );
  });
});
