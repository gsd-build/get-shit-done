/**
 * Regression tests for Gemini namespacing (PR #2768)
 * 
 * Verifies that slash commands are correctly converted to colon format (/gsd:)
 * while preserving URLs, file paths, and agent names.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  convertSlashCommandsToGeminiMentions,
  convertClaudeToGeminiMarkdown,
  _resetGsdCommandRoster,
  install
} = require('../bin/install.js');

/**
 * Minimal parser for the simple TOML emitted by convertClaudeToGeminiToml —
 * exactly two top-level keys (`description` and `prompt`), each a JSON-quoted
 * string. Throws on unparseable lines so a regression in the emitter shape
 * fails loudly rather than silently mis-parsing.
 */
function parseGeminiCommandToml(toml) {
  const result = {};
  for (const rawLine of toml.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^([a-z_]+)\s*=\s*(.*)$/);
    if (!match) throw new Error(`Unparseable TOML line: ${rawLine}`);
    const [, key, value] = match;
    // Values are JSON-encoded strings — JSON.parse handles all escapes.
    result[key] = JSON.parse(value);
  }
  return result;
}

describe('Gemini Slash Command Namespacing (Regex)', () => {
  test('converts simple slash commands', () => {
    const input = 'Run /gsd-plan-phase to start.';
    const expected = 'Run /gsd:plan-phase to start.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), expected);
  });

  test('preserves URLs with /gsd- in them', () => {
    const input = 'Documentation: https://example.com/gsd-tools/info';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  // The roster check is the safety property: a token like /gsd-plan-phase IS
  // a known command name, but when it appears inside a URL path it must NOT
  // be converted. This pins that the roster check actually fires — a regex-only
  // approach without a roster would convert this incorrectly.
  test('preserves URLs even when path contains a KNOWN command name', () => {
    const input = 'See https://example.com/gsd-plan-phase for context.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  test('preserves sub-paths: bin/gsd-tools.cjs', () => {
    const input = 'See bin/gsd-tools.cjs for details.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  test('preserves sub-paths even when leaf is a KNOWN command name', () => {
    // bin/gsd-plan-phase looks like a known command but is a file path.
    // The leading / on a sub-path follows a non-slash char so the regex
    // boundary is the safety net here, not the roster.
    const input = 'Reference bin/gsd-plan-phase for details.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  test('preserves root-relative paths with extensions: /gsd-tools.cjs', () => {
    const input = 'Load /gsd-tools.cjs now.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  test('preserves agent names: gsd-planner', () => {
    const input = 'The gsd-planner agent will help you.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), input);
  });

  test('converts commands in backticks', () => {
    const input = 'Run `/gsd-new-project` in a terminal.';
    const expected = 'Run `/gsd:new-project` in a terminal.';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), expected);
  });

  test('converts commands ending with punctuation', () => {
    // Use two stable, foundational commands so this test doesn't drift when
    // the roster gets consolidated (cf. #2790, which removed `scan`). `help`
    // and `health` are both bedrock; if either ever gets removed, swap to
    // any other entry currently in commands/gsd/.
    const input = 'Run /gsd-help. Or /gsd-health!';
    const expected = 'Run /gsd:help. Or /gsd:health!';
    assert.strictEqual(convertSlashCommandsToGeminiMentions(input), expected);
  });

  test('roster has loaded — non-empty (would otherwise silently no-op all conversions)', () => {
    _resetGsdCommandRoster();
    // First conversion call lazily populates the roster. If it returned an
    // empty Set (because commands/gsd/ was not found), every conversion
    // becomes a no-op — exactly the bug this code exists to prevent.
    const result = convertSlashCommandsToGeminiMentions('Run /gsd-plan-phase.');
    assert.strictEqual(result, 'Run /gsd:plan-phase.',
      'Roster failed to load — all /gsd- conversions would silently no-op');
  });
});

describe('Gemini Markdown Processor', () => {
  test('handles command to TOML conversion', () => {
    const input = '---\ndescription: Test\n---\nRun /gsd-help.';
    const result = convertClaudeToGeminiMarkdown(input, { isCommand: true });
    const parsed = parseGeminiCommandToml(result);
    assert.equal(parsed.description, 'Test', 'description must round-trip through TOML');
    assert.match(parsed.prompt, /\/gsd:help/, 'prompt must contain namespaced command');
    assert.doesNotMatch(parsed.prompt, /\/gsd-help/, 'prompt must not retain hyphen form');
  });

  test('strips <sub> tags from Gemini markdown output (#2768 regression)', () => {
    // The pre-refactor command path called stripSubTags before TOML conversion.
    // After centralizing through convertClaudeToGeminiMarkdown, sub tags must
    // still be stripped — terminals can't render HTML subscript.
    const input = 'Run <sub>tiny</sub> /gsd-help now.';
    const result = convertClaudeToGeminiMarkdown(input, { isCommand: false });
    assert.doesNotMatch(result, /<sub>|<\/sub>/, '<sub> tags must be stripped');
    assert.match(result, /\/gsd:help/, 'slash command must still be converted');
  });
});

describe('Gemini Install (Behavioral)', () => {
  let tmpDir;
  let tmpHome;
  let previousCwd;
  let previousHome;
  let previousUserprofile;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-gemini-test-');
    tmpHome = createTempDir('gsd-gemini-home-');
    previousCwd = process.cwd();
    previousHome = process.env.HOME;
    previousUserprofile = process.env.USERPROFILE;
    process.chdir(tmpDir);
    // #3037: isolate HOME so the developer's real ~/.gemini/commands/gsd/
    // doesn't trigger the local-install conflict-avoidance skip path. This
    // test wants to assert that the local install populates commands/gsd/
    // when no global GSD is present at the user scope.
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome;
  });

  afterEach(() => {
    process.chdir(previousCwd);
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserprofile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserprofile;
    cleanup(tmpDir);
    cleanup(tmpHome);
  });

  test('install creates correct directory structure for Gemini', () => {
    // Run install in silent mode
    const oldLog = console.log;
    console.log = () => {};
    try {
      install(false, 'gemini');
    } finally {
      console.log = oldLog;
    }

    const commandsDir = path.join(tmpDir, '.gemini', 'commands', 'gsd');
    assert.ok(fs.existsSync(commandsDir), `Commands should be in ${commandsDir}`);
    const agentsDir = path.join(tmpDir, '.gemini', 'agents');
    assert.ok(fs.existsSync(agentsDir), 'Agents should be installed');

    // Structurally verify a real installed command artifact: parse the TOML
    // and assert the prompt body has been namespaced. A directory-only check
    // would pass even if every conversion silently no-op'd.
    const planPhaseToml = path.join(commandsDir, 'plan-phase.toml');
    assert.ok(fs.existsSync(planPhaseToml), 'plan-phase.toml must be installed');
    const parsed = parseGeminiCommandToml(fs.readFileSync(planPhaseToml, 'utf8'));
    assert.equal(typeof parsed.prompt, 'string', 'plan-phase.toml must have a prompt');
    // The plan-phase prompt cross-references other GSD commands; pin that at
    // least one of those references survived as a colon-namespaced mention.
    assert.match(parsed.prompt, /\/gsd:[a-z][a-z0-9-]*/,
      'installed plan-phase.toml prompt must contain at least one /gsd: reference');
    assert.doesNotMatch(parsed.prompt, /(?<![A-Za-z0-9./])\/gsd-plan-phase\b/,
      'installed plan-phase.toml prompt must not retain unconverted /gsd-plan-phase');
  });
});
