/**
 * Grok Build frontmatter / command / agent conversion tests (Phase 2).
 *
 * Tests the three conversion functions + GROK_AGENT_SANDBOX + path/brand handling.
 */

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
  convertClaudeToGrokMarkdown,
  convertClaudeCommandToGrokSkill,
  convertClaudeAgentToGrokAgent,
  GROK_AGENT_SANDBOX,
} = require('../bin/install.js');

describe('Grok conversion (Phase 2)', () => {
  test('GROK_AGENT_SANDBOX has expected entries and defaults', () => {
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-planner'], 'workspace-write');
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-plan-checker'], 'read-only');
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-verifier'], 'read-only');
    // unknown falls back in converter
  });

  test('convertClaudeCommandToGrokSkill produces folded desc + metadata', () => {
    const source = `---
name: gsd:help
description: Show available GSD commands and usage guide
---
<body>`;
    const out = convertClaudeCommandToGrokSkill(source, 'gsd-help');
    assert.ok(out.includes('name: gsd-help'));
    assert.ok(out.includes('description: >'));
    assert.ok(out.includes('metadata:'));
    assert.ok(out.includes('short-description:'));
    assert.ok(out.includes('<body>'));
  });

  test('convertClaudeAgentToGrokAgent injects Grok fields and permission_mode', () => {
    const source = `---
name: gsd-planner
description: Create detailed plans
---
<role>You are a planner.</role>`;
    const out = convertClaudeAgentToGrokAgent(source);
    assert.ok(out.includes('name: gsd-planner'));
    assert.ok(out.includes('prompt_mode: full'));
    assert.ok(out.includes('permission_mode: workspace-write'));
    assert.ok(out.includes('agents_md: true'));
    assert.ok(out.includes('<role>You are a planner.</role>'));
  });

  test('convertClaudeToGrokMarkdown does brand + AGENTS.md replacement', () => {
    const source = 'Use Claude Code with CLAUDE.md in .claude/';
    const out = convertClaudeToGrokMarkdown(source);
    assert.ok(out.includes('Grok Build'));
    assert.ok(out.includes('AGENTS.md'));
    assert.ok(!out.includes('Claude Code'));
  });

  test('core skills + representative agents convert without error', () => {
    // representative
    const help = convertClaudeCommandToGrokSkill('---\nname: gsd:help\ndescription: h\n---', 'gsd-help');
    assert.ok(help.includes('gsd-help'));
    const plannerAgent = convertClaudeAgentToGrokAgent('---\nname: gsd-planner\ndescription: p\n---');
    assert.ok(plannerAgent.includes('permission_mode'));
  });
});
