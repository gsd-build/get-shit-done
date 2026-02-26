/**
 * Installer Tests (Codex modes + verify/repair)
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

describe('installer codex modes', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-install-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('skills mode installs only native skills and verifies cleanly', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local --codex-mode skills', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills count should match source commands');
    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'prompts should not be installed in skills mode');
    assert.ok(fs.existsSync(path.join(tmpDir, 'AGENTS.md')), 'AGENTS.md should be installed');
    const agents = readAgents(tmpDir);
    assert.match(agents, /\$gsd-new-project/, 'skills mode AGENTS should reference $ commands');
    assert.doesNotMatch(agents, /\/prompts:gsd-new-project/, 'skills mode AGENTS should not reference prompt aliases');

    const verify = runInstaller('--verify --local --codex-mode skills', tmpDir);
    assert.ok(verify.success, `Verify failed: ${verify.error}`);
    assert.match(verify.output, /Integrity check passed\./, 'verify output should indicate success');
  });

  test('default mode installs skills only', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'default install should create skills');
    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'default install should not create prompt aliases');
  });

  test('prompts mode installs only prompt aliases and verifies cleanly', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local --codex-mode prompts', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'prompt count should match source commands');
    assert.strictEqual(listSkillDirs(tmpDir).length, 0, 'skills should not be installed in prompts mode');
    const agents = readAgents(tmpDir);
    assert.match(agents, /\/prompts:gsd-new-project/, 'prompts mode AGENTS should reference prompt aliases');
    assert.doesNotMatch(agents, /\$gsd-new-project/, 'prompts mode AGENTS should not reference $ commands');

    const verify = runInstaller('--verify --local --codex-mode prompts', tmpDir);
    assert.ok(verify.success, `Verify failed: ${verify.error}`);
    assert.match(verify.output, /Integrity check passed\./, 'verify output should indicate success');
  });

  test('hybrid mode is rejected (must choose one surface)', () => {
    const install = runInstaller('--local --codex-mode hybrid', tmpDir);
    assert.ok(!install.success, 'install should fail for hybrid mode');
    assert.match(install.error, /Expected prompts or skills/i, 'error should explain valid modes');
  });

  test('verify fails on drift and --repair restores missing artifacts', () => {
    const expected = expectedCommandCount();
    const install = runInstaller('--local --codex-mode skills', tmpDir);
    assert.ok(install.success, `Install failed: ${install.error}`);

    fs.rmSync(path.join(tmpDir, 'skills', 'gsd-help'), { recursive: true, force: true });
    const failedVerify = runInstaller('--verify --local --codex-mode skills', tmpDir);
    assert.ok(!failedVerify.success, 'verify should fail after deleting a skill');
    assert.match(failedVerify.output, /Integrity check failed\./, 'verify output should indicate failure');

    const repaired = runInstaller('--verify --repair --local --codex-mode skills --migrate', tmpDir);
    assert.ok(repaired.success, `Repair failed: ${repaired.error}`);
    assert.match(repaired.output, /Integrity check passed\./, 'repair should end in healthy verification');

    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'prompts should not exist in skills mode');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be restored after repair');
  });

  test('detects migration in non-interactive mode and keeps legacy files by default', () => {
    const expected = expectedCommandCount();
    const promptsInstall = runInstaller('--local --codex-mode prompts', tmpDir);
    assert.ok(promptsInstall.success, `Prompt install failed: ${promptsInstall.error}`);
    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'initial prompts install should be complete');
    assert.strictEqual(listSkillDirs(tmpDir).length, 0, 'initial prompts install should have no skills');

    const defaultInstall = runInstaller('--local', tmpDir);
    assert.ok(defaultInstall.success, `Default install failed: ${defaultInstall.error}`);
    assert.match(defaultInstall.output, /Migration detected:/, 'install should report detected migration');
    assert.match(defaultInstall.output, /Skipping migration in non-interactive mode\./, 'install should skip without explicit consent');
    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'legacy prompts should remain without migration approval');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be regenerated after migration');
  });

  test('applies migration cleanup when --migrate is provided', () => {
    const expected = expectedCommandCount();
    const promptsInstall = runInstaller('--local --codex-mode prompts', tmpDir);
    assert.ok(promptsInstall.success, `Prompt install failed: ${promptsInstall.error}`);
    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'initial prompts install should be complete');

    const migratedInstall = runInstaller('--local --migrate', tmpDir);
    assert.ok(migratedInstall.success, `Migrated install failed: ${migratedInstall.error}`);
    assert.match(migratedInstall.output, /Migration approved by --migrate/, 'install should acknowledge explicit migration approval');
    assert.strictEqual(listPromptFiles(tmpDir).length, 0, 'legacy prompts should be removed with --migrate');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be present after migration');
  });

  test('verify fails when mixed command surfaces are present', () => {
    const expected = expectedCommandCount();
    const promptsInstall = runInstaller('--local --codex-mode prompts', tmpDir);
    assert.ok(promptsInstall.success, `Prompt install failed: ${promptsInstall.error}`);

    const skillsWithSkip = runInstaller('--local --codex-mode skills --skip-migrate', tmpDir);
    assert.ok(skillsWithSkip.success, `Skills install failed: ${skillsWithSkip.error}`);
    assert.strictEqual(listPromptFiles(tmpDir).length, expected, 'prompt aliases should remain with --skip-migrate');
    assert.strictEqual(listSkillDirs(tmpDir).length, expected, 'skills should be installed');

    const verify = runInstaller('--verify --local', tmpDir);
    assert.ok(!verify.success, 'verify should fail for mixed surfaces');
    assert.match(verify.output, /Single command surface required/, 'verify should explain mixed-surface policy');
  });
});
