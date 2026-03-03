/**
 * GSD Tests - path-replacement.test.cjs
 *
 * Tests for replacePathPatterns() — centralised path replacement
 * that handles ~/.claude/, $HOME/.claude/, ./.claude/, and
 * runtime-specific variants during install.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const { replacePathPatterns } = require('../bin/install.js');

// ─── Basic replacements ──────────────────────────────────────────────────────

describe('replacePathPatterns', () => {
  const globalPrefix = '/Users/x/.claude/';

  test('replaces ~/.claude/ with pathPrefix', () => {
    const input = 'Read ~/.claude/commands/foo.md';
    const result = replacePathPatterns(input, globalPrefix, 'claude');
    assert.strictEqual(result, 'Read /Users/x/.claude/commands/foo.md');
  });

  test('replaces $HOME/.claude/ with pathPrefix (bug fix)', () => {
    const input = 'cat $HOME/.claude/commands/foo.md';
    const result = replacePathPatterns(input, globalPrefix, 'claude');
    assert.strictEqual(result, 'cat /Users/x/.claude/commands/foo.md');
  });

  test('replaces ./.claude/ with local dir for claude runtime', () => {
    const input = 'Read ./.claude/commands/foo.md';
    const result = replacePathPatterns(input, globalPrefix, 'claude');
    assert.strictEqual(result, 'Read ./.claude/commands/foo.md');
  });

  test('replaces ./.claude/ with ./.opencode/ for opencode runtime', () => {
    const input = 'Read ./.claude/commands/foo.md';
    const result = replacePathPatterns(input, '/home/user/.config/opencode/', 'opencode');
    assert.strictEqual(result, 'Read ./.opencode/commands/foo.md');
  });

  test('replaces ./.claude/ with ./.codex/ for codex runtime', () => {
    const input = 'Read ./.claude/commands/foo.md';
    const result = replacePathPatterns(input, '/home/user/.codex/', 'codex');
    assert.strictEqual(result, 'Read ./.codex/commands/foo.md');
  });

  test('replaces ./.claude/ with ./.kimi/ for kimi runtime', () => {
    const input = 'Read ./.claude/commands/foo.md';
    const result = replacePathPatterns(input, '/home/user/.kimi/', 'kimi');
    assert.strictEqual(result, 'Read ./.kimi/commands/foo.md');
  });

  // ─── Runtime-specific variants ─────────────────────────────────────────────

  test('replaces ~/.opencode/ only when runtime is opencode', () => {
    const prefix = '/home/user/.config/opencode/';
    assert.strictEqual(
      replacePathPatterns('path ~/.opencode/foo', prefix, 'opencode'),
      'path /home/user/.config/opencode/foo'
    );
    // Should NOT replace when runtime is claude
    assert.strictEqual(
      replacePathPatterns('path ~/.opencode/foo', globalPrefix, 'claude'),
      'path ~/.opencode/foo'
    );
  });

  test('replaces ~/.codex/ only when runtime is codex', () => {
    const prefix = '/home/user/.codex/';
    assert.strictEqual(
      replacePathPatterns('path ~/.codex/foo', prefix, 'codex'),
      'path /home/user/.codex/foo'
    );
    // Should NOT replace when runtime is claude
    assert.strictEqual(
      replacePathPatterns('path ~/.codex/foo', globalPrefix, 'claude'),
      'path ~/.codex/foo'
    );
  });

  // ─── Pass-through ──────────────────────────────────────────────────────────

  test('non-matching content passes through unchanged', () => {
    const input = 'No paths here, just text.';
    assert.strictEqual(
      replacePathPatterns(input, globalPrefix, 'claude'),
      input
    );
  });

  // ─── Multiple patterns in one string ───────────────────────────────────────

  test('replaces all pattern types in mixed content', () => {
    const input = [
      'global: ~/.claude/agents/foo.md',
      'env: $HOME/.claude/agents/bar.md',
      'local: ./.claude/commands/baz.md',
    ].join('\n');

    const result = replacePathPatterns(input, globalPrefix, 'claude');

    assert.strictEqual(result, [
      'global: /Users/x/.claude/agents/foo.md',
      'env: /Users/x/.claude/agents/bar.md',
      'local: ./.claude/commands/baz.md',
    ].join('\n'));
  });

  test('replaces multiple occurrences of the same pattern', () => {
    const input = '$HOME/.claude/a and $HOME/.claude/b';
    const result = replacePathPatterns(input, globalPrefix, 'claude');
    assert.strictEqual(result, '/Users/x/.claude/a and /Users/x/.claude/b');
  });
});
