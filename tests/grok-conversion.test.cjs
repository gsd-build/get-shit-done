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

  test('convertClaudeCommandToGrokSkill produces folded description and metadata fields', () => {
    const source = '---\nname: gsd:help\ndescription: Show available GSD commands and usage guide\n---\n<body>';
    const out = convertClaudeCommandToGrokSkill(source, 'gsd-help');
    assert.ok(out.includes('name: gsd-help'));
    assert.ok(out.includes('description: >'));
    assert.ok(out.includes('metadata:'));
    assert.ok(out.includes('short-description:'));
    assert.ok(out.includes('<body>'));
  });

  test('GROK_AGENT_SANDBOX maps representative agents to correct permission modes', () => {
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-planner'], 'workspace-write');
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-executor'], 'workspace-write');
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-verifier'], 'read-only');
    assert.strictEqual(GROK_AGENT_SANDBOX['gsd-plan-checker'], 'read-only');
    // unknown agent falls back to workspace-write inside converter
    const unknown = convertClaudeAgentToGrokAgent('---\nname: gsd-foo\ndescription: x\n---');
    assert.ok(unknown.includes('permission_mode: workspace-write'));
  });

  test('convertClaudeAgentToGrokAgent injects full Grok frontmatter for multiple agents', () => {
    const agents = ['gsd-planner', 'gsd-verifier', 'gsd-debugger', 'gsd-code-reviewer', 'gsd-executor'];
    for (const name of agents) {
      const src = `---\nname: ${name}\ndescription: test\n---\n<role>...</role>`;
      const out = convertClaudeAgentToGrokAgent(src);
      assert.ok(out.includes(`name: ${name}`), `missing name for ${name}`);
      assert.ok(out.includes('prompt_mode: full'));
      assert.ok(out.includes('permission_mode:'));
      assert.ok(out.includes('agents_md: true'));
      assert.ok(out.includes('model: inherit'));
    }
  });

  test('path rewriting simulation: ~/.claude/get-shit-done becomes ~/.grok/get-shit-done', () => {
    // The actual rewrite happens in copy* before convert; simulate the replace + convert
    let content = 'See ~/.claude/get-shit-done/workflows/ and $HOME/.claude/get-shit-done/';
    content = content.replace(/~\/\.claude\/get-shit-done\//g, '~/.grok/get-shit-done/');
    content = content.replace(/\$HOME\/\.claude\/get-shit-done\//g, '~/.grok/get-shit-done/');
    const out = convertClaudeToGrokMarkdown(content);
    assert.ok(out.includes('~/.grok/get-shit-done/'));
    assert.ok(!out.includes('~/.claude/get-shit-done/'));
  });

  test('round-trip safety: already-Grok content is idempotent under convert', () => {
    // Start with Claude phrase so brand swap applies on first pass
    const mixed = '---\nname: gsd-foo\ndescription: >\n  bar\nprompt_mode: full\npermission_mode: read-only\nagents_md: true\n---\n<body>Use Claude Code with CLAUDE.md</body>';
    const once = convertClaudeToGrokMarkdown(mixed);
    assert.ok(once.includes('Grok Build') && once.includes('AGENTS.md'), 'first convert applies brand + AGENTS.md');
    const twice = convertClaudeToGrokMarkdown(once);
    assert.strictEqual(twice, once, 'Grok-native content should be stable under re-conversion');
  });

  test('convertClaudeCommandToGrokSkill handles 5+ representative core skills', () => {
    const skills = ['gsd-help', 'gsd-new-project', 'gsd-discuss-phase', 'gsd-plan-phase', 'gsd-execute-phase'];
    for (const s of skills) {
      const src = `---\nname: ${s}\ndescription: Core GSD ${s}\n---`;
      const out = convertClaudeCommandToGrokSkill(src, s);
      assert.ok(out.includes(`name: ${s}`));
      assert.ok(out.includes('description: >'));
      assert.ok(out.includes('metadata:'));
    }
  });
});
