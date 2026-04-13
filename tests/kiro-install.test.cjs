process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createTempDir, cleanup } = require('./helpers.cjs');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  convertClaudeToKiroMarkdown,
  convertClaudeCommandToKiroSkill,
  convertClaudeAgentToKiroAgent,
  copyCommandsAsKiroSkills,
  install,
  uninstall,
  writeManifest,
} = require('../bin/install.js');

describe('Kiro runtime directory mapping', () => {
  test('maps Kiro to .kiro for local installs', () => {
    assert.strictEqual(getDirName('kiro'), '.kiro');
  });

  test('maps Kiro to ~/.kiro for global installs', () => {
    assert.strictEqual(getGlobalDir('kiro'), path.join(os.homedir(), '.kiro'));
  });

  test('returns .kiro config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('kiro', false), "'.kiro'");
    assert.strictEqual(getConfigDirFromHome('kiro', true), "'.kiro'");
  });
});

describe('getGlobalDir (Kiro)', () => {
  let originalKiroConfigDir;

  beforeEach(() => {
    originalKiroConfigDir = process.env.KIRO_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalKiroConfigDir !== undefined) {
      process.env.KIRO_CONFIG_DIR = originalKiroConfigDir;
    } else {
      delete process.env.KIRO_CONFIG_DIR;
    }
  });

  test('returns ~/.kiro with no env var or explicit dir', () => {
    delete process.env.KIRO_CONFIG_DIR;
    const result = getGlobalDir('kiro');
    assert.strictEqual(result, path.join(os.homedir(), '.kiro'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('kiro', '/custom/kiro-path');
    assert.strictEqual(result, '/custom/kiro-path');
  });

  test('respects KIRO_CONFIG_DIR env var', () => {
    process.env.KIRO_CONFIG_DIR = '~/custom-kiro';
    const result = getGlobalDir('kiro');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-kiro'));
  });

  test('explicit dir takes priority over KIRO_CONFIG_DIR', () => {
    process.env.KIRO_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('kiro', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

describe('Kiro markdown conversion', () => {
  test('converts Claude-specific references to Kiro equivalents', () => {
    const input = [
      'Claude Code reads CLAUDE.md before using .claude/skills/.',
      'Run /gsd:plan-phase with $ARGUMENTS.',
      'Use Bash(command) and Edit(file).',
    ].join('\n');

    const result = convertClaudeToKiroMarkdown(input);

    assert.ok(result.includes('.kiro/steering/'), result);
    assert.ok(result.includes('.kiro/skills/'), result);
    assert.ok(result.includes('/gsd-plan-phase'), result);
    assert.ok(result.includes('{{GSD_ARGS}}'), result);
    assert.ok(result.includes('shell('), result);
    assert.ok(result.includes('write('), result);
    assert.ok(result.includes('Kiro reads'), result);
  });

  test('converts commands and agents to Kiro frontmatter', () => {
    const command = `---
name: gsd:new-project
description: Initialize a project
---

Use .claude/skills/ and /gsd:help.
`;
    const agent = `---
name: gsd-planner
description: Planner agent
tools: Read, Write
color: blue
---

Read CLAUDE.md before acting.
`;

    const convertedCommand = convertClaudeCommandToKiroSkill(command, 'gsd-new-project');
    const convertedAgent = convertClaudeAgentToKiroAgent(agent);

    assert.ok(convertedCommand.includes('name: gsd-new-project'), convertedCommand);
    assert.ok(convertedCommand.includes('.kiro/skills/'), convertedCommand);
    assert.ok(convertedCommand.includes('/gsd-help'), convertedCommand);
    assert.ok(convertedCommand.includes('kiro_skill_adapter'), convertedCommand);

    assert.ok(convertedAgent.includes('name: gsd-planner'), convertedAgent);
    assert.ok(!convertedAgent.includes('color:'), convertedAgent);
    assert.ok(convertedAgent.includes('.kiro/steering/'), convertedAgent);
  });
});

describe('copyCommandsAsKiroSkills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-kiro-copy-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates one skill directory per GSD command', () => {
    const srcDir = path.join(__dirname, '..', 'commands', 'gsd');
    const skillsDir = path.join(tmpDir, '.kiro', 'skills');

    copyCommandsAsKiroSkills(srcDir, skillsDir, 'gsd', '$HOME/.kiro/', 'kiro');

    const generated = path.join(skillsDir, 'gsd-help', 'SKILL.md');
    assert.ok(fs.existsSync(generated), generated);

    const content = fs.readFileSync(generated, 'utf8');
    assert.ok(content.includes('name: gsd-help'), content);
  });
});

describe('Kiro local install/uninstall', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-kiro-install-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('installs GSD into ./.kiro and removes it cleanly', () => {
    const result = install(false, 'kiro');
    const targetDir = path.join(tmpDir, '.kiro');

    assert.strictEqual(result.runtime, 'kiro');

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd-help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'kiro');
    assert.ok(Object.keys(manifest.files).some(file => file.startsWith('skills/gsd-help/')), JSON.stringify(manifest));

    uninstall(false, 'kiro');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')), 'Kiro skill directory removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')), 'get-shit-done removed');
  });
});

describe('E2E: Kiro uninstall skills cleanup', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-kiro-uninstall-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('removes all gsd-* skill directories on --kiro --uninstall', () => {
    const targetDir = path.join(tmpDir, '.kiro');
    install(false, 'kiro');

    const skillsDir = path.join(targetDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills dir exists after install');

    const installedSkills = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.ok(installedSkills.length > 0, `found ${installedSkills.length} gsd-* skill dirs before uninstall`);

    uninstall(false, 'kiro');

    if (fs.existsSync(skillsDir)) {
      const remainingGsd = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(remainingGsd.length, 0,
        `Expected 0 gsd-* skill dirs after uninstall, found: ${remainingGsd.map(e => e.name).join(', ')}`);
    }
  });

  test('preserves non-GSD skill directories during --kiro --uninstall', () => {
    const targetDir = path.join(tmpDir, '.kiro');
    install(false, 'kiro');

    const customSkillDir = path.join(targetDir, 'skills', 'my-custom-skill');
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# My Custom Skill\n');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')), 'custom skill exists before uninstall');

    uninstall(false, 'kiro');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')),
      'Non-GSD skill directory should be preserved after Kiro uninstall');
  });

  test('removes engine directory on --kiro --uninstall', () => {
    const targetDir = path.join(tmpDir, '.kiro');
    install(false, 'kiro');

    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')),
      'engine exists before uninstall');

    uninstall(false, 'kiro');

    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')),
      'get-shit-done engine should be removed after Kiro uninstall');
  });
});
