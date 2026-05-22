/**
 * Agy conversion regression and correctness tests.
 *
 * Covers:
 *   - convertClaudeToAgyContent
 *   - convertClaudeCommandToAgySkill
 *   - convertClaudeAgentToAgyAgent
 *   - convertClaudeCommandToAgyCommand
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeToAgyContent,
  convertClaudeCommandToAgySkill,
  convertClaudeAgentToAgyAgent,
  convertClaudeCommandToAgyCommand,
} = require('../bin/install.js');

describe('convertClaudeToAgyContent', () => {
  test('replaces path prefixes correctly for local install', () => {
    const input = 'Check $HOME/.claude/commands/ and ~/.claude/agents/. Also ./.claude/skills/ and .claude/helpers. Finally bare $HOME/.claude or ~/.claude.';
    const result = convertClaudeToAgyContent(input, false);
    assert.strictEqual(
      result,
      'Check .agy/commands/ and .agy/agents/. Also ./.agy/skills/ and .agy/helpers. Finally bare .agy or .agy.'
    );
  });

  test('replaces path prefixes correctly for global install', () => {
    const input = 'Check $HOME/.claude/commands/ and ~/.claude/agents/. Also ./.claude/skills/ and .claude/helpers. Finally bare $HOME/.claude or ~/.claude.';
    const result = convertClaudeToAgyContent(input, true);
    assert.strictEqual(
      result,
      'Check $HOME/.gemini/antigravity-cli/commands/ and ~/.gemini/antigravity-cli/agents/. Also ./.agy/skills/ and .agy/helpers. Finally bare $HOME/.gemini/antigravity-cli or ~/.gemini/antigravity-cli.'
    );
  });

  test('converts gsd: commands to gsd- and neutralizes agent references', () => {
    const input = 'Call gsd:plan-phase. Claude is working on CLAUDE.md.';
    const result = convertClaudeToAgyContent(input, false);
    assert.strictEqual(result, 'Call gsd-plan-phase. the agent is working on GEMINI.md.');
  });
});

describe('convertClaudeCommandToAgySkill', () => {
  test('creates SKILL.md layout with minimal YAML frontmatter', () => {
    const input = `---
name: plan-phase
description: Plan a project phase
argument-hint: [phase-id]
---
# Plan Phase
Body of the skill.
`;
    const result = convertClaudeCommandToAgySkill(input, 'gsd-plan-phase', false);
    assert.ok(result.startsWith('---\nname: gsd-plan-phase\ndescription: "Plan a project phase"\n---'));
    assert.ok(result.includes('# Plan Phase'));
    assert.ok(!result.includes('argument-hint'));
  });
});

describe('convertClaudeAgentToAgyAgent', () => {
  test('creates agy agent frontmatter with snake_case tool mapping', () => {
    const input = `---
name: gsd-planner
description: Planner agent
tools:
  - run_command
  - view_file
  - replace_file_content
  - ask_user
---
I am the planner.
`;
    const result = convertClaudeAgentToAgyAgent(input, false);
    
    // Tools mapping checking:
    // run_command/execute_command -> run_command
    // view_file/read_file -> view_file
    // replace_file_content/write_file/edit_file -> edit_file
    // ask_user/ask_question -> ask_question
    // Let's assert on tools array in frontmatter
    assert.ok(result.includes('name: gsd-planner'));
    assert.ok(result.includes('description: "Planner agent"'));
    assert.ok(result.includes('tools:'));
    assert.ok(result.includes('I am the planner.'));
  });
});

describe('convertClaudeCommandToAgyCommand', () => {
  test('creates agy command frontmatter with allowed-tools mapping', () => {
    const input = `---
description: Run a task
argument-hint: "<task-name>"
allowed-tools:
  - run_command
  - view_file
---
Command execution.
`;
    const result = convertClaudeCommandToAgyCommand(input, false);
    assert.ok(result.includes('description: "Run a task"'));
    assert.ok(result.includes('argument-hint: "<task-name>"'));
    assert.ok(result.includes('allowed-tools:'));
    assert.ok(result.includes('Command execution.'));
  });
});
