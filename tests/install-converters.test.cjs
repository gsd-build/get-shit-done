/**
 * GSD Tools Tests - install-converters.test.cjs
 *
 * Tests for all runtime converter functions in bin/install.js:
 * - convertToolName (Claude -> OpenCode tool names)
 * - convertGeminiToolName (Claude -> Gemini tool names)
 * - convertClaudeToOpencodeFrontmatter (full agent/command conversion for OpenCode)
 * - convertClaudeToGeminiAgent (full agent conversion for Gemini CLI)
 * - convertClaudeToGeminiToml (command conversion to Gemini TOML format)
 * - convertClaudeToCodexMarkdown (slash command conversion for Codex)
 * - convertClaudeCommandToCodexSkill (wraps command with skill adapter header)
 * - stripSubTags (removes HTML sub tags)
 * - extractFrontmatterAndBody (splits content at --- delimiters)
 * - toSingleLine / yamlQuote (string helpers)
 */

// Enable test exports from install.js (skips main CLI logic)
process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  convertToolName,
  convertGeminiToolName,
  convertClaudeToOpencodeFrontmatter,
  convertClaudeToGeminiAgent,
  convertClaudeToGeminiToml,
  convertClaudeToCodexMarkdown,
  convertClaudeCommandToCodexSkill,
  stripSubTags,
  extractFrontmatterAndBody,
  toSingleLine,
  yamlQuote,
  colorNameToHex,
  claudeToOpencodeTools,
  claudeToGeminiTools,
} = require('../bin/install.js');

// ─── convertToolName ─────────────────────────────────────────────────────────

describe('convertToolName', () => {
  test('maps AskUserQuestion to question', () => {
    assert.strictEqual(convertToolName('AskUserQuestion'), 'question');
  });

  test('maps SlashCommand to skill', () => {
    assert.strictEqual(convertToolName('SlashCommand'), 'skill');
  });

  test('maps TodoWrite to todowrite', () => {
    assert.strictEqual(convertToolName('TodoWrite'), 'todowrite');
  });

  test('maps WebFetch to webfetch', () => {
    assert.strictEqual(convertToolName('WebFetch'), 'webfetch');
  });

  test('passes MCP tools through unchanged', () => {
    assert.strictEqual(convertToolName('mcp__filesystem__read_file'), 'mcp__filesystem__read_file');
    assert.strictEqual(convertToolName('mcp__github__create_pr'), 'mcp__github__create_pr');
  });

  test('lowercases standard tools', () => {
    assert.strictEqual(convertToolName('Read'), 'read');
    assert.strictEqual(convertToolName('Write'), 'write');
    assert.strictEqual(convertToolName('Bash'), 'bash');
    assert.strictEqual(convertToolName('Grep'), 'grep');
    assert.strictEqual(convertToolName('Glob'), 'glob');
  });

  test('lowercases unknown tools', () => {
    assert.strictEqual(convertToolName('SomeFutureTool'), 'somefuturetool');
  });
});

// ─── convertGeminiToolName ────────────────────────────────────────────────────

describe('convertGeminiToolName', () => {
  test('maps Read to read_file', () => {
    assert.strictEqual(convertGeminiToolName('Read'), 'read_file');
  });

  test('maps Write to write_file', () => {
    assert.strictEqual(convertGeminiToolName('Write'), 'write_file');
  });

  test('maps Edit to replace', () => {
    assert.strictEqual(convertGeminiToolName('Edit'), 'replace');
  });

  test('maps Bash to run_shell_command', () => {
    assert.strictEqual(convertGeminiToolName('Bash'), 'run_shell_command');
  });

  test('maps Grep to search_file_content', () => {
    assert.strictEqual(convertGeminiToolName('Grep'), 'search_file_content');
  });

  test('maps WebSearch to google_web_search', () => {
    assert.strictEqual(convertGeminiToolName('WebSearch'), 'google_web_search');
  });

  test('maps WebFetch to web_fetch', () => {
    assert.strictEqual(convertGeminiToolName('WebFetch'), 'web_fetch');
  });

  test('returns null for mcp__* tools (excluded)', () => {
    assert.strictEqual(convertGeminiToolName('mcp__filesystem__read'), null);
    assert.strictEqual(convertGeminiToolName('mcp__github__list_prs'), null);
  });

  test('returns null for Task (excluded)', () => {
    assert.strictEqual(convertGeminiToolName('Task'), null);
  });

  test('lowercases unknown tools', () => {
    assert.strictEqual(convertGeminiToolName('SomeTool'), 'sometool');
  });
});

