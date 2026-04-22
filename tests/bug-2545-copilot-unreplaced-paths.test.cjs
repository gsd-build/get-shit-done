/**
 * Regression test for issue #2545.
 *
 * The Copilot content converter's `~/.claude/` and `$HOME/.claude/` replacements
 * only matched when a literal slash followed, so bare `~/.claude` references
 * (end of line, quotes, punctuation) were left unreplaced. Those leaks then
 * triggered the installer's "Found N unreplaced .claude path reference(s)"
 * warning, which scans for `(?:~|$HOME)/\.claude\b`.
 *
 * Fix: replace with a word-boundary pattern so both forms are caught in a
 * single pass, matching the approach already used by the Antigravity, OpenCode,
 * Kilo, and Codex converters.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { convertClaudeToCopilotContent } = require('../bin/install.js');

describe('convertClaudeToCopilotContent — bare ~/.claude (issue #2545)', () => {
  test('global install replaces bare ~/.claude at end of line', () => {
    const input = 'configDir = ~/.claude\n';
    const out = convertClaudeToCopilotContent(input, /* isGlobal */ true);
    assert.ok(
      !/(?:~|\$HOME)\/\.claude\b/.test(out),
      `expected no leaked ~/.claude reference, got: ${JSON.stringify(out)}`,
    );
    assert.match(out, /~\/\.copilot\b/);
  });

  test('global install replaces bare $HOME/.claude at end of line', () => {
    const input = 'configDir = $HOME/.claude\n';
    const out = convertClaudeToCopilotContent(input, /* isGlobal */ true);
    assert.ok(
      !/(?:~|\$HOME)\/\.claude\b/.test(out),
      `expected no leaked $HOME/.claude reference, got: ${JSON.stringify(out)}`,
    );
    assert.match(out, /\$HOME\/\.copilot\b/);
  });

  test('global install replaces bare ~/.claude before punctuation', () => {
    const input = 'paths include `~/.claude`, `~/.copilot`';
    const out = convertClaudeToCopilotContent(input, true);
    assert.ok(!/(?:~|\$HOME)\/\.claude\b/.test(out));
  });

  test('local install replaces bare ~/.claude', () => {
    const input = 'configDir = ~/.claude\n';
    const out = convertClaudeToCopilotContent(input, /* isGlobal */ false);
    assert.ok(
      !/(?:~|\$HOME)\/\.claude\b/.test(out),
      `expected no leaked ~/.claude reference, got: ${JSON.stringify(out)}`,
    );
  });

  test('does not double-replace trailing-slash form', () => {
    const input = '@~/.claude/get-shit-done/foo.md\n';
    const out = convertClaudeToCopilotContent(input, true);
    assert.match(out, /~\/\.copilot\/get-shit-done\/foo\.md/);
    assert.ok(!/\.copilot\/\.copilot/.test(out));
  });
});
