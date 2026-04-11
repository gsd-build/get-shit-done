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
  install,
  uninstall,
  writeManifest,
} = require('../bin/install.js');

describe('Qwen Code runtime directory mapping', () => {
  test('maps Qwen to .qwen for local installs', () => {
    assert.strictEqual(getDirName('qwen'), '.qwen');
  });

  test('maps Qwen to ~/.qwen for global installs', () => {
    assert.strictEqual(getGlobalDir('qwen'), path.join(os.homedir(), '.qwen'));
  });

  test('returns .qwen config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('qwen', false), "'.qwen'");
    assert.strictEqual(getConfigDirFromHome('qwen', true), "'.qwen'");
  });
});

describe('getGlobalDir (Qwen Code)', () => {
  let originalQwenConfigDir;

  beforeEach(() => {
    originalQwenConfigDir = process.env.QWEN_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalQwenConfigDir !== undefined) {
      process.env.QWEN_CONFIG_DIR = originalQwenConfigDir;
    } else {
      delete process.env.QWEN_CONFIG_DIR;
    }
  });

  test('returns ~/.qwen with no env var or explicit dir', () => {
    delete process.env.QWEN_CONFIG_DIR;
    const result = getGlobalDir('qwen');
    assert.strictEqual(result, path.join(os.homedir(), '.qwen'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('qwen', '/custom/qwen-path');
    assert.strictEqual(result, '/custom/qwen-path');
  });

  test('respects QWEN_CONFIG_DIR env var', () => {
    process.env.QWEN_CONFIG_DIR = '~/custom-qwen';
    const result = getGlobalDir('qwen');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-qwen'));
  });

  test('explicit dir takes priority over QWEN_CONFIG_DIR', () => {
    process.env.QWEN_CONFIG_DIR = '~/from-env';
    const result = getGlobalDir('qwen', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

describe('Qwen Code local install/uninstall', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-qwen-install-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('installs GSD into ./.qwen and removes it cleanly', () => {
    const result = install(false, 'qwen');
    const targetDir = path.join(tmpDir, '.qwen');

    assert.strictEqual(result.runtime, 'qwen');
    assert.strictEqual(result.configDir, fs.realpathSync(targetDir));

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd-help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'qwen');
    assert.ok(Object.keys(manifest.files).some(file => file.startsWith('skills/gsd-help/')), manifest);

    uninstall(false, 'qwen');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')), 'Qwen skill directory removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')), 'get-shit-done removed');
  });
});

describe('E2E: Qwen Code uninstall skills cleanup', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-qwen-uninstall-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('removes all gsd-* skill directories on --qwen --uninstall', () => {
    const targetDir = path.join(tmpDir, '.qwen');
    install(false, 'qwen');

    const skillsDir = path.join(targetDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills dir exists after install');

    const installedSkills = fs.readdirSync(skillsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
    assert.ok(installedSkills.length > 0, `found ${installedSkills.length} gsd-* skill dirs before uninstall`);

    uninstall(false, 'qwen');

    if (fs.existsSync(skillsDir)) {
      const remainingGsd = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(remainingGsd.length, 0,
        `Expected 0 gsd-* skill dirs after uninstall, found: ${remainingGsd.map(e => e.name).join(', ')}`);
    }
  });

  test('preserves non-GSD skill directories during --qwen --uninstall', () => {
    const targetDir = path.join(tmpDir, '.qwen');
    install(false, 'qwen');

    const customSkillDir = path.join(targetDir, 'skills', 'my-custom-skill');
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# My Custom Skill\n');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')), 'custom skill exists before uninstall');

    uninstall(false, 'qwen');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')),
      'Non-GSD skill directory should be preserved after Qwen uninstall');
  });

  test('removes engine directory on --qwen --uninstall', () => {
    const targetDir = path.join(tmpDir, '.qwen');
    install(false, 'qwen');

    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')),
      'engine exists before uninstall');

    uninstall(false, 'qwen');

    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')),
      'get-shit-done engine should be removed after Qwen uninstall');
  });
});

// ─── Regression: no Claude references leak into Qwen install (#2112) ──────────

describe('Qwen install contains no leaked Claude references (#2112)', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-qwen-refs-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
    install(false, 'qwen');
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  /**
   * Recursively walk a directory and return all file paths.
   */
  function walk(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walk(full));
      } else {
        results.push(full);
      }
    }
    return results;
  }

  /**
   * Return files under .qwen/ that contain Claude references,
   * excluding CHANGELOG.md (historical accuracy) and VERSION (no prose).
   */
  function findClaudeLeaks() {
    const qwenDir = path.join(tmpDir, '.qwen');
    const allFiles = walk(qwenDir);
    const textFiles = allFiles.filter(f =>
      f.endsWith('.md') || f.endsWith('.cjs') || f.endsWith('.js')
    );
    const excluded = ['CHANGELOG.md'];
    const candidates = textFiles.filter(f =>
      !excluded.includes(path.basename(f))
    );
    const leaks = [];
    for (const file of candidates) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) ||
          /\bClaude Code\b/.test(content) ||
          /\.claude\//.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    return leaks;
  }

  test('skills contain no CLAUDE.md or Claude Code references', () => {
    const qwenDir = path.join(tmpDir, '.qwen');
    const skillsDir = path.join(qwenDir, 'skills');
    assert.ok(fs.existsSync(skillsDir), 'skills directory exists');

    const skillFiles = walk(skillsDir).filter(f => f.endsWith('.md'));
    assert.ok(skillFiles.length > 0, 'at least one skill file exists');

    const leaks = [];
    for (const file of skillFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) || /\bClaude Code\b/.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Skills should not contain Claude references after Qwen install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('agents contain no CLAUDE.md or Claude Code references', () => {
    const agentsDir = path.join(tmpDir, '.qwen', 'agents');
    assert.ok(fs.existsSync(agentsDir), 'agents directory exists');

    const agentFiles = walk(agentsDir).filter(f => f.endsWith('.md'));
    assert.ok(agentFiles.length > 0, 'at least one agent file exists');

    const leaks = [];
    for (const file of agentFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\bCLAUDE\.md\b/.test(content) || /\bClaude Code\b/.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Agents should not contain Claude references after Qwen install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('hooks contain no .claude/ path references', () => {
    const hooksDir = path.join(tmpDir, '.qwen', 'hooks');
    if (!fs.existsSync(hooksDir)) {
      return; // hooks may not be present in local installs
    }

    const hookFiles = walk(hooksDir).filter(f => f.endsWith('.js'));
    const leaks = [];
    for (const file of hookFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (/\.claude\//.test(content)) {
        leaks.push(path.relative(tmpDir, file));
      }
    }
    assert.strictEqual(leaks.length, 0,
      [
        'Hooks should not contain .claude/ path references after Qwen install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('full tree scan finds zero Claude references outside CHANGELOG.md', () => {
    const leaks = findClaudeLeaks();
    assert.strictEqual(leaks.length, 0,
      [
        'No files under .qwen/ (except CHANGELOG.md) should contain Claude references.',
        `Found ${leaks.length} leaking file(s):`,
        ...leaks,
      ].join('\n'));
  });
});
