'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const { evaluateLint, LINT_REASON } = require(path.join(__dirname, '..', 'scripts', 'changeset', 'lint.cjs'));

// evaluateLint is a pure function over file lists + label list — no fs, no git.
// Tests assert on the structured verdict: { ok: bool, reason: LINT_REASON.X }.

describe('changeset lint: pure verdict (#2975)', () => {
  test('LINT_REASON enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(LINT_REASON).sort(),
      ['OK_FRAGMENT_PRESENT', 'OK_NO_USER_FACING_CHANGES', 'OK_OPT_OUT_LABEL', 'FAIL_MISSING_FRAGMENT'].sort(),
    );
  });

  test('OK_FRAGMENT_PRESENT when the diff includes a new .changeset/*.md', () => {
    const verdict = evaluateLint({
      changedFiles: ['bin/install.js', '.changeset/silly-bears-dance.md'],
      labels: [],
    });
    assert.deepEqual(verdict, { ok: true, reason: LINT_REASON.OK_FRAGMENT_PRESENT });
  });

  test('FAIL_MISSING_FRAGMENT when user-facing files change without a fragment', () => {
    const verdict = evaluateLint({
      changedFiles: ['bin/install.js', 'tests/foo.test.cjs'],
      labels: [],
    });
    assert.deepEqual(verdict, { ok: false, reason: LINT_REASON.FAIL_MISSING_FRAGMENT });
  });

  test('OK_OPT_OUT_LABEL when no-changelog label present, even with user-facing changes', () => {
    const verdict = evaluateLint({
      changedFiles: ['bin/install.js'],
      labels: ['no-changelog'],
    });
    assert.deepEqual(verdict, { ok: true, reason: LINT_REASON.OK_OPT_OUT_LABEL });
  });

  test('OK_NO_USER_FACING_CHANGES when only test/ci/doc files change', () => {
    const verdict = evaluateLint({
      changedFiles: ['tests/foo.test.cjs', '.github/workflows/x.yml', 'docs/x.md'],
      labels: [],
    });
    assert.deepEqual(verdict, { ok: true, reason: LINT_REASON.OK_NO_USER_FACING_CHANGES });
  });

  test('FAIL_MISSING_FRAGMENT when CHANGELOG.md is edited directly (closes the workflow bypass)', () => {
    const verdict = evaluateLint({
      changedFiles: ['CHANGELOG.md'],
      labels: [],
    });
    assert.deepEqual(verdict, { ok: false, reason: LINT_REASON.FAIL_MISSING_FRAGMENT });
  });

  test('a fragment alone (no source change) is OK_FRAGMENT_PRESENT — fragment-only PR is allowed', () => {
    const verdict = evaluateLint({
      changedFiles: ['.changeset/silly-bears-dance.md'],
      labels: [],
    });
    assert.deepEqual(verdict, { ok: true, reason: LINT_REASON.OK_FRAGMENT_PRESENT });
  });
});
