'use strict';

/**
 * Regression test for #2470.
 *
 * update.md is installed into every runtime directory including .gemini, .codex,
 * .opencode, etc. We assert against the installer's exported detector so this
 * test remains aligned with real leak-scan behavior (Markdown code blocks +
 * comment filtering + `(?:~|$HOME)/.claude` matching).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

process.env.GSD_TEST_MODE = '1';

const { detectClaudePathRefs } = require('../bin/install.js');

const UPDATE_MD = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md');

describe('update.md — no leaked .claude refs under installer scan (#2470)', () => {
  const content = fs.readFileSync(UPDATE_MD, 'utf-8');

  test('update.md has no .claude refs detected by installer markdown scan', () => {
    const matches = detectClaudePathRefs(content, /* isMarkdown */ true);
    assert.deepStrictEqual(
      matches,
      [],
      `update.md contains leaked .claude references under installer scan: ${JSON.stringify(matches)}`
    );
  });
});
