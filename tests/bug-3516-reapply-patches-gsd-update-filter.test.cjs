// allow-test-rule: source-text-is-the-product
// get-shit-done/workflows/reapply-patches.md is the installed runtime workflow —
// its text IS the deployed behavioral contract for the --reapply flag.

'use strict';

/**
 * Bug #3516: reapply-patches.md git-enhanced two-way merge filter misses
 * commits authored by the renamed `/gsd-update` flow.
 *
 * The `grep -v` alternation on line 231 only included the legacy `gsd:update`
 * marker. After the slash-command rename `/gsd:update` → `/gsd-update`, commits
 * authored by the current flow fall through the filter and are misclassified as
 * user customizations, prompting spurious merge conflicts during `--reapply`.
 *
 * Fix: add `gsd-update` arm to the alternation so both the legacy and current
 * commit-message prefixes are excluded. `GSD update` and `gsd-install`
 * exclusions are preserved.
 *
 * Per the repo's source-text-is-the-product exception: the workflow file's text
 * IS the deployed behavioral contract. Structural assertion against the parsed
 * shell command string is the correct test form here.
 */

const { describe, test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(
  __dirname,
  '..',
  'get-shit-done',
  'workflows',
  'reapply-patches.md',
);

/**
 * Extract the git log filter command from the workflow.
 *
 * Looks for the `grep -v "..."` shell snippet inside the Git-enhanced two-way
 * merge section and returns the alternation string between the quotes.
 * Returns null if the snippet is absent (signals a structural regression).
 */
function extractFilterAlternation(content) {
  // Match the grep -v "..." line in the bash block
  const match = content.match(/grep\s+-v\s+"([^"]+)"/);
  if (!match) return null;
  return match[1];
}

/**
 * Parse the alternation string (pipe-delimited) into individual arms.
 * Handles escaped pipes produced by shell regex syntax (`\|`).
 */
function parseAlternationArms(alternation) {
  // Shell grep alternation uses \| (escaped pipe); split on that
  return alternation.split(/\\\|/).map((arm) => arm.trim());
}

describe('Bug #3516: git-enhanced two-way merge filter includes gsd-update arm', () => {
  let content;
  let alternation;
  let arms;

  before(() => {
    content = fs.readFileSync(WORKFLOW_PATH, 'utf8');
    alternation = extractFilterAlternation(content);
    arms = alternation ? parseAlternationArms(alternation) : [];
  });

  test('workflow file exists', () => {
    assert.ok(
      fs.existsSync(WORKFLOW_PATH),
      'get-shit-done/workflows/reapply-patches.md must exist',
    );
  });

  test('git-enhanced two-way merge section contains a grep -v filter', () => {
    assert.ok(
      alternation !== null,
      'reapply-patches.md must contain a `grep -v "..."` filter in the git-enhanced two-way merge section',
    );
  });

  test('filter excludes legacy gsd:update commits (back-compat)', () => {
    assert.ok(
      arms.some((arm) => arm === 'gsd:update'),
      `filter must include 'gsd:update' arm for back-compat; got arms: ${JSON.stringify(arms)}`,
    );
  });

  test('filter excludes renamed gsd-update commits (primary fix)', () => {
    assert.ok(
      arms.some((arm) => arm === 'gsd-update'),
      `filter must include 'gsd-update' arm (renamed flow); got arms: ${JSON.stringify(arms)}`,
    );
  });

  test('filter excludes GSD update commits (no regression)', () => {
    assert.ok(
      arms.some((arm) => arm === 'GSD update'),
      `filter must include 'GSD update' arm; got arms: ${JSON.stringify(arms)}`,
    );
  });

  test('filter excludes gsd-install commits (no regression)', () => {
    assert.ok(
      arms.some((arm) => arm === 'gsd-install'),
      `filter must include 'gsd-install' arm; got arms: ${JSON.stringify(arms)}`,
    );
  });

  test('all four expected exclusion patterns are present in the filter', () => {
    const required = ['gsd:update', 'gsd-update', 'GSD update', 'gsd-install'];
    const missing = required.filter((p) => !arms.some((arm) => arm === p));
    assert.deepEqual(
      missing,
      [],
      `filter is missing required exclusion patterns: ${JSON.stringify(missing)}; got arms: ${JSON.stringify(arms)}`,
    );
  });
});
