/**
 * GSD Installer Tests - Copilot CLI support
 *
 * These tests invoke bin/install.js as a subprocess (E2E) and also validate
 * the conversion functions by running the installer and inspecting output files.
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');

/**
 * Run install.js with given args and env overrides.
 * Returns { success, output, stderr }.
 */
function runInstaller(args, env = {}) {
  try {
    const result = execSync(`node "${INSTALL_SCRIPT}" ${args}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });
    return { success: true, output: result };
  } catch (err) {
    return {
      success: false,
      output: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message,
    };
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-test-copilot-'));
}

function cleanup(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Unit-level: conversion function behaviour via installed skill inspection
// ---------------------------------------------------------------------------

describe('Copilot CLI install', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('installs skills to skills/gsd-*/SKILL.md', () => {
    const result = runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });
    assert.ok(result.success, `Install failed: ${result.stderr}`);

    const skillsDir = path.join(tmpDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills/ directory should exist');

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkillDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.ok(gsdSkillDirs.length > 0, 'should create at least one gsd-* skill directory');

    // Each skill dir must contain SKILL.md
    for (const entry of gsdSkillDirs) {
      const skillFile = path.join(skillsDir, entry.name, 'SKILL.md');
      assert.ok(fs.existsSync(skillFile), `SKILL.md should exist in ${entry.name}`);
    }
  });

  test('SKILL.md has correct YAML frontmatter with name and description', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const skillFile = path.join(tmpDir, 'skills', 'gsd-add-phase', 'SKILL.md');
    assert.ok(fs.existsSync(skillFile), 'gsd-add-phase SKILL.md should exist');

    const content = fs.readFileSync(skillFile, 'utf-8');
    assert.ok(content.startsWith('---\n'), 'SKILL.md should start with YAML frontmatter');
    assert.ok(content.includes('name: "gsd-add-phase"'), 'frontmatter should include name');
    assert.ok(content.includes('description:'), 'frontmatter should include description');
    assert.ok(content.includes('short-description:'), 'frontmatter should include short-description');
  });

  test('SKILL.md contains copilot_skill_adapter block', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const skillFile = path.join(tmpDir, 'skills', 'gsd-add-phase', 'SKILL.md');
    const content = fs.readFileSync(skillFile, 'utf-8');

    assert.ok(content.includes('<copilot_skill_adapter>'), 'should contain <copilot_skill_adapter> block');
    assert.ok(content.includes('</copilot_skill_adapter>'), 'should close </copilot_skill_adapter> block');
    assert.ok(content.includes('gsd-add-phase'), 'adapter should reference skill name');
    assert.ok(!content.includes('<codex_skill_adapter>'), 'should NOT contain Codex adapter block');
  });

  test('SKILL.md uses {{GSD_ARGS}} instead of $ARGUMENTS', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const skillsDir = path.join(tmpDir, 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkillDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));

    for (const entry of gsdSkillDirs) {
      const content = fs.readFileSync(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf-8');
      assert.ok(!content.includes('$ARGUMENTS'), `${entry.name} should not contain $ARGUMENTS`);
    }
  });

  test('SKILL.md converts /gsd:X slash commands to @gsd-X mentions', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const skillsDir = path.join(tmpDir, 'skills');
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    const gsdSkillDirs = entries.filter(e => e.isDirectory() && e.name.startsWith('gsd-'));

    for (const entry of gsdSkillDirs) {
      const content = fs.readFileSync(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf-8');
      // No /gsd:X patterns should remain
      assert.ok(!/\/gsd:[a-z0-9-]+/i.test(content), `${entry.name} should not contain /gsd:X patterns`);
    }
  });

  test('installs get-shit-done directory', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const gsdDir = path.join(tmpDir, 'get-shit-done');
    assert.ok(fs.existsSync(gsdDir), 'get-shit-done/ directory should be installed');
  });

  test('installs agents directory', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const agentsDir = path.join(tmpDir, 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents/ directory should be installed');
  });

  test('writes gsd-file-manifest.json', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const manifest = path.join(tmpDir, 'gsd-file-manifest.json');
    assert.ok(fs.existsSync(manifest), 'gsd-file-manifest.json should be written');

    const data = JSON.parse(fs.readFileSync(manifest, 'utf-8'));
    assert.ok(typeof data.version === 'string', 'manifest should have a version field');
    assert.ok(typeof data.timestamp === 'string', 'manifest should have a timestamp field');
    assert.ok(typeof data.files === 'object' && data.files !== null, 'manifest.files should be an object');
    assert.ok(Object.keys(data.files).length > 0, 'manifest should list installed files');
    // Skills should appear in manifest
    const skillKeys = Object.keys(data.files).filter(k => k.startsWith('skills/gsd-'));
    assert.ok(skillKeys.length > 0, 'manifest should list skills/gsd-* files');
  });

  test('does not create settings.json', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const settingsFile = path.join(tmpDir, 'settings.json');
    assert.ok(!fs.existsSync(settingsFile), 'settings.json should NOT be created for Copilot');
  });

  test('does not create hooks/', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });

    const hooksDir = path.join(tmpDir, 'hooks');
    assert.ok(!fs.existsSync(hooksDir), 'hooks/ should NOT be created for Copilot');
  });
});

// ---------------------------------------------------------------------------
// E2E: uninstall
// ---------------------------------------------------------------------------

describe('Copilot CLI uninstall', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
    // Install first
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('uninstall removes all gsd-* skill directories', () => {
    const skillsDir = path.join(tmpDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills/ should exist before uninstall');

    const result = runInstaller('--copilot --global --uninstall', { COPILOT_CONFIG_DIR: tmpDir });
    assert.ok(result.success, `Uninstall failed: ${result.stderr}`);

    const remaining = fs.existsSync(skillsDir)
      ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter(e => e.isDirectory() && e.name.startsWith('gsd-'))
      : [];
    assert.strictEqual(remaining.length, 0, 'All gsd-* skill directories should be removed after uninstall');
  });

  test('uninstall removes get-shit-done directory', () => {
    const gsdDir = path.join(tmpDir, 'get-shit-done');
    assert.ok(fs.existsSync(gsdDir), 'get-shit-done/ should exist before uninstall');

    runInstaller('--copilot --global --uninstall', { COPILOT_CONFIG_DIR: tmpDir });

    assert.ok(!fs.existsSync(gsdDir), 'get-shit-done/ should be removed after uninstall');
  });

  test('uninstall output mentions GitHub Copilot CLI', () => {
    const result = runInstaller('--copilot --global --uninstall', { COPILOT_CONFIG_DIR: tmpDir });
    assert.ok(result.success, `Uninstall failed: ${result.stderr}`);
    assert.ok(
      result.output.includes('GitHub Copilot CLI'),
      'uninstall output should mention GitHub Copilot CLI'
    );
  });

  test('uninstall on non-existent dir exits cleanly', () => {
    const emptyDir = makeTempDir();
    cleanup(emptyDir); // Remove it so it doesn't exist

    const result = runInstaller('--copilot --global --uninstall', { COPILOT_CONFIG_DIR: emptyDir });
    assert.ok(result.success, 'Should exit cleanly when directory does not exist');
    assert.ok(
      result.output.includes('Nothing to uninstall'),
      'Should report nothing to uninstall'
    );
  });
});

// ---------------------------------------------------------------------------
// E2E: reinstall idempotency
// ---------------------------------------------------------------------------

describe('Copilot CLI reinstall', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('reinstalling is idempotent — skill count stays consistent', () => {
    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });
    const countAfterFirst = fs
      .readdirSync(path.join(tmpDir, 'skills'), { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;

    runInstaller('--copilot --global', { COPILOT_CONFIG_DIR: tmpDir });
    const countAfterSecond = fs
      .readdirSync(path.join(tmpDir, 'skills'), { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-')).length;

    assert.strictEqual(countAfterFirst, countAfterSecond, 'Reinstall should produce same skill count');
  });
});
