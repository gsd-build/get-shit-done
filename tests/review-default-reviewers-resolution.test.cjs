'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveReviewerSelection,
} = require('../get-shit-done/bin/lib/review-reviewer-selection.cjs');

describe('review default reviewers resolution (#3079)', () => {
  test('no flags + config defaults selects configured subset', () => {
    const result = resolveReviewerSelection({
      detected: ['gemini', 'codex', 'claude'],
      explicitFlags: [],
      allFlag: false,
      configuredDefaultReviewers: ['gemini', 'codex'],
    });

    assert.strictEqual(result.source, 'config_default');
    assert.deepStrictEqual(result.selected, ['codex', 'gemini']);
    assert.deepStrictEqual(result.errors, []);
  });

  test('--all ignores configured defaults', () => {
    const result = resolveReviewerSelection({
      detected: ['gemini', 'codex', 'claude'],
      explicitFlags: [],
      allFlag: true,
      configuredDefaultReviewers: ['gemini'],
    });

    assert.strictEqual(result.source, 'all_flag');
    assert.deepStrictEqual(result.selected, ['claude', 'codex', 'gemini']);
  });

  test('explicit flags win over config defaults', () => {
    const result = resolveReviewerSelection({
      detected: ['gemini', 'codex', 'claude', 'cursor'],
      explicitFlags: ['cursor'],
      allFlag: false,
      configuredDefaultReviewers: ['gemini', 'codex'],
    });

    assert.strictEqual(result.source, 'explicit_flags');
    assert.deepStrictEqual(result.selected, ['cursor']);
  });

  test('unknown configured slugs warn and all-undetected known slugs error', () => {
    const result = resolveReviewerSelection({
      detected: ['gemini'],
      explicitFlags: [],
      allFlag: false,
      configuredDefaultReviewers: ['unknown_slug', 'codex'],
    });

    assert.strictEqual(result.source, 'config_default');
    assert.ok(
      result.warnings.some((msg) => msg.includes('unknown reviewer slug') && msg.includes('unknown_slug')),
      `expected warning for unknown slug, got: ${JSON.stringify(result.warnings)}`
    );
    assert.ok(
      result.errors.some((msg) => msg.includes('all configured default reviewers are unavailable')),
      `expected unavailable error, got: ${JSON.stringify(result.errors)}`
    );
  });
});

