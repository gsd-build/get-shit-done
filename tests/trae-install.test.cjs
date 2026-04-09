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
  convertClaudeToTraeMarkdown,
  convertClaudeCommandToTraeSkill,
  convertClaudeAgentToTraeAgent,
  copyCommandsAsTraeSkills,
  install,
  uninstall,
  writeManifest,
} = require('../bin/install.js');

describe('Trae runtime directory mapping', () => {
  test('maps Trae to .trae for local installs', () => {
    assert.strictEqual(getDirName('trae'), '.trae');
  });

  test('maps Trae to ~/.trae for global installs', () => {
    assert.strictEqual(getGlobalDir('trae'), path.join(os.homedir(), '.trae'));
  });

  test('returns .trae config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('trae', false), "'.trae'");
    assert.strictEqual(getConfigDirFromHome('trae', true), "'.trae'");
  });
});

describe('getGlobalDir (Trae)', () => {
  let originalTraeConfigDir;

  beforeEach(() => {
    originalTraeConfigDir = process.env.TRAE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalTraeConfigDir !== undefined) {
      process.env.TRAE_CONFIG_DIR = originalTraeConfigDir;
    } else {
      delete process.env.TRAE_CONFIG_DIR;
    }
  });

  test('returns ~/.trae with no env var or explicit dir', () => {
    delete process.env.TRAE_CONFIG_DIR;
    const result = getGlobalDir('trae');
    assert.strictEqual(result, path.join(os.homedir(), '.trae'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('trae', '/custom/trae-path');
    assert.strictEqual(result, '/custom/trae-path');
  });

  test('respects TRAE_CONFIG_DIR env var', () => {
    process.env.TRAE_CONFIG_DIR = '~/custom-trae';
    const result = getGlobalDir('trae');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-trae'));
  });

  test('explicit dir takes priority over TRAE_CONFIG_DIR', () => {
    process.env.TRAE_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('trae', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

describe('Trae markdown conversion', () => {
  test('converts Claude-specific references to Trae equivalents', () => {
    const input = [
      'Claude Code reads CLAUDE.md before using .claude/skills/.',
      'Run /gsd:plan-phase with $ARGUMENTS.',
      'Use Bash(command) and Edit(file).',
    ].join('\n');

    const result = convertClaudeToTraeMarkdown(input);

    assert.ok(result.includes('Trae reads .trae/rules/ before using .trae/skills/.'), result);
    assert.ok(result.includes('/gsd-plan-phase'), result);
    assert.ok(result.includes('{{GSD_ARGS}}'), result);
    assert.ok(result.includes('Shell('), result);
    assert.ok(result.includes('StrReplace('), result);
  });

  test('converts commands and agents to Trae frontmatter', () => {
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

    const convertedCommand = convertClaudeCommandToTraeSkill(command, 'gsd-new-project');
    const convertedAgent = convertClaudeAgentToTraeAgent(agent);

    assert.ok(convertedCommand.includes('name: gsd-new-project'), convertedCommand);
    assert.ok(!convertedCommand.includes('<trae_skill_adapter>'), convertedCommand);
    assert.ok(convertedCommand.includes('.trae/skills/'), convertedCommand);
    assert.ok(convertedCommand.includes('/gsd-help'), convertedCommand);

    assert.ok(convertedAgent.includes('name: gsd-planner'), convertedAgent);
    assert.ok(!convertedAgent.includes('color:'), convertedAgent);
    assert.ok(convertedAgent.includes('.trae/rules/'), convertedAgent);
  });
});

describe('copyCommandsAsTraeSkills', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-trae-copy-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates one skill directory per GSD command', () => {
    const srcDir = path.join(__dirname, '..', 'commands', 'gsd');
    const skillsDir = path.join(tmpDir, '.trae', 'skills');

    copyCommandsAsTraeSkills(srcDir, skillsDir, 'gsd', '$HOME/.trae/', 'trae');

    const generated = path.join(skillsDir, 'gsd-help', 'SKILL.md');
    assert.ok(fs.existsSync(generated), generated);

    const content = fs.readFileSync(generated, 'utf8');
    assert.ok(!content.includes('<trae_skill_adapter>'), content);
    assert.ok(content.includes('name: gsd-help'), content);
  });
});

describe('Trae local install/uninstall', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-trae-install-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('installs GSD into ./.trae and removes it cleanly', () => {
    const result = install(false, 'trae');
    const targetDir = path.join(tmpDir, '.trae');

    assert.deepStrictEqual(result, {
      settingsPath: null,
      settings: null,
      statuslineCommand: null,
      runtime: 'trae',
      configDir: fs.realpathSync(targetDir),
    });

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd-help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'trae');
    assert.ok(Object.keys(manifest.files).some(file => file.startsWith('skills/gsd-help/')), manifest);

    uninstall(false, 'trae');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')), 'Trae skill directory removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')), 'get-shit-done removed');
  });
});

describe('E2E: Trae uninstall skills cleanup', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-trae-uninstall-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('removes all gsd-* skill directories on --trae --uninstall', () => {
    const targetDir = path.join(tmpDir, '.trae');
    install(false, 'trae');

    const skillsDir = path.join(targetDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills dir exists after install');

    const installedSkills = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.ok(installedSkills.length > 0, `found ${installedSkills.length} gsd-* skill dirs before uninstall`);

    uninstall(false, 'trae');

    if (fs.existsSync(skillsDir)) {
      const remainingGsd = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(remainingGsd.length, 0,
        `Expected 0 gsd-* skill dirs after uninstall, found: ${remainingGsd.map(e => e.name).join(', ')}`);
    }
  });

  test('preserves non-GSD skill directories during --trae --uninstall', () => {
    const targetDir = path.join(tmpDir, '.trae');
    install(false, 'trae');

    const customSkillDir = path.join(targetDir, 'skills', 'my-custom-skill');
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# My Custom Skill\n');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')), 'custom skill exists before uninstall');

    uninstall(false, 'trae');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')),
      'Non-GSD skill directory should be preserved after Trae uninstall');
  });

  test('removes engine directory on --trae --uninstall', () => {
    const targetDir = path.join(tmpDir, '.trae');
    install(false, 'trae');

    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')),
      'engine exists before uninstall');

    uninstall(false, 'trae');

    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')),
      'get-shit-done engine should be removed after Trae uninstall');
  });
});
