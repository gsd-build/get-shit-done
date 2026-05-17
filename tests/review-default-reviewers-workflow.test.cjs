'use strict';

// allow-test-rule: source-text-is-the-product
// Workflow markdown is runtime contract; these assertions verify deployed behavior text.

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('review workflow default reviewer selection contract (#3079)', () => {
  const workflow = fs.readFileSync(
    path.join(process.cwd(), 'get-shit-done', 'workflows', 'review.md'),
    'utf8'
  );

  test('documents review.default_reviewers no-flag behavior', () => {
    assert.ok(
      workflow.includes('review.default_reviewers'),
      'review workflow must reference review.default_reviewers for no-flag selection'
    );
  });

  test('documents precedence order with explicit flags and --all overrides', () => {
    assert.ok(
      workflow.includes('Individual reviewer flags') &&
      workflow.includes('--all') &&
      workflow.includes('review.default_reviewers'),
      'review workflow must document precedence: flags > --all > review.default_reviewers'
    );
  });

  test('documents unknown/undetected configured slug handling', () => {
    assert.ok(
      workflow.includes('Unknown slugs warn') &&
      workflow.includes('Known-but-undetected slugs'),
      'review workflow must document unknown and undetected slug handling'
    );
  });

  test('documents failure behavior when all configured reviewers unavailable', () => {
    assert.ok(
      workflow.includes('all configured reviewers are unavailable') &&
      workflow.includes('fail'),
      'review workflow must document failure path when configured reviewers are unavailable'
    );
  });
});
