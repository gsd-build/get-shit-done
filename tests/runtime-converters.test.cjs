/**
 * Runtime Converter Tests — OpenCode + Gemini
 *
 * Tests for small runtime-specific conversion functions from install.js.
 * Larger runtime test suites (Copilot, Codex, Antigravity) have their own files.
 *
 * OpenCode: convertClaudeToOpencodeFrontmatter (agent + command modes)
 *   model: inherit is NOT added (OpenCode doesn't support it — see #1156)
 *   but mode: subagent IS added (required by OpenCode agents).
 * Gemini: convertClaudeToGeminiAgent (frontmatter + tool mapping + body escaping)
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.GSD_TEST_MODE = '1';
const {
  convertClaudeToOpencodeFrontmatter,
  convertClaudeToGeminiAgent,
  neutralizeAgentReferences,
} = require('../bin/install.js');

// Sample Claude agent frontmatter (matches actual GSD agent format)
const SAMPLE_AGENT = `---
name: gsd-executor
description: Executes GSD plans with atomic commits
tools: Read, Write, Edit, Bash, Grep, Glob
color: yellow
skills:
  - gsd-executor-workflow
# hooks:
#   PostToolUse:
#     - matcher: "Write|Edit"
#       hooks:
#         - type: command
#           command: "npx eslint --fix $FILE 2>/dev/null || true"
---

<role>
You are a GSD plan executor.
</role>`;

// Sample Claude command frontmatter (for comparison — commands work differently)
const SAMPLE_COMMAND = `---
name: gsd-execute-phase
description: Execute all plans in a phase
allowed-tools:
  - Read
  - Write
  - Bash
---

Execute the phase plan.`;

describe('OpenCode agent conversion (isAgent: true)', () => {
  test('keeps name: field for agents', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(frontmatter.includes('name: gsd-executor'), 'name: should be preserved for agents');
  });

  test('does not add model: inherit (OpenCode does not support it)', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('model: inherit'), 'model: inherit should NOT be added — OpenCode throws ProviderModelNotFoundError');
  });

  test('adds mode: subagent', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(frontmatter.includes('mode: subagent'), 'mode: subagent should be added');
  });

  test('strips tools: field', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('tools:'), 'tools: should be stripped for agents');
    assert.ok(!frontmatter.includes('read: true'), 'tools object should not be generated');
  });

  test('strips skills: array', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('skills:'), 'skills: should be stripped');
    assert.ok(!frontmatter.includes('gsd-executor-workflow'), 'skill entries should be stripped');
  });

  test('strips color: field', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('color:'), 'color: should be stripped for agents');
  });

  test('strips commented hooks block', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('# hooks:'), 'commented hooks should be stripped');
    assert.ok(!frontmatter.includes('PostToolUse'), 'hook content should be stripped');
  });

  test('keeps description: field', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(frontmatter.includes('description: Executes GSD plans'), 'description should be kept');
  });

  test('preserves body content', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    assert.ok(result.includes('<role>'), 'body should be preserved');
    assert.ok(result.includes('You are a GSD plan executor.'), 'body content should be intact');
  });

  test('applies body text replacements', () => {
    const agentWithClaudePaths = `---
name: test-agent
description: Test
tools: Read
---

Read ~/.claude/agent-memory/ for context.
Use $HOME/.claude/skills/ for reference.`;

    const result = convertClaudeToOpencodeFrontmatter(agentWithClaudePaths, { isAgent: true });
    assert.ok(result.includes('~/.config/opencode/agent-memory/'), '~/.claude should be replaced');
    assert.ok(result.includes('$HOME/.config/opencode/skills/'), '$HOME/.claude should be replaced');
  });
});

describe('OpenCode command conversion (isAgent: false, default)', () => {
  test('strips name: field for commands', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_COMMAND);
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('name:'), 'name: should be stripped for commands');
  });

  test('does not add model: or mode: for commands', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_COMMAND);
    const frontmatter = result.split('---')[1];
    assert.ok(!frontmatter.includes('model:'), 'model: should not be added for commands');
    assert.ok(!frontmatter.includes('mode:'), 'mode: should not be added for commands');
  });

  test('keeps description: for commands', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_COMMAND);
    const frontmatter = result.split('---')[1];
    assert.ok(frontmatter.includes('description:'), 'description should be kept');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Gemini CLI agent conversion (merged from gemini-config.test.cjs)
// ─────────────────────────────────────────────────────────────────────────────

describe('convertClaudeToGeminiAgent', () => {
  test('drops unsupported skills frontmatter while keeping converted tools', () => {
    const input = `---
name: gsd-codebase-mapper
description: Explores codebase and writes structured analysis documents.
tools: Read, Bash, Grep, Glob, Write
color: cyan
skills:
  - gsd-mapper-workflow
---

<role>
Use \${PHASE} in shell examples.
</role>`;

    const result = convertClaudeToGeminiAgent(input);
    const frontmatter = result.split('---')[1] || '';

    assert.ok(frontmatter.includes('name: gsd-codebase-mapper'), 'keeps name');
    assert.ok(frontmatter.includes('description: Explores codebase and writes structured analysis documents.'), 'keeps description');
    assert.ok(frontmatter.includes('tools:'), 'adds Gemini tools array');
    assert.ok(frontmatter.includes('  - read_file'), 'maps Read -> read_file');
    assert.ok(frontmatter.includes('  - run_shell_command'), 'maps Bash -> run_shell_command');
    assert.ok(frontmatter.includes('  - search_file_content'), 'maps Grep -> search_file_content');
    assert.ok(frontmatter.includes('  - glob'), 'maps Glob -> glob');
    assert.ok(frontmatter.includes('  - write_file'), 'maps Write -> write_file');
    assert.ok(!frontmatter.includes('color:'), 'drops unsupported color field');
    assert.ok(!frontmatter.includes('skills:'), 'drops unsupported skills field');
    assert.ok(!frontmatter.includes('gsd-mapper-workflow'), 'drops skills list items');
    assert.ok(result.includes('$PHASE'), 'escapes ${PHASE} shell variable for Gemini');
    assert.ok(!result.includes('${PHASE}'), 'removes Gemini template-string pattern');
  });
});

// ─── neutralizeAgentReferences (#766) ─────────────────────────────────────────

describe('neutralizeAgentReferences', () => {
  test('replaces standalone Claude with "the agent"', () => {
    const input = 'Claude handles these decisions. Claude should read the file.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(!result.includes('Claude handles'), 'standalone Claude replaced');
    assert.ok(result.includes('the agent handles'), 'replaced with "the agent"');
  });

  test('preserves Claude Code (product name)', () => {
    const input = 'This is a Claude Code bug. Use Claude Code settings.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('Claude Code bug'), 'Claude Code preserved');
    assert.ok(result.includes('Claude Code settings'), 'Claude Code preserved');
  });

  test('preserves Claude model names', () => {
    const input = 'Use Claude Opus for planning. Claude Sonnet for execution. Claude Haiku for research.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('Claude Opus'), 'Opus preserved');
    assert.ok(result.includes('Claude Sonnet'), 'Sonnet preserved');
    assert.ok(result.includes('Claude Haiku'), 'Haiku preserved');
  });

  test('replaces CLAUDE.md with runtime instruction file', () => {
    const input = 'Read CLAUDE.md for project instructions. Check ./CLAUDE.md if exists.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('AGENTS.md'), 'CLAUDE.md -> AGENTS.md');
    assert.ok(!result.includes('CLAUDE.md'), 'no CLAUDE.md remains');
  });

  test('uses different instruction file per runtime', () => {
    const input = 'Read CLAUDE.md for instructions.';
    assert.ok(neutralizeAgentReferences(input, 'GEMINI.md').includes('GEMINI.md'));
    assert.ok(neutralizeAgentReferences(input, 'copilot-instructions.md').includes('copilot-instructions.md'));
    assert.ok(neutralizeAgentReferences(input, 'AGENTS.md').includes('AGENTS.md'));
  });

  test('removes AGENTS.md load-blocking instruction', () => {
    const input = 'Do NOT load full `AGENTS.md` files — they contain agent definitions.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(!result.includes('Do NOT load full'), 'blocking instruction removed');
  });

  test('preserves claude- prefixes (CSS classes, package names)', () => {
    const input = 'The claude-ctx session and claude-code package.';
    const result = neutralizeAgentReferences(input, 'AGENTS.md');
    assert.ok(result.includes('claude-ctx'), 'claude- prefix preserved');
    assert.ok(result.includes('claude-code'), 'claude-code preserved');
  });
});