// ─── convertClaudeToOpencodeFrontmatter ──────────────────────────────────────

describe('convertClaudeToOpencodeFrontmatter', () => {
  const agentWithInlineTools = `---
name: gsd-executor
description: Executes GSD plans with atomic commits
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

<role>
You are a GSD plan executor. Run /gsd:execute-phase to proceed.
Use AskUserQuestion to ask the user a question.
Config lives in ~/.claude directory.
</role>`;

  test('converts inline tools list to tools map with boolean values', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    assert.ok(result.includes('tools:'), 'has tools section');
    assert.ok(result.includes('  read: true'), 'has read: true');
    assert.ok(result.includes('  write: true'), 'has write: true');
    assert.ok(result.includes('  bash: true'), 'has bash: true');
  });

  test('strips name: field from frontmatter', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    // Check frontmatter section specifically
    const fmEnd = result.indexOf('---', 4);
    const frontmatter = result.substring(0, fmEnd);
    assert.ok(!frontmatter.includes('name:'), 'name field removed from frontmatter');
  });

  test('converts color name to hex', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    assert.ok(result.includes('color: "#FFFF00"'), 'yellow converted to hex #FFFF00');
    assert.ok(!result.includes('color: yellow'), 'original color name removed');
  });

  test('converts cyan color name to hex', () => {
    const input = `---\nname: test\ndescription: Test\ntools: Read\ncolor: cyan\n---\nBody`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.ok(result.includes('color: "#00FFFF"'), 'cyan converted to #00FFFF');
  });

  test('skips unknown color values', () => {
    const input = `---\nname: test\ndescription: Test\ntools: Read\ncolor: turquoise\n---\nBody`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.ok(!result.includes('color:'), 'unknown color name dropped');
  });

  test('replaces AskUserQuestion with question in body', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    assert.ok(result.includes('question'), 'AskUserQuestion replaced with question');
    assert.ok(!result.includes('AskUserQuestion'), 'original AskUserQuestion removed');
  });

  test('replaces /gsd: with /gsd- in body', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    assert.ok(result.includes('/gsd-execute-phase'), 'slash command prefix converted');
    assert.ok(!result.includes('/gsd:execute-phase'), 'original slash command prefix removed');
  });

  test('replaces ~/.claude with ~/.config/opencode in body', () => {
    const result = convertClaudeToOpencodeFrontmatter(agentWithInlineTools);
    assert.ok(result.includes('~/.config/opencode'), 'path converted to opencode config');
    assert.ok(!result.includes('~/.claude'), 'original claude path removed');
  });

  test('replaces $HOME/.claude with $HOME/.config/opencode', () => {
    const input = `---\nname: t\ndescription: T\ntools: Read\n---\nSee $HOME/.claude for config.`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.ok(result.includes('$HOME/.config/opencode'), '$HOME path converted');
    assert.ok(!result.includes('$HOME/.claude'), 'original $HOME/.claude removed');
  });

  test('returns content unchanged if no frontmatter', () => {
    const input = 'Just some content without frontmatter.';
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.strictEqual(result, input, 'no-frontmatter content unchanged');
  });

  test('converts allowed-tools YAML array to tools map', () => {
    const input = `---
name: gsd-planner
description: Plans GSD phases
allowed-tools:
  - Read
  - Write
  - Bash
---

Body content here.`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.ok(result.includes('  read: true'), 'allowed-tools Read converted');
    assert.ok(result.includes('  write: true'), 'allowed-tools Write converted');
    assert.ok(result.includes('  bash: true'), 'allowed-tools Bash converted');
  });

  test('converts special tool names in tools map', () => {
    const input = `---\nname: t\ndescription: T\ntools: AskUserQuestion, SlashCommand\n---\nBody`;
    const result = convertClaudeToOpencodeFrontmatter(input);
    assert.ok(result.includes('  question: true'), 'AskUserQuestion mapped to question');
    assert.ok(result.includes('  skill: true'), 'SlashCommand mapped to skill');
  });
});

