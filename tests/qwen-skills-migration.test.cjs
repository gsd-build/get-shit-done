/**
 * GSD Tools Tests - Qwen Code Skills Migration
 *
 * Tests for installing GSD for Qwen Code using the standard
 * skills/gsd-xxx/SKILL.md format (same open standard as Claude Code 2.1.88+).
 *
 * Uses node:test and node:assert (NOT Jest).
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');

const {
  convertClaudeCommandToClaudeSkill,
  copyCommandsAsClaudeSkills,
} = require('../bin/install.js');

// ─── convertClaudeCommandToClaudeSkill (used by Qwen via copyCommandsAsClaudeSkills) ──

describe('Qwen Code: convertClaudeCommandToClaudeSkill', () => {
  test('preserves allowed-tools multiline YAML list', () => {
    const input = [
      '---',
      'name: gsd:next',
      'description: Advance to the next step',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '  - Grep',
      '---',
      '',
      'Body content here.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-next');
    assert.ok(result.includes('allowed-tools:'), 'allowed-tools field is present');
    assert.ok(result.includes('Read'), 'Read tool preserved');
    assert.ok(result.includes('Bash'), 'Bash tool preserved');
    assert.ok(result.includes('Grep'), 'Grep tool preserved');
  });

  test('preserves argument-hint', () => {
    const input = [
      '---',
      'name: gsd:debug',
      'description: Debug issues',
      'argument-hint: "[issue description]"',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '---',
      '',
      'Debug body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-debug');
    assert.ok(result.includes('argument-hint:'), 'argument-hint field is present');
    assert.ok(
      result.includes('[issue description]'),
      'argument-hint value preserved'
    );
  });

  test('emits hyphen-form name (gsd-<cmd>) from hyphen-form dir (#2808)', () => {
    const input = [
      '---',
      'name: gsd:next',
      'description: Advance workflow',
      '---',
      '',
      'Body.',
    ].join('\n');

    // Directory name is gsd-next (hyphen, Windows-safe), frontmatter name is
    // gsd-next (hyphen, #2808 — canonical invocation form for Claude Code autocomplete).
    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-next');
    assert.ok(result.includes('name: gsd-next'), 'frontmatter name uses hyphen form (#2808)');
  });

  test('preserves body content unchanged', () => {
    const body = '\n<objective>\nDo the thing.\n</objective>\n\n<process>\nStep 1.\nStep 2.\n</process>\n';
    const input = [
      '---',
      'name: gsd:test',
      'description: Test command',
      '---',
      body,
    ].join('');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-test');
    assert.ok(result.includes('<objective>'), 'objective tag preserved');
    assert.ok(result.includes('Do the thing.'), 'body text preserved');
    assert.ok(result.includes('<process>'), 'process tag preserved');
  });

  test('produces valid SKILL.md frontmatter starting with ---', () => {
    const input = [
      '---',
      'name: gsd:plan',
      'description: Plan a phase',
      '---',
      '',
      'Plan body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-plan');
    assert.ok(result.startsWith('---\n'), 'frontmatter starts with ---');
    assert.ok(result.includes('\n---\n'), 'frontmatter closes with ---');
  });
});

// ─── copyCommandsAsClaudeSkills (used for Qwen skills install) ─────────────

describe('Qwen Code: copyCommandsAsClaudeSkills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-qwen-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  test('creates skills/gsd-xxx/SKILL.md directory structure', () => {
    // Create source command files
    const srcDir = path.join(tmpDir, 'src', 'commands', 'gsd');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'quick.md'), [
      '---',
      'name: gsd:quick',
      'description: Execute a quick task',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '---',
      '',
      '<objective>Quick task body</objective>',
    ].join('\n'));

    const skillsDir = path.join(tmpDir, 'dest', 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '/test/prefix/', 'qwen', false);

    // Verify SKILL.md was created
    const skillPath = path.join(skillsDir, 'gsd-quick', 'SKILL.md');
    assert.ok(fs.existsSync(skillPath), 'gsd-quick/SKILL.md exists');

    // Verify content
    const content = fs.readFileSync(skillPath, 'utf8');
    assert.ok(content.includes('name: gsd-quick'), 'frontmatter name uses hyphen form (#2808)');
    assert.ok(content.includes('description:'), 'description present');
    assert.ok(content.includes('allowed-tools:'), 'allowed-tools preserved');
    assert.ok(content.includes('<objective>'), 'body content preserved');
  });

  test('replaces ~/.claude/ paths with pathPrefix', () => {
    const srcDir = path.join(tmpDir, 'src', 'commands', 'gsd');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'next.md'), [
      '---',
      'name: gsd:next',
      'description: Next step',
      '---',
      '',
      'Reference: @~/.claude/get-shit-done/workflows/next.md',
    ].join('\n'));

    const skillsDir = path.join(tmpDir, 'dest', 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.qwen/', 'qwen', false);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-next', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('$HOME/.qwen/'), 'path replaced to .qwen/');
    assert.ok(!content.includes('~/.claude/'), 'old claude path removed');
  });

  test('replaces $HOME/.claude/ paths with pathPrefix', () => {
    const srcDir = path.join(tmpDir, 'src', 'commands', 'gsd');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'plan.md'), [
      '---',
      'name: gsd:plan',
      'description: Plan phase',
      '---',
      '',
      'Reference: $HOME/.claude/get-shit-done/workflows/plan.md',
    ].join('\n'));

    const skillsDir = path.join(tmpDir, 'dest', 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.qwen/', 'qwen', false);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-plan', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('$HOME/.qwen/'), 'path replaced to .qwen/');
    assert.ok(!content.includes('$HOME/.claude/'), 'old claude path removed');
  });

  test('removes stale gsd- skills before installing new ones', () => {
    const srcDir = path.join(tmpDir, 'src', 'commands', 'gsd');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'quick.md'), [
      '---',
      'name: gsd:quick',
      'description: Quick task',
      '---',
      '',
      'Body',
    ].join('\n'));

    const skillsDir = path.join(tmpDir, 'dest', 'skills');
    // Pre-create a stale skill
    fs.mkdirSync(path.join(skillsDir, 'gsd-old-skill'), { recursive: true });
    fs.writeFileSync(path.join(skillsDir, 'gsd-old-skill', 'SKILL.md'), 'old');

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '/test/', 'qwen', false);

    assert.ok(!fs.existsSync(path.join(skillsDir, 'gsd-old-skill')), 'stale skill removed');
    assert.ok(fs.existsSync(path.join(skillsDir, 'gsd-quick', 'SKILL.md')), 'new skill installed');
  });

  test('preserves agent field in frontmatter', () => {
    const srcDir = path.join(tmpDir, 'src', 'commands', 'gsd');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'execute.md'), [
      '---',
      'name: gsd:execute',
      'description: Execute phase',
      'agent: gsd-executor',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '  - Task',
      '---',
      '',
      'Execute body',
    ].join('\n'));

    const skillsDir = path.join(tmpDir, 'dest', 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '/test/', 'qwen', false);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-execute', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('agent: gsd-executor'), 'agent field preserved');
  });
});

// ─── Integration: SKILL.md format validation ────────────────────────────────

describe('Qwen Code: SKILL.md format validation', () => {
  test('SKILL.md frontmatter is valid YAML structure', () => {
    const input = [
      '---',
      'name: gsd:review',
      'description: Code review with quality checks',
      'argument-hint: "[PR number or branch]"',
      'agent: gsd-code-reviewer',
      'allowed-tools:',
      '  - Read',
      '  - Grep',
      '  - Bash',
      '---',
      '',
      '<objective>Review code</objective>',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-review');

    // Parse the frontmatter
    const fmMatch = result.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(fmMatch, 'has frontmatter block');

    const fmLines = fmMatch[1].split('\n');
    const hasName = fmLines.some(l => l.startsWith('name: gsd-review'));
    const hasDesc = fmLines.some(l => l.startsWith('description:'));
    const hasAgent = fmLines.some(l => l.startsWith('agent:'));
    const hasTools = fmLines.some(l => l.startsWith('allowed-tools:'));

    assert.ok(hasName, 'name field correct');
    assert.ok(hasDesc, 'description field present');
    assert.ok(hasAgent, 'agent field present');
    assert.ok(hasTools, 'allowed-tools field present');
  });
});
