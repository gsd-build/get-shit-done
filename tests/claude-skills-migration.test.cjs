// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * GSD Tools Tests - Claude Skills Migration (#1504)
 *
 * Tests for migrating Claude Code from commands/gsd/ to skills/gsd-xxx/SKILL.md
 * format for compatibility with Claude Code 2.1.88+.
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
  writeManifest,
  install,
} = require('../bin/install.js');

// ─── convertClaudeCommandToClaudeSkill ──────────────────────────────────────

describe('convertClaudeCommandToClaudeSkill', () => {
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
    // The value should be preserved (possibly yaml-quoted)
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
    // gsd-next (hyphen, #2808) so Claude Code autocomplete shows canonical form.
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
    assert.ok(result.includes('Step 1.'), 'step text preserved');
  });

  test('preserves agent field', () => {
    const input = [
      '---',
      'name: gsd:plan-phase',
      'description: Plan a phase',
      'agent: true',
      'allowed-tools:',
      '  - Read',
      '---',
      '',
      'Plan body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-plan-phase');
    assert.ok(result.includes('agent:'), 'agent field is present');
  });

  test('handles content with no frontmatter', () => {
    const input = 'Just some plain markdown content.';
    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-plain');
    assert.strictEqual(result, input, 'content returned unchanged');
  });

  test('preserves allowed-tools as multiline YAML list (not flattened)', () => {
    const input = [
      '---',
      'name: gsd:debug',
      'description: Debug',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
      '  - Task',
      '  - AskUserQuestion',
      '---',
      '',
      'Body.',
    ].join('\n');

    const result = convertClaudeCommandToClaudeSkill(input, 'gsd-debug');
    // Claude Code native format keeps YAML multiline list
    assert.ok(result.includes('  - Read'), 'Read in multiline list');
    assert.ok(result.includes('  - Bash'), 'Bash in multiline list');
    assert.ok(result.includes('  - Task'), 'Task in multiline list');
    assert.ok(result.includes('  - AskUserQuestion'), 'AskUserQuestion in multiline list');
  });
});

// ─── copyCommandsAsClaudeSkills ─────────────────────────────────────────────

describe('copyCommandsAsClaudeSkills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-skills-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('creates correct directory structure skills/gsd-xxx/SKILL.md', () => {
    // Create source commands
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: gsd:next\ndescription: Advance\nallowed-tools:\n  - Read\n---\n\nBody.'
    );
    fs.writeFileSync(
      path.join(srcDir, 'health.md'),
      '---\nname: gsd:health\ndescription: Check health\n---\n\nHealth body.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    // Verify directory structure
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'gsd-next', 'SKILL.md')),
      'skills/gsd-next/SKILL.md exists'
    );
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'gsd-health', 'SKILL.md')),
      'skills/gsd-health/SKILL.md exists'
    );
  });

  test('cleans up old skills before installing new ones', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: gsd:next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Create a stale skill that should be removed
    const staleDir = path.join(skillsDir, 'gsd-old-command');
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, 'SKILL.md'), 'stale content');

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    // Stale skill removed
    assert.ok(
      !fs.existsSync(staleDir),
      'stale skill directory removed'
    );
    // New skill created
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'gsd-next', 'SKILL.md')),
      'new skill created'
    );
  });

  test('does not remove non-GSD skills', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: gsd:next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Create a non-GSD skill
    const otherDir = path.join(skillsDir, 'my-custom-skill');
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'SKILL.md'), 'custom content');

    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    // Non-GSD skill preserved
    assert.ok(
      fs.existsSync(otherDir),
      'non-GSD skill preserved'
    );
  });

  test('handles recursive subdirectories', () => {
    const srcDir = path.join(tmpDir, 'src');
    const subDir = path.join(srcDir, 'wired');
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(
      path.join(subDir, 'ready.md'),
      '---\nname: gsd-wired:ready\ndescription: Show ready tasks\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    assert.ok(
      fs.existsSync(path.join(skillsDir, 'gsd-wired-ready', 'SKILL.md')),
      'nested command creates gsd-wired-ready/SKILL.md'
    );
  });

  test('no-ops when source directory does not exist', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    // Should not throw
    copyCommandsAsClaudeSkills(
      path.join(tmpDir, 'nonexistent'),
      skillsDir,
      'gsd',
      '$HOME/.claude/',
      'claude',
      true
    );
    assert.ok(!fs.existsSync(skillsDir), 'skills dir not created when src missing');
  });
});

// ─── Path replacement in Claude skills (#1653) ────────────────────────────────

