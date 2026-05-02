'use strict';

// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

/**
 * Regression test for #2470.
 *
 * update.md is installed into every runtime directory including .gemini, .codex,
 * .opencode, etc. The installer's scanForLeakedPaths() uses the regex
 * /(?:~|\$HOME)\/\.claude\b/g to detect unresolved .claude path references after
 * copyWithPathReplacement() runs. The replacer handles "~/.claude/" (trailing slash)
 * but not "~/.claude" (bare, no trailing slash) — so any bare reference in
 * update.md would slip through and trigger the installer warning for non-Claude runtimes.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const UPDATE_MD = path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md');

describe('update.md — no bare ~.claude path references (#2470)', () => {
  const content = fs.readFileSync(UPDATE_MD, 'utf-8');

  test('update.md does not contain bare ~/\\.claude (without trailing slash)', () => {
    // This is the exact pattern from the installer's scanForLeakedPaths():
    // /(?:~|\$HOME)\/\.claude\b/g
    // The replacer handles ~/\.claude\/ (with trailing slash) but misses bare ~/\.claude
    // so we must not have bare references in the source file.
    const matches = content.match(/(?:~|\$HOME)\/\.claude(?!\/)/g);
    assert.strictEqual(
      matches,
      null,
      `update.md must not contain bare ~/\.claude (without trailing slash) — installer scanner flags these as unresolved path refs: ${JSON.stringify(matches)}`
    );
  });
});
