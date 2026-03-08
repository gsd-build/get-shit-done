/**
 * OpenCode Agent Frontmatter Conversion Tests
 *
 * Validates that convertClaudeToOpencodeFrontmatter correctly converts
 * agent frontmatter for OpenCode compatibility when isAgent: true.
 *
 * Bug: Without isAgent flag, the function strips name: (agents need it),
 * keeps color:/skills:/tools: record (should strip), and doesn't add
 * model: inherit / mode: subagent (required by OpenCode agents).
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

process.env.GSD_TEST_MODE = '1';
const { convertClaudeToOpencodeFrontmatter } = require('../bin/install.js');

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

  test('adds model: inherit', () => {
    const result = convertClaudeToOpencodeFrontmatter(SAMPLE_AGENT, { isAgent: true });
    const frontmatter = result.split('---')[1];
    assert.ok(frontmatter.includes('model: inherit'), 'model: inherit should be added');
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
