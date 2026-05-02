// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression test for #2196
 *
 * autonomous.md exceeded the Claude Code Read tool's 10K token limit
 * (reported as 11,748 tokens), causing it to be read in 150-line chunks.
 *
 * Fix: extract the smart_discuss step into a separate reference file so
 * autonomous.md stays under the token limit.
 *
 * At ~4 chars/token, 10K tokens ≈ 40K chars. We target < 38K to stay
 * comfortably under the limit with room for future additions.
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

// ─── Size threshold ──────────────────────────────────────────────────────────

// 38K chars ≈ 9,500 tokens — stays below 10K with margin
const AUTONOMOUS_SIZE_LIMIT = 38 * 1024;

// ─── File paths ──────────────────────────────────────────────────────────────

const AUTONOMOUS_PATH = path.join(PROJECT_ROOT, 'get-shit-done', 'workflows', 'autonomous.md');
const SMART_DISCUSS_REF = path.join(PROJECT_ROOT, 'get-shit-done', 'references', 'autonomous-smart-discuss.md');

// ─── autonomous.md size ──────────────────────────────────────────────────────

describe('autonomous.md size constraints (#2196)', () => {
  test('autonomous.md file exists', () => {
    assert.ok(fs.existsSync(AUTONOMOUS_PATH), `Missing: ${AUTONOMOUS_PATH}`);
  });

  test('autonomous.md is under 38K chars (below Claude Code 10K-token Read limit)', () => {
    const raw = fs.readFileSync(AUTONOMOUS_PATH, 'utf-8');
    const content = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    assert.ok(
      content.length < AUTONOMOUS_SIZE_LIMIT,
      `autonomous.md is ${content.length} chars, expected < ${AUTONOMOUS_SIZE_LIMIT} to stay under ` +
      `the 10K token Read limit. Extract smart_discuss step to autonomous-smart-discuss.md reference.`
    );
  });
});

// ─── Reference file exists ───────────────────────────────────────────────────

describe('autonomous-smart-discuss.md reference file', () => {
  test('autonomous-smart-discuss.md exists', () => {
    assert.ok(
      fs.existsSync(SMART_DISCUSS_REF),
      `Missing: ${SMART_DISCUSS_REF} — smart_discuss step must be extracted to this file`
    );
  });

  test('autonomous.md references autonomous-smart-discuss.md', () => {
    const content = fs.readFileSync(AUTONOMOUS_PATH, 'utf-8');
    assert.ok(
      content.includes('autonomous-smart-discuss.md'),
      'autonomous.md must reference autonomous-smart-discuss.md after extraction'
    );
  });
});

// ─── Reference file contains key content ────────────────────────────────────

describe('autonomous-smart-discuss.md contains key smart_discuss content', () => {
  test('reference file contains smart_discuss step instructions', () => {
    const content = fs.readFileSync(SMART_DISCUSS_REF, 'utf-8');
    const hasSmartDiscuss =
      content.includes('smart_discuss') ||
      content.includes('Smart Discuss') ||
      content.includes('grey area') ||
      content.includes('grey_area');
    assert.ok(hasSmartDiscuss, 'autonomous-smart-discuss.md must contain smart discuss step content');
  });

  test('reference file contains CONTEXT.md writing instructions', () => {
    const content = fs.readFileSync(SMART_DISCUSS_REF, 'utf-8');
    assert.ok(
      content.includes('CONTEXT.md'),
      'autonomous-smart-discuss.md must contain instructions for writing CONTEXT.md'
    );
  });
});
