// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression guard for #2012: AskUserQuestion is Claude Code-only — non-Claude
 * runtimes (OpenAI Codex, Gemini, etc.) render it as a markdown code block
 * instead of triggering the interactive TUI, so the session stalls.
 *
 * Every workflow that calls AskUserQuestion MUST include a TEXT_MODE fallback
 * instruction so that, when `workflow.text_mode` is true (or `--text` is
 * passed), all AskUserQuestion calls are replaced with plain-text numbered
 * lists that any runtime can handle.
 *
 * The canonical fallback phrase is:
 *   "TEXT_MODE" (or "text_mode") paired with "plain-text" (or "plain text")
 * near the first AskUserQuestion reference in the file.
 */
'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORKFLOWS_DIR = path.join(ROOT, 'get-shit-done', 'workflows');

/**
 * Return true if the file content contains a TEXT_MODE / text_mode fallback
 * instruction for AskUserQuestion calls.
 *
 * Acceptable forms (case-insensitive on key terms):
 *   - "TEXT_MODE" + "plain-text" or "plain text"
 *   - "text_mode" + "plain-text" or "plain text"
 *   - "text mode" + "plain-text" or "plain text"
 */
function hasTextModeFallback(content) {
  const lower = content.toLowerCase();
  const hasTextMode =
    lower.includes('text_mode') ||
    lower.includes('text mode');
  const hasPlainText =
    lower.includes('plain-text') ||
    lower.includes('plain text') ||
    lower.includes('numbered list');
  return hasTextMode && hasPlainText;
}

describe('AskUserQuestion text-mode fallback (#2012)', () => {
  test('every workflow that uses AskUserQuestion includes a TEXT_MODE plain-text fallback', () => {
    const violations = [];

    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.md'));

    for (const fname of files) {
      const fpath = path.join(WORKFLOWS_DIR, fname);
      const content = fs.readFileSync(fpath, 'utf-8');

      if (!content.includes('AskUserQuestion')) continue;

      if (!hasTextModeFallback(content)) {
        violations.push(fname);
      }
    }

    assert.strictEqual(
      violations.length,
      0,
      [
        'AskUserQuestion is Claude Code-only (issue #2012).',
        'Every workflow that uses AskUserQuestion must include a TEXT_MODE fallback',
        'so non-Claude runtimes (OpenAI Codex, Gemini, etc.) can present questions',
        'as plain-text numbered lists instead of stalling on an unexecuted tool call.',
        '',
        'Add this near the argument-parsing section of each workflow:',
        '  Set TEXT_MODE=true if --text is present in $ARGUMENTS OR text_mode from',
        '  init JSON is true. When TEXT_MODE is active, replace every AskUserQuestion',
        '  call with a plain-text numbered list and ask the user to type their choice',
        '  number.',
        '',
        'Workflows missing the fallback:',
        ...violations.map(v => '  get-shit-done/workflows/' + v),
      ].join('\n')
    );
  });
});
