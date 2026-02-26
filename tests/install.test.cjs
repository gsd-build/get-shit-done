/**
 * Installer Tests (skills-only + verify/repair + migration)
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runInstaller, cleanup } = require('./helpers.cjs');

const REPO_ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands', 'gsd');

function expectedCommandCount() {
  return fs.readdirSync(COMMANDS_DIR).filter((entry) => entry.endsWith('.md')).length;
}

function listPromptFiles(tmpDir) {
  const promptsDir = path.join(tmpDir, 'prompts');
  if (!fs.existsSync(promptsDir)) return [];
  return fs.readdirSync(promptsDir).filter((entry) => /^gsd-.*\.md$/i.test(entry));
}

function listSkillDirs(tmpDir) {
  const skillsDir = path.join(tmpDir, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('gsd-'))
    .filter((entry) => fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')))
    .map((entry) => entry.name);
}

function readAgents(tmpDir) {
  return fs.readFileSync(path.join(tmpDir, 'AGENTS.md'), 'utf8');
}

describe('installer skills mode', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-install-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('installs native skills and verifies cleanly', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills count should match source commands');
    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'prompts should not be installed');
    assert.ok(fs.existsSync(path.join(tmpDir, 'AGENTS.md')), 'AGENTS.md should be installed');
    const agents = readAgents(tmpDir);
    assert.match(agents, /\$gsd-new-project/, 'AGENTS should reference $ commands');
    assert.doesNotMatch(agents, /\/prompts:gsd-new-project/, 'AGENTS should not reference prompt aliases');

    const verify = runInstaller('--verify --local', tmpDir);
    assert.ok(verify.success, `Verify failed: ${verify.error}`);
    assert.match(verify.output, /Integrity check passed\./, 'verify output should indicate success');
  });

  test('verify fails on drift and --repair restores missing artifacts', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    fs.rmSync(path.join(tmpDir, 'skills', 'gsd-help'), { recursive: true, force: true });
    const failedVerify = runInstaller('--verify --local', tmpDir);
    assert.ok(!failedVerify.success, 'verify should fail after deleting a skill');
    assert.match(failedVerify.output, /Integrity check failed\./, 'verify output should indicate failure');

    const repaired = runInstaller('--verify --repair --local --migrate', tmpDir);
    assert.ok(repaired.success, `Repair failed: ${repaired.error}`);
    assert.match(repaired.output, /Integrity check passed\./, 'repair should end in healthy verification');

    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be restored after repair');
  });

  test('detects legacy prompts and keeps them without --migrate', () => {
    const expected = expectedCommandCount();
    // Simulate legacy prompts install
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    for (let i = 0; i < expected; i++) {
      fs.writeFileSync(path.join(promptsDir, `gsd-cmd-${i}.md`), '# legacy prompt', 'utf8');
    }

    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);
    assert.match(install.output, /Migration detected:/, 'install should report detected migration');
    assert.match(install.output, /Skipping migration in non-interactive mode\./, 'install should skip without explicit consent');
    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'legacy prompts should remain without migration approval');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be installed');
  });

  test('applies migration cleanup when --migrate is provided', () => {
    const expected = expectedCommandCount();
    // Simulate legacy prompts install
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    for (let i = 0; i < expected; i++) {
      fs.writeFileSync(path.join(promptsDir, `gsd-cmd-${i}.md`), '# legacy prompt', 'utf8');
    }

    const migratedInstall = runInstaller('--local --migrate', tmpDir);
    assert.ok(migratedInstall.success, `Migrated install failed: ${migratedInstall.error}`);
    assert.match(migratedInstall.output, /Migration approved by --migrate/, 'install should acknowledge explicit migration approval');
    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'legacy prompts should be removed with --migrate');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be present after migration');
  });

  test('verify warns about legacy prompts', () => {
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    // Add legacy prompts after install
    const promptsDir = path.join(tmpDir, 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'gsd-help.md'), '# legacy', 'utf8');

    const verify = runInstaller('--verify --local', tmpDir);
    assert.ok(!verify.success, 'verify should fail with legacy prompts');
    assert.match(verify.output, /Legacy prompts/, 'verify should detect legacy prompts');
  });
});

const AGENTS_DIR = path.join(REPO_ROOT, 'agents');

function expectedAgentDefCount() {
  if (!fs.existsSync(AGENTS_DIR)) return 0;
  return fs.readdirSync(AGENTS_DIR).filter((e) => /^gsd-.*\.md$/i.test(e)).length;
}

function listInstalledAgentDefs(tmpDir) {
  const agentsDir = path.join(tmpDir, 'agents');
  if (!fs.existsSync(agentsDir)) return [];
  return fs.readdirSync(agentsDir).filter((e) => /^gsd-.*\.md$/i.test(e));
}

describe('installer config.toml and agent definitions', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-config-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('installs config.toml on fresh install', () => {
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    const configPath = path.join(tmpDir, '.codex', 'config.toml');
    assert.ok(fs.existsSync(configPath), 'config.toml should be installed');

    const content = fs.readFileSync(configPath, 'utf8');
    assert.match(content, /multi_agent\s*=\s*true/, 'config.toml should contain multi_agent = true');
    assert.match(content, /\[agents\./, 'config.toml should contain agent definitions');
  });

  test('skips config.toml when it already exists', () => {
    const install1 = runInstaller('--local', tmpDir);
    assert.ok(install1.success, `First install failed: ${install1.error}`);

    const configPath = path.join(tmpDir, '.codex', 'config.toml');
    fs.writeFileSync(configPath, '# user customized\n', 'utf8');

    const install2 = runInstaller('--local', tmpDir);
    assert.ok(install2.success, `Re-install failed: ${install2.error}`);

    const content = fs.readFileSync(configPath, 'utf8');
    assert.strictEqual(content, '# user customized\n', 'config.toml should not be overwritten');
  });

  test('installs agent definition files', () => {
    const expected = expectedAgentDefCount();
    if (expected === 0) return; // skip if no agents in source

    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    const installed = listInstalledAgentDefs(tmpDir);
    assert.strictEqual(installed.length, expected, `agent defs count should match source (${expected})`);
  });

  test('agent definitions use $ notation', () => {
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    const installed = listInstalledAgentDefs(tmpDir);
    if (installed.length === 0) return;

    const sample = fs.readFileSync(path.join(tmpDir, 'agents', installed[0]), 'utf8');
    assert.doesNotMatch(sample, /\/gsd:/, 'agent defs should not contain /gsd: notation');
  });

  test('verify passes with config.toml and agents installed', () => {
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    const verify = runInstaller('--verify --local', tmpDir);
    assert.ok(verify.success, `Verify failed: ${verify.error}`);
    assert.match(verify.output, /config\.toml installed/, 'verify should check config.toml');
    assert.match(verify.output, /Agent definitions complete/, 'verify should check agent definitions');
    assert.match(verify.output, /Integrity check passed\./, 'verify should pass');
  });
});