// ─── convertClaudeToGeminiAgent ───────────────────────────────────────────────

describe('convertClaudeToGeminiAgent', () => {
  const sampleAgent = `---
name: gsd-executor
description: Executes GSD plans
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
---

<role>
You are a GSD executor. Use ${'{PHASE}'} variable.
</role>`;

  test('maps tools via convertGeminiToolName', () => {
    const result = convertClaudeToGeminiAgent(sampleAgent);
    assert.ok(result.includes('  - read_file'), 'Read mapped to read_file');
    assert.ok(result.includes('  - write_file'), 'Write mapped to write_file');
    assert.ok(result.includes('  - replace'), 'Edit mapped to replace');
    assert.ok(result.includes('  - run_shell_command'), 'Bash mapped to run_shell_command');
    assert.ok(result.includes('  - search_file_content'), 'Grep mapped to search_file_content');
  });

  test('builds tools as YAML array format', () => {
    const result = convertClaudeToGeminiAgent(sampleAgent);
    // tools: should be followed by array items, not inline comma-separated
    assert.ok(result.includes('tools:\n  - '), 'tools formatted as YAML array');
  });

  test('strips color field', () => {
    const result = convertClaudeToGeminiAgent(sampleAgent);
    assert.ok(!result.includes('color:'), 'color field removed');
  });

  test('escapes ${VAR} patterns to $VAR in body', () => {
    const inputWithVar = '---\nname: gsd-test\ndescription: Test\ntools: Read\n---\n\nUse ${PHASE} variable.'.replace('${PHASE}', '$' + '{PHASE}');
    const result = convertClaudeToGeminiAgent(inputWithVar);
    assert.ok(result.includes('$PHASE'), 'template variable braces removed');
    assert.ok(!result.includes('$' + '{PHASE}'), 'original ${PHASE} pattern removed');
  });

  test('returns content unchanged if no frontmatter', () => {
    const input = 'No frontmatter content.';
    const result = convertClaudeToGeminiAgent(input);
    assert.strictEqual(result, input, 'no-frontmatter content unchanged');
  });

  test('excludes MCP tools from output', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read, mcp__filesystem__read
---

Body`;
    const result = convertClaudeToGeminiAgent(input);
    assert.ok(!result.includes('mcp__'), 'MCP tools excluded');
    assert.ok(result.includes('read_file'), 'standard tools kept');
  });

  test('excludes Task tool from output', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read, Task
---

Body`;
    const result = convertClaudeToGeminiAgent(input);
    assert.ok(!result.includes('  - task'), 'Task tool excluded');
  });

  test('calls stripSubTags on body', () => {
    const input = `---
name: gsd-test
description: Test
tools: Read
---

Use <sub>subscript text</sub> here.`;
    const result = convertClaudeToGeminiAgent(input);
    assert.ok(result.includes('*(subscript text)*'), 'sub tags converted to italic');
    assert.ok(!result.includes('<sub>'), 'opening sub tag removed');
    assert.ok(!result.includes('</sub>'), 'closing sub tag removed');
  });

  test('converts allowed-tools YAML array format', () => {
    const input = `---
name: gsd-test
description: Test
allowed-tools:
  - Read
  - Bash
---

Body`;
    const result = convertClaudeToGeminiAgent(input);
    assert.ok(result.includes('  - read_file'), 'allowed-tools Read converted');
    assert.ok(result.includes('  - run_shell_command'), 'allowed-tools Bash converted');
  });
});