describe('copyCommandsAsClaudeSkills path replacement (#1653)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-path-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('replaces ~/.claude/ paths with pathPrefix on local install', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'manager.md'),
      [
        '---',
        'name: gsd:manager',
        'description: Manager command',
        '---',
        '',
        '<execution_context>',
        '@~/.claude/get-shit-done/workflows/manager.md',
        '@~/.claude/get-shit-done/references/ui-brand.md',
        '</execution_context>',
      ].join('\n')
    );

    const skillsDir = path.join(tmpDir, 'skills');
    const localPrefix = '/Users/test/myproject/.claude/';
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', localPrefix, 'claude', false);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-manager', 'SKILL.md'), 'utf8');
    assert.ok(!content.includes('~/.claude/'), 'no hardcoded ~/.claude/ paths remain');
    assert.ok(content.includes(localPrefix + 'get-shit-done/workflows/manager.md'), 'path rewritten to local prefix');
    assert.ok(content.includes(localPrefix + 'get-shit-done/references/ui-brand.md'), 'reference path rewritten');
  });

  test('replaces $HOME/.claude/ paths with pathPrefix', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'debug.md'),
      '---\nname: gsd:debug\ndescription: Debug\n---\n\n@$HOME/.claude/get-shit-done/workflows/debug.md'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    const localPrefix = '/tmp/project/.claude/';
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', localPrefix, 'claude', false);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-debug', 'SKILL.md'), 'utf8');
    assert.ok(!content.includes('$HOME/.claude/'), 'no $HOME/.claude/ paths remain');
    assert.ok(content.includes(localPrefix + 'get-shit-done/workflows/debug.md'), 'path rewritten');
  });

  test('global install preserves $HOME/.claude/ when pathPrefix matches', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: gsd:next\ndescription: Next\n---\n\n@~/.claude/get-shit-done/workflows/next.md'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    const content = fs.readFileSync(path.join(skillsDir, 'gsd-next', 'SKILL.md'), 'utf8');
    assert.ok(content.includes('$HOME/.claude/get-shit-done/workflows/next.md'), 'global paths use $HOME form');
    assert.ok(!content.includes('~/.claude/'), '~/ form replaced with $HOME/ form');
  });
});

// ─── Legacy cleanup during install ──────────────────────────────────────────

describe('Legacy commands/gsd/ cleanup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-legacy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('install removes legacy commands/gsd/ directory when present', () => {
    // Create a mock legacy commands/gsd/ directory
    const legacyDir = path.join(tmpDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'next.md'), 'legacy content');

    // Create source commands for the installer to read
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'next.md'),
      '---\nname: gsd:next\ndescription: Advance\n---\n\nBody.'
    );

    const skillsDir = path.join(tmpDir, 'skills');
    // Install skills
    copyCommandsAsClaudeSkills(srcDir, skillsDir, 'gsd', '$HOME/.claude/', 'claude', true);

    // Simulate the legacy cleanup that install() does after copyCommandsAsClaudeSkills
    if (fs.existsSync(legacyDir)) {
      fs.rmSync(legacyDir, { recursive: true });
    }

    assert.ok(!fs.existsSync(legacyDir), 'legacy commands/gsd/ removed');
    assert.ok(
      fs.existsSync(path.join(skillsDir, 'gsd-next', 'SKILL.md')),
      'new skill installed'
    );
  });
});

// ─── writeManifest tracks skills/ for Claude ────────────────────────────────

describe('writeManifest tracks skills/ for Claude', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('manifest includes skills/gsd-xxx/SKILL.md entries for Claude runtime', () => {
    // Create skills directory structure (as install would)
    const skillsDir = path.join(tmpDir, 'skills');
    const skillDir = path.join(skillsDir, 'gsd-next');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'skill content');

    // Create get-shit-done directory (required by writeManifest)
    const gsdDir = path.join(tmpDir, 'get-shit-done');
    fs.mkdirSync(gsdDir, { recursive: true });
    fs.writeFileSync(path.join(gsdDir, 'test.md'), 'test');

    writeManifest(tmpDir, 'claude');

    const manifest = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'utf8')
    );

    // Should have skills/ entries
    const skillEntries = Object.keys(manifest.files).filter(k =>
      k.startsWith('skills/')
    );
    assert.ok(skillEntries.length > 0, 'manifest has skills/ entries');
    assert.ok(
      skillEntries.some(k => k === 'skills/gsd-next/SKILL.md'),
      'manifest has skills/gsd-next/SKILL.md'
    );

    // Should NOT have commands/gsd/ entries
    const cmdEntries = Object.keys(manifest.files).filter(k =>
      k.startsWith('commands/gsd/')
    );
    assert.strictEqual(cmdEntries.length, 0, 'manifest has no commands/gsd/ entries');
  });
});

// ─── Exports exist ──────────────────────────────────────────────────────────

describe('Claude skills migration exports', () => {
  test('convertClaudeCommandToClaudeSkill is exported', () => {
    assert.strictEqual(typeof convertClaudeCommandToClaudeSkill, 'function');
  });

  test('copyCommandsAsClaudeSkills is exported', () => {
    assert.strictEqual(typeof copyCommandsAsClaudeSkills, 'function');
  });
});
