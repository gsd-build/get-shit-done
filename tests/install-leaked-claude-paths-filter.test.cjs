'use strict';

/**
 * Regression test for leaked .claude path detection with comment filtering.
 *
 * Verifies that detectClaudePathRefs() for Markdown files only scans code blocks,
 * while for other files scans all content.
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

/**
 * Test goal:
 * - Lock leak-detection behavior for `detectClaudePathRefs`.
 * - Ensure scan scope is correct:
 *   - Markdown scans code blocks only.
 *   - Non-Markdown scans full content.
 * - Ensure comment filtering is correct:
 *   - Ignore hash, slash-slash, and block-comment content.
 *   - Keep real path refs outside comments.
 */
describe('detectClaudePathRefs', () => {
  let detect;

  // Load installer once and capture the function under test.
  before(() => {
    process.env.GSD_TEST_MODE = '1';
    const installer = require(INSTALL_PATH);
    detect = installer.detectClaudePathRefs;
    assert.strictEqual(typeof detect, 'function');
  });

  // Helper: assert exact ordered matches.
  const expectMatches = (content, isMarkdown, expected) => {
    assert.deepStrictEqual(detect(content, isMarkdown), expected);
  };

  // Helper: assert no leaked path references are detected.
  const expectNoMatches = (content, isMarkdown) => {
    expectMatches(content, isMarkdown, []);
  };

  /**
   * Section: Non-Markdown Input
   * Target behavior:
   * - Full-content scanning is enabled.
   * - Comment text does not produce false positives.
   */
  describe('non-Markdown files (isMarkdown=false)', () => {
    /**
     * Section: Scan Scope
     * Target behavior:
     * - Plain text/config files are scanned end-to-end.
     */
    describe('scan scope', () => {
      // Positive baseline: both supported path forms are detectable.
      test('detects ~/.claude and $HOME/.claude in content', () => {
        expectMatches('export PATH="~/.claude/skills:$PATH"', false, ['~/.claude']);
        expectMatches('config="$HOME/.claude/config"', false, ['$HOME/.claude']);
      });

      // Negative baseline: unrelated content and empty input should produce no hits.
      test('returns empty array for non-matching or empty content', () => {
        expectNoMatches('export PATH="$HOME/.local/bin:$PATH"', false);
        expectNoMatches('', false);
      });
    });

    /**
     * Section: Comment Filtering
     * Target behavior:
     * - Comment-only content is ignored.
     * - Inline comments do not erase adjacent valid refs.
     */
    describe('comment filtering', () => {
      // Ignore shell/js single-line comments even if they mention .claude paths.
      test('ignores # and // comment lines', () => {
        expectNoMatches('# e.g. ~/.claude, ~/.config/opencode', false);
        expectNoMatches('// e.g. ~/.claude, ~/.config/opencode', false);
        expectNoMatches('  # example: ~/.claude\n  // example: $HOME/.claude', false);
      });

      // Ignore inline single-line comments and keep code before markers.
      test('ignores inline # and // comment text', () => {
        expectNoMatches('const x = 1; // ~/.claude', false);
        expectNoMatches('export FLAG=1 # $HOME/.claude', false);
        expectMatches('export PATH="~/.claude/skills:$PATH" // note: $HOME/.claude', false, ['~/.claude']);
      });

      // Ignore C-style block comments in one-line and multi-line forms.
      test('ignores /* */ block comments (single-line and multi-line)', () => {
        expectNoMatches('/* example: ~/.claude */', false);
        expectNoMatches('/*\n * docs: $HOME/.claude/config\n * docs: ~/.claude/skills\n */', false);
      });

      // Ensure filtering is selective: valid code on the same line is preserved.
      test('keeps valid matches when inline block comments are present', () => {
        expectMatches('const cfg = "$HOME/.claude/config"; /* docs mention ~/.claude */', false, ['$HOME/.claude']);
        expectMatches('export PATH="~/.claude/skills:$PATH" /* trailing note */', false, ['~/.claude']);
      });
    });
  });

  /**
   * Section: Markdown Input
   * Target behavior:
   * - Only executable-looking regions (code blocks) are scanned.
   * - Prose/documentation text is ignored.
   */
  describe('Markdown files (isMarkdown=true)', () => {
    /**
     * Section: Scan Scope
     * Target behavior:
     * - Fenced and indented code blocks are scanned.
     * - Non-code markdown text is not scanned.
     */
    describe('scan scope', () => {
      // Prose mentions are documentation text and must not be treated as leaks.
      test('ignores content outside code blocks', () => {
        const content = 'Some docs mentioning ~/.claude here\n\n## Section about $HOME/.claude';
        expectNoMatches(content, true);
      });

      // Fenced blocks are executable examples and should be scanned.
      test('detects paths in fenced code blocks only', () => {
        const content = `Some docs.

\`\`\`bash
export PATH="~/.claude/skills:$PATH"
\`\`\`

More docs.

\`\`\`yaml
config: $HOME/.claude/config
\`\`\``;
        expectMatches(content, true, ['~/.claude', '$HOME/.claude']);
      });

      // Indented code blocks should behave the same as fenced code blocks.
      test('detects paths in indented code blocks', () => {
        const content = `List:

    export PATH="~/.claude/skills:$PATH"
    # comment: $HOME/.claude

Outside docs mention $HOME/.claude`;
        expectMatches(content, true, ['~/.claude']);
      });

      // Empty markdown or markdown without code blocks should return no matches.
      test('returns empty array for markdown without code blocks or empty content', () => {
        expectNoMatches('Just plain text with ~/.claude', true);
        expectNoMatches('', true);
      });
    });

    /**
     * Section: Comment Filtering In Code Blocks
     * Target behavior:
     * - Hash and C-style comments inside code blocks are ignored.
     * - Non-comment refs in the same block are still detected.
     */
    describe('comment filtering inside code blocks', () => {
      // Ignore hash comment lines in fenced shell snippets.
      test('ignores # comment lines', () => {
        const content = `\`\`\`bash
# Example: ~/.claude
export PATH="~/.claude/skills:$PATH"
\`\`\``;
        expectMatches(content, true, ['~/.claude']);
      });

      // Ignore inline single-line comment tails in code blocks.
      test('ignores inline # and // comment text', () => {
        const content = `\`\`\`bash
const x = 1; // ~/.claude
export FLAG=1 # $HOME/.claude
\`\`\``;
        expectNoMatches(content, true);
      });

      // Ignore multi-line C-style comments while preserving valid code below.
      test('ignores /* */ block comments', () => {
        const content = `\`\`\`js
/*
 * Example: ~/.claude
 */
const cfg = "$HOME/.claude/config";
\`\`\``;
        expectMatches(content, true, ['$HOME/.claude']);
      });

      // Keep valid refs when inline block comments share the same line.
      test('keeps valid matches when inline block comments are present', () => {
        const content = `\`\`\`js
const cfg = "$HOME/.claude/config"; /* example: ~/.claude */
\`\`\``;
        expectMatches(content, true, ['$HOME/.claude']);
      });
    });
  });
});