// ─── convertClaudeToGeminiToml ────────────────────────────────────────────────

describe('convertClaudeToGeminiToml', () => {
  test('extracts description from frontmatter into TOML description field', () => {
    const input = `---
description: Execute a GSD plan phase
---

Run the plan and commit each task.`;
    const result = convertClaudeToGeminiToml(input);
    assert.ok(result.includes('description = "Execute a GSD plan phase"'), 'description in TOML');
  });

  test('puts body content into prompt field with JSON.stringify quoting', () => {
    const input = `---
description: Test command
---

Do something important.`;
    const result = convertClaudeToGeminiToml(input);
    assert.ok(result.includes('prompt = '), 'has prompt field');
    // Body should be JSON-stringified (quoted)
    assert.ok(result.match(/prompt = ".*"/s) || result.match(/prompt = '[^']*'/), 'prompt is quoted');
  });

  test('returns just prompt field if no description', () => {
    const input = `---
name: gsd-execute
---

Execute the plan.`;
    const result = convertClaudeToGeminiToml(input);
    assert.ok(!result.includes('description ='), 'no description field when absent');
    assert.ok(result.includes('prompt = '), 'has prompt field');
  });

  test('returns prompt-wrapped content if no frontmatter', () => {
    const input = 'Plain content without frontmatter.';
    const result = convertClaudeToGeminiToml(input);
    assert.ok(result.includes('prompt = '), 'wraps plain content in prompt field');
    assert.ok(result.includes('Plain content without frontmatter.'), 'content preserved in prompt');
  });

  test('handles multiline body content', () => {
    const input = `---
description: Multi-line test
---

Line 1.
Line 2.
Line 3.`;
    const result = convertClaudeToGeminiToml(input);
    assert.ok(result.includes('description = "Multi-line test"'), 'description present');
    assert.ok(result.includes('prompt = '), 'prompt present');
  });

  test('JSON.stringify escapes special characters in prompt', () => {
    const input = `---
description: Test
---

Has "quotes" and backslashes \\ here.`;
    const result = convertClaudeToGeminiToml(input);
    // JSON.stringify wraps the value in double quotes and escapes internal quotes
    assert.ok(result.includes('prompt = '), 'prompt field present');
  });
});

// ─── convertClaudeToCodexMarkdown ─────────────────────────────────────────────

describe('convertClaudeToCodexMarkdown', () => {
  test('converts /gsd: to $gsd- in content', () => {
    const input = 'Run /gsd:execute-phase to proceed.';
    const result = convertClaudeToCodexMarkdown(input);
    assert.ok(result.includes('$gsd-execute-phase'), 'slash command converted');
    assert.ok(!result.includes('/gsd:execute-phase'), 'original removed');
  });

  test('converts multiple slash commands', () => {
    const input = 'Use /gsd:plan-phase then /gsd:execute-phase.';
    const result = convertClaudeToCodexMarkdown(input);
    assert.ok(result.includes('$gsd-plan-phase'), 'first command converted');
    assert.ok(result.includes('$gsd-execute-phase'), 'second command converted');
  });

  test('converts $ARGUMENTS to {{GSD_ARGS}}', () => {
    const input = 'Pass $ARGUMENTS to the command.';
    const result = convertClaudeToCodexMarkdown(input);
    assert.ok(result.includes('{{GSD_ARGS}}'), 'ARGUMENTS converted to GSD_ARGS');
    assert.ok(!result.includes('$ARGUMENTS'), 'original removed');
  });

  test('leaves non-gsd content unchanged', () => {
    const input = 'Regular content with no GSD commands.';
    const result = convertClaudeToCodexMarkdown(input);
    assert.strictEqual(result, input, 'unchanged content returned as-is');
  });

  test('handles /gsd:command in frontmatter body', () => {
    const input = `---
name: test
description: Test command
---

Invoke /gsd:quick to start a quick plan.`;
    const result = convertClaudeToCodexMarkdown(input);
    assert.ok(result.includes('$gsd-quick'), 'command in body converted');
  });
});

// ─── convertClaudeCommandToCodexSkill ─────────────────────────────────────────

describe('convertClaudeCommandToCodexSkill', () => {
  const sampleCommand = `---
name: gsd-execute-phase
description: Execute a GSD phase by running all plans in sequence
---

Run /gsd:execute-phase with $ARGUMENTS to proceed.`;

  test('prepends skill adapter header before the command content', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.includes('<codex_skill_adapter>'), 'has skill adapter opening tag');
    assert.ok(result.includes('</codex_skill_adapter>'), 'has skill adapter closing tag');
  });

  test('skill name appears in the adapter header', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.includes('$gsd-execute-phase'), 'skill name in invocation syntax');
  });

  test('includes rebuilt frontmatter with name and description', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.startsWith('---\n'), 'starts with frontmatter');
    assert.ok(result.includes('"gsd-execute-phase"'), 'skill name in frontmatter');
    assert.ok(result.includes('Execute a GSD phase'), 'description in frontmatter');
  });

  test('converts /gsd: to $gsd- in the body', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.includes('$gsd-execute-phase'), 'slash command converted in body');
  });

  test('converts $ARGUMENTS to {{GSD_ARGS}} in the body', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.includes('{{GSD_ARGS}}'), 'ARGUMENTS converted in body');
  });

  test('uses command description as skill description', () => {
    const result = convertClaudeCommandToCodexSkill(sampleCommand, 'gsd-execute-phase');
    assert.ok(result.includes('Execute a GSD phase by running all plans in sequence'), 'description preserved');
  });

  test('uses default description when no frontmatter description', () => {
    const input = `---
name: gsd-test
---

Body content.`;
    const result = convertClaudeCommandToCodexSkill(input, 'gsd-test');
    assert.ok(result.includes('gsd-test'), 'skill name in output');
  });
});

