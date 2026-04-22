/**
 * Bug #2418: Found unreplaced .claude path reference(s) in Antigravity install
 *
 * The Antigravity path converter handles ~/.claude/ (with trailing slash) but
 * misses bare ~/.claude (without trailing slash), leaving unreplaced references
 * that cause the installer to warn about leaked paths.
 *
 * Files affected: agents/gsd-debugger.md (configDir = ~/.claude) and
 * get-shit-done/workflows/update.md (comment with e.g. ~/.claude).
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { convertClaudeToAntigravityContent } = require('../bin/install.js');

describe('convertClaudeToAntigravityContent bare path replacement (#2418)', () => {
  describe('global install', () => {
    test('replaces ~/.claude (bare, no trailing slash) with ~/.gemini/antigravity', () => {
      const input = 'configDir = ~/.claude';
      const result = convertClaudeToAntigravityContent(input, true);
      assert.ok(
        result.includes('~/.gemini/antigravity'),
        `Expected ~/.gemini/antigravity in output, got: ${result}`
      );
      assert.ok(
        !result.includes('~/.claude'),
        `Expected ~/ .claude to be replaced, got: ${result}`
      );
    });

    test('replaces $HOME/.claude (bare, no trailing slash) with $HOME/.gemini/antigravity', () => {
      const input = 'export DIR=$HOME/.claude';
      const result = convertClaudeToAntigravityContent(input, true);
      assert.ok(
        result.includes('$HOME/.gemini/antigravity'),
        `Expected $HOME/.gemini/antigravity in output, got: ${result}`
      );
      assert.ok(
        !result.includes('$HOME/.claude'),
        `Expected $HOME/.claude to be replaced, got: ${result}`
      );
    });

    test('handles bare ~/.claude followed by comma (comment context)', () => {
      const input = '# e.g. ~/.claude, ~/.config/opencode';
      const result = convertClaudeToAntigravityContent(input, true);
      assert.ok(
        !result.includes('~/.claude'),
        `Expected ~/ .claude to be replaced in comment context, got: ${result}`
      );
    });

    test('still replaces ~/.claude/ (with trailing slash) correctly', () => {
      const input = 'See ~/.claude/get-shit-done/workflows/';
      const result = convertClaudeToAntigravityContent(input, true);
      assert.ok(
        result.includes('~/.gemini/antigravity/get-shit-done/workflows/'),
        `Expected path with trailing slash to be replaced, got: ${result}`
      );
      assert.ok(!result.includes('~/.claude/'), `Expected ~/ .claude/ to be fully replaced, got: ${result}`);
    });

    test('does not double-replace ~/.claude/ paths', () => {
      const input = 'See ~/.claude/get-shit-done/';
      const result = convertClaudeToAntigravityContent(input, true);
      // Result should contain exactly one occurrence of the replacement path
      const count = (result.match(/~\/.gemini\/antigravity\//g) || []).length;
      assert.strictEqual(count, 1, `Expected exactly 1 replacement, got ${count} in: ${result}`);
    });
  });

  describe('local install', () => {
    test('replaces ~/.claude (bare, no trailing slash) with .agent', () => {
      const input = 'configDir = ~/.claude';
      const result = convertClaudeToAntigravityContent(input, false);
      assert.ok(
        result.includes('.agent'),
        `Expected .agent in output, got: ${result}`
      );
      assert.ok(
        !result.includes('~/.claude'),
        `Expected ~/ .claude to be replaced, got: ${result}`
      );
    });

    test('replaces $HOME/.claude (bare, no trailing slash) with .agent', () => {
      const input = 'export DIR=$HOME/.claude';
      const result = convertClaudeToAntigravityContent(input, false);
      assert.ok(
        result.includes('.agent'),
        `Expected .agent in output, got: ${result}`
      );
      assert.ok(
        !result.includes('$HOME/.claude'),
        `Expected $HOME/.claude to be replaced, got: ${result}`
      );
    });

    test('does not double-replace ~/.claude/ paths', () => {
      const input = 'See ~/.claude/get-shit-done/';
      const result = convertClaudeToAntigravityContent(input, false);
      // .agent/ should appear exactly once
      const count = (result.match(/\.agent\//g) || []).length;
      assert.strictEqual(count, 1, `Expected exactly 1 replacement, got ${count} in: ${result}`);
    });
  });

  describe('installed files contain no bare ~/.claude references after conversion', () => {
    const fs = require('fs');
    const path = require('path');
    const repoRoot = path.join(__dirname, '..');

    // The scanner regex used by the installer to detect leaked paths
    const leakedPathRegex = /(?:~|\$HOME)\/\.claude\b/g;

    function convertFile(filePath, isGlobal) {
      const content = fs.readFileSync(filePath, 'utf8');
      return convertClaudeToAntigravityContent(content, isGlobal);
    }

    test('gsd-debugger.md has no leaked ~/.claude after global Antigravity conversion', () => {
      const debuggerPath = path.join(repoRoot, 'agents', 'gsd-debugger.md');
      if (!fs.existsSync(debuggerPath)) return; // skip if file doesn't exist
      const converted = convertFile(debuggerPath, true);
      const matches = converted.match(leakedPathRegex);
      assert.strictEqual(
        matches, null,
        `gsd-debugger.md still contains leaked .claude paths after Antigravity conversion: ${matches}`
      );
    });

    test('update.md has no leaked ~/.claude after global Antigravity conversion', () => {
      const updatePath = path.join(repoRoot, 'get-shit-done', 'workflows', 'update.md');
      if (!fs.existsSync(updatePath)) return; // skip if file doesn't exist
      const converted = convertFile(updatePath, true);
      const matches = converted.match(leakedPathRegex);
      assert.strictEqual(
        matches, null,
        `update.md still contains leaked .claude paths after Antigravity conversion: ${matches}`
      );
    });
  });
});
