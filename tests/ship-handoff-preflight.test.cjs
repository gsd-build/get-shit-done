/**
 * Regression / contract test for enhancement #2473
 *
 * /gsd-ship preflight must refuse to open a PR when .planning/HANDOFF.json
 * declares in-progress work. A task is "terminal" (non-blocking) when its
 * status is one of {done, cancelled, deferred_to_backend, wont_fix}; any
 * other value signals work-in-progress that should block `gh pr create`.
 *
 * These assertions validate the workflow text itself — not a runtime
 * simulation — matching the style of bug-2334-quick-gsd-sdk-preflight.test.cjs.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'ship.md');
const ARTIFACTS_PATH = path.join(__dirname, '..', 'get-shit-done', 'references', 'artifact-types.md');

const TERMINAL_STATUSES = ['done', 'cancelled', 'deferred_to_backend', 'wont_fix'];

describe('enhancement #2473: /gsd-ship refuses to open PR when HANDOFF.json declares in-progress work', () => {
  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  const preflightStart = workflow.indexOf('<step name="preflight_checks">');
  const preflightEnd = workflow.indexOf('</step>', preflightStart);
  assert.ok(preflightStart !== -1 && preflightEnd !== -1, 'preflight_checks step must exist');
  const preflight = workflow.slice(preflightStart, preflightEnd);

  test('preflight checks the HANDOFF.json path', () => {
    assert.match(
      preflight,
      /\.planning\/HANDOFF\.json/,
      'preflight must reference .planning/HANDOFF.json so the check runs against the canonical pause-work artifact'
    );
  });

  test('preflight parses remaining_tasks[] and inspects status', () => {
    assert.match(
      preflight,
      /remaining_tasks/,
      'preflight must parse the remaining_tasks[] array from HANDOFF.json'
    );
    assert.match(
      preflight,
      /status/,
      'preflight must inspect per-task status to distinguish terminal from in-progress entries'
    );
  });

  test('preflight enumerates all four terminal statuses', () => {
    for (const status of TERMINAL_STATUSES) {
      assert.ok(
        preflight.includes(status),
        `preflight must list "${status}" as terminal so tasks with this status don't block shipping`
      );
    }
  });

  test('preflight refuses (exits non-zero) when a blocking task is found', () => {
    assert.match(
      preflight,
      /exit 1/,
      'preflight must exit non-zero on a blocking task so the workflow stops before push/PR creation'
    );
  });

  test('refusal message names the blocking tasks and lists resolution options', () => {
    assert.ok(
      /Cannot ship/i.test(preflight) || /blocking tasks?/i.test(preflight),
      'refusal must explicitly say shipping is blocked and list the offending tasks'
    );
    assert.match(
      preflight,
      /--force/,
      'refusal must mention the --force escape hatch so the user knows how to override'
    );
  });

  test('--force override is detected from $ARGUMENTS and bypasses the check', () => {
    assert.match(
      preflight,
      /\$ARGUMENTS/,
      '--force must be read from $ARGUMENTS, matching the existing --text convention in this workflow'
    );
    // Both the detection and the bypass branch must live inside preflight_checks
    const mentionsForceMoreThanOnce = (preflight.match(/--force|FORCE/g) || []).length >= 2;
    assert.ok(
      mentionsForceMoreThanOnce,
      'preflight must both detect --force and branch on it (set + check)'
    );
  });

  test('missing HANDOFF.json is a no-op (preserves existing behavior)', () => {
    assert.match(
      preflight,
      /if \[ -f "?\$\{?HANDOFF_PATH\}?"? \]|if \[ -f "?\.planning\/HANDOFF\.json"? \]/,
      'preflight must guard on HANDOFF.json existence — absent file means no check, preserving pre-#2473 behavior'
    );
  });

  test('malformed HANDOFF.json is a hard stop (node exit code is captured, not swallowed by $())', () => {
    // Command substitution $() discards the inner exit code, so the node parser
    // exit must be captured explicitly via $? and branched on. Without this,
    // a corrupted HANDOFF.json would yield empty BLOCKING and ship silently.
    assert.match(
      preflight,
      /HANDOFF_EXIT=\$\?/,
      'preflight must capture $? from the node invocation so a non-zero exit is visible to the shell'
    );
    assert.match(
      preflight,
      /HANDOFF_EXIT.*-ne 0/,
      'preflight must branch on the captured node exit and refuse when parsing failed'
    );
    // And the parser itself must still signal failure on bad JSON
    assert.match(
      preflight,
      /process\.exit\(2\)/,
      'node parser must exit non-zero on invalid JSON so the captured exit code is meaningful'
    );
  });

  test('pending-handoff check is placed before push_branch and create_pr (cannot fall through to gh pr create)', () => {
    const pushStart = workflow.indexOf('<step name="push_branch">');
    const createStart = workflow.indexOf('<step name="create_pr">');
    const handoffInPreflight = preflight.search(/HANDOFF\.json/);
    assert.ok(handoffInPreflight !== -1, 'HANDOFF.json check must live inside preflight_checks');
    assert.ok(
      preflightEnd < pushStart && pushStart < createStart,
      'preflight_checks must run before push_branch and create_pr so a refusal prevents any public action'
    );
  });

  test('artifact-types.md documents the terminal-statuses contract', () => {
    const artifacts = fs.readFileSync(ARTIFACTS_PATH, 'utf-8');
    const handoffSection = artifacts.slice(
      artifacts.indexOf('### HANDOFF.json'),
      artifacts.indexOf('---', artifacts.indexOf('### HANDOFF.json'))
    );
    assert.ok(handoffSection.length > 0, 'HANDOFF.json section must exist in artifact-types.md');
    for (const status of TERMINAL_STATUSES) {
      assert.ok(
        handoffSection.includes(status),
        `artifact-types.md HANDOFF.json entry must enumerate terminal status "${status}"`
      );
    }
    assert.match(
      handoffSection,
      /ship/i,
      'artifact-types.md HANDOFF.json entry must name /gsd-ship as a consumer'
    );
  });
});