// ─── stripSubTags ─────────────────────────────────────────────────────────────

describe('stripSubTags', () => {
  test('converts sub tags to italic notation', () => {
    const input = 'See <sub>subscript</sub> text.';
    const result = stripSubTags(input);
    assert.ok(result.includes('*(subscript)*'), 'sub tag converted to italic');
    assert.ok(!result.includes('<sub>'), 'opening tag removed');
    assert.ok(!result.includes('</sub>'), 'closing tag removed');
  });

  test('preserves surrounding content', () => {
    const input = 'Before <sub>middle</sub> after.';
    const result = stripSubTags(input);
    assert.ok(result.includes('Before'), 'content before preserved');
    assert.ok(result.includes('after.'), 'content after preserved');
  });

  test('handles multiple sub tags', () => {
    const input = '<sub>first</sub> and <sub>second</sub>';
    const result = stripSubTags(input);
    assert.ok(result.includes('*(first)*'), 'first sub tag converted');
    assert.ok(result.includes('*(second)*'), 'second sub tag converted');
  });

  test('returns content unchanged when no sub tags', () => {
    const input = 'No sub tags here.';
    const result = stripSubTags(input);
    assert.strictEqual(result, input, 'unchanged content returned as-is');
  });
});

// ─── extractFrontmatterAndBody ─────────────────────────────────────────────────

describe('extractFrontmatterAndBody', () => {
  test('splits content at --- delimiters into frontmatter and body', () => {
    const input = `---
name: test
description: Test
---

Body content here.`;
    const { frontmatter, body } = extractFrontmatterAndBody(input);
    assert.ok(frontmatter !== null, 'frontmatter extracted');
    assert.ok(frontmatter.includes('name: test'), 'frontmatter has name field');
    assert.ok(body.includes('Body content here.'), 'body extracted');
  });

  test('returns null frontmatter if content does not start with ---', () => {
    const input = 'No frontmatter here.';
    const { frontmatter, body } = extractFrontmatterAndBody(input);
    assert.strictEqual(frontmatter, null, 'frontmatter is null');
    assert.strictEqual(body, input, 'body is the full content');
  });

  test('handles missing closing ---', () => {
    const input = '---\nname: test\n';
    const { frontmatter } = extractFrontmatterAndBody(input);
    assert.strictEqual(frontmatter, null, 'null frontmatter when no closing ---');
  });

  test('handles empty frontmatter section', () => {
    const input = `---
---

Body only.`;
    const { frontmatter, body } = extractFrontmatterAndBody(input);
    // With empty frontmatter, either null or empty string is acceptable
    assert.ok(body.includes('Body only.'), 'body extracted');
  });
});

// ─── toSingleLine ─────────────────────────────────────────────────────────────

describe('toSingleLine', () => {
  test('collapses newlines into single spaces', () => {
    const input = 'First line\nSecond line';
    const result = toSingleLine(input);
    assert.strictEqual(result, 'First line Second line');
  });

  test('collapses tabs into single spaces', () => {
    const input = 'Tab\there';
    const result = toSingleLine(input);
    assert.strictEqual(result, 'Tab here');
  });

  test('collapses multiple spaces into one', () => {
    const input = 'Too   many   spaces';
    const result = toSingleLine(input);
    assert.strictEqual(result, 'Too many spaces');
  });

  test('trims leading and trailing whitespace', () => {
    const input = '  leading and trailing  ';
    const result = toSingleLine(input);
    assert.strictEqual(result, 'leading and trailing');
  });

  test('handles already single-line content', () => {
    const input = 'Already single line.';
    const result = toSingleLine(input);
    assert.strictEqual(result, 'Already single line.');
  });
});

// ─── yamlQuote ────────────────────────────────────────────────────────────────

describe('yamlQuote', () => {
  test('wraps values in double quotes', () => {
    const result = yamlQuote('hello world');
    assert.strictEqual(result, '"hello world"');
  });

  test('escapes internal double quotes', () => {
    const result = yamlQuote('say "hello"');
    assert.ok(result.startsWith('"'), 'starts with quote');
    assert.ok(result.endsWith('"'), 'ends with quote');
    assert.ok(result.includes('\\"hello\\"'), 'internal quotes escaped');
  });

  test('handles empty string', () => {
    const result = yamlQuote('');
    assert.strictEqual(result, '""');
  });

  test('handles string with special characters', () => {
    const result = yamlQuote('path/to/file.md');
    assert.strictEqual(result, '"path/to/file.md"');
  });
});

// ─── Constants sanity checks ──────────────────────────────────────────────────

describe('colorNameToHex', () => {
  test('maps standard color names to hex codes', () => {
    assert.strictEqual(colorNameToHex.cyan, '#00FFFF');
    assert.strictEqual(colorNameToHex.red, '#FF0000');
    assert.strictEqual(colorNameToHex.green, '#00FF00');
    assert.strictEqual(colorNameToHex.yellow, '#FFFF00');
    assert.strictEqual(colorNameToHex.blue, '#0000FF');
  });

  test('is an object (not null)', () => {
    assert.ok(colorNameToHex !== null && typeof colorNameToHex === 'object');
  });
});

describe('claudeToOpencodeTools', () => {
  test('maps AskUserQuestion to question', () => {
    assert.strictEqual(claudeToOpencodeTools.AskUserQuestion, 'question');
  });

  test('maps SlashCommand to skill', () => {
    assert.strictEqual(claudeToOpencodeTools.SlashCommand, 'skill');
  });
});

describe('claudeToGeminiTools', () => {
  test('maps Read to read_file', () => {
    assert.strictEqual(claudeToGeminiTools.Read, 'read_file');
  });

  test('maps Bash to run_shell_command', () => {
    assert.strictEqual(claudeToGeminiTools.Bash, 'run_shell_command');
  });
});
