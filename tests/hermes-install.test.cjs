process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createTempDir, cleanup, parseFrontmatter } = require('./helpers.cjs');
const pkg = require('../package.json');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  install,
  uninstall,
  writeManifest,
} = require('../bin/install.js');

describe('Hermes Agent runtime directory mapping', () => {
  test('maps Hermes to .hermes for local installs', () => {
    assert.strictEqual(getDirName('hermes'), '.hermes');
  });

  test('maps Hermes to ~/.hermes for global installs', () => {
    // Isolate from any HERMES_HOME exported on the developer's machine —
    // otherwise this test asserts the env-derived path, not the default.
    const originalHermesHome = process.env.HERMES_HOME;
    delete process.env.HERMES_HOME;
    try {
      assert.strictEqual(getGlobalDir('hermes'), path.join(os.homedir(), '.hermes'));
    } finally {
      if (originalHermesHome === undefined) delete process.env.HERMES_HOME;
      else process.env.HERMES_HOME = originalHermesHome;
    }
  });

  test('returns .hermes config fragments for local and global installs', () => {
    assert.strictEqual(getConfigDirFromHome('hermes', false), "'.hermes'");
    assert.strictEqual(getConfigDirFromHome('hermes', true), "'.hermes'");
  });
});

describe('getGlobalDir (Hermes Agent)', () => {
  let originalHermesConfigDir;

  beforeEach(() => {
    originalHermesConfigDir = process.env.HERMES_HOME;
  });

  afterEach(() => {
    if (originalHermesConfigDir !== undefined) {
      process.env.HERMES_HOME = originalHermesConfigDir;
    } else {
      delete process.env.HERMES_HOME;
    }
  });

  test('returns ~/.hermes with no env var or explicit dir', () => {
    delete process.env.HERMES_HOME;
    const result = getGlobalDir('hermes');
    assert.strictEqual(result, path.join(os.homedir(), '.hermes'));
  });

  test('returns explicit dir when provided', () => {
    const result = getGlobalDir('hermes', '/custom/hermes-path');
    assert.strictEqual(result, '/custom/hermes-path');
  });

  test('respects HERMES_HOME env var', () => {
    process.env.HERMES_HOME = '~/custom-hermes';
    const result = getGlobalDir('hermes');
    assert.strictEqual(result, path.join(os.homedir(), 'custom-hermes'));
  });

  test('explicit dir takes priority over HERMES_HOME', () => {
    process.env.HERMES_HOME = '~/from-env';
    const result = getGlobalDir('hermes', '/explicit/path');
    assert.strictEqual(result, '/explicit/path');
  });

  test('does not break other runtimes', () => {
    assert.strictEqual(getGlobalDir('claude'), path.join(os.homedir(), '.claude'));
    assert.strictEqual(getGlobalDir('codex'), path.join(os.homedir(), '.codex'));
  });
});

describe('Hermes Agent local install/uninstall', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-hermes-install-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('installs GSD into ./.hermes and removes it cleanly', () => {
    const result = install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');

    assert.strictEqual(result.runtime, 'hermes');
    assert.strictEqual(result.configDir, fs.realpathSync(targetDir));

    // Nested layout per spec #2841: all GSD skills collapse into a single
    // skills/gsd/ category so Hermes' system prompt sees one entry, not 86.
    // Skills use bare stem names (no gsd- prefix) inside the category dir,
    // per the layout module's prefix: '' design for Hermes (#3664).
    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'DESCRIPTION.md')),
      'DESCRIPTION.md exists at category root');
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'hermes');
    assert.ok(Object.keys(manifest.files).some(file => file.startsWith('skills/gsd/help/')), JSON.stringify(manifest.files));

    uninstall(false, 'hermes');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'help')), 'Hermes skill directory removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd')), 'Hermes gsd category dir removed');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')), 'get-shit-done removed');
  });

  test('installed SKILL.md frontmatter conforms to Hermes spec', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    // Nested layout: skills live under skills/gsd/<stem>/SKILL.md.
    // The layout module uses prefix: '' for Hermes so skill dirs have bare
    // stem names (help, plan, …) inside the category dir (#3664).
    const categoryDir = path.join(targetDir, 'skills', 'gsd');
    const skillDirs = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'DESCRIPTION.md')
      .map(e => e.name);

    assert.ok(skillDirs.length > 0, 'at least one skill installed');

    // Parse every SKILL.md and assert structural shape required by Hermes.
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(categoryDir, dir, 'SKILL.md'), 'utf8');
      const fm = parseFrontmatter(content);
      assert.strictEqual(fm.name, dir, `${dir}/SKILL.md name matches dir`);
      assert.ok(typeof fm.description === 'string' && fm.description.length > 0,
        `${dir}/SKILL.md has non-empty description`);
      assert.strictEqual(fm.version, pkg.version,
        `${dir}/SKILL.md declares version ${pkg.version} (got ${JSON.stringify(fm.version)})`);
    }

    // The category DESCRIPTION.md is part of the spec — verify it parses too.
    const desc = fs.readFileSync(path.join(categoryDir, 'DESCRIPTION.md'), 'utf8');
    const descFm = parseFrontmatter(desc);
    assert.strictEqual(descFm.name, 'gsd', 'category DESCRIPTION.md name is "gsd"');
    assert.ok(typeof descFm.description === 'string' && descFm.description.length > 0,
      'category DESCRIPTION.md has description');
    assert.strictEqual(descFm.version, pkg.version,
      'category DESCRIPTION.md declares version');

    uninstall(false, 'hermes');
  });

  test('replaces CLAUDE.md references with HERMES.md', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    const skillsDir = path.join(targetDir, 'skills');

    // Walk all skill files and confirm no `CLAUDE.md` token leaks; any
    // skill body that referenced project context should now point at
    // `HERMES.md` per the issue spec.
    let referencedHermesMd = false;
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(!/\bCLAUDE\.md\b/.test(content),
          `${path.relative(targetDir, full)} still references CLAUDE.md`);
        if (/\bHERMES\.md\b/.test(content)) referencedHermesMd = true;
      }
    };
    walk(skillsDir);
    // Sanity: at least one skill in the GSD set references the project
    // context filename, so the substitution actually exercises.
    assert.ok(referencedHermesMd, 'at least one skill references HERMES.md after substitution');

    uninstall(false, 'hermes');
  });
});

describe('E2E: Hermes Agent uninstall skills cleanup', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-hermes-uninstall-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(previousCwd);
    cleanup(tmpDir);
  });

  test('removes all skill directories on --hermes --uninstall', () => {
    const targetDir = path.join(tmpDir, '.hermes');
    install(false, 'hermes');

    const skillsDir = path.join(targetDir, 'skills');
    const categoryDir = path.join(skillsDir, 'gsd');
    assert.ok(fs.existsSync(categoryDir), 'skills/gsd/ category dir exists after install');

    // Layout uses prefix: '' for Hermes — skill dirs have bare stem names (no gsd- prefix)
    const installedSkills = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(e => e.isDirectory());
    assert.ok(installedSkills.length > 0, `found ${installedSkills.length} skill dirs before uninstall`);

    uninstall(false, 'hermes');

    assert.ok(!fs.existsSync(categoryDir), 'skills/gsd/ category dir removed by uninstall');
    if (fs.existsSync(skillsDir)) {
      const remainingFlat = fs.readdirSync(skillsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name.startsWith('gsd-'));
      assert.strictEqual(remainingFlat.length, 0,
        `Expected 0 stray flat gsd-* skill dirs after uninstall, found: ${remainingFlat.map(e => e.name).join(', ')}`);
    }
  });

  test('preserves non-GSD skill directories during --hermes --uninstall', () => {
    const targetDir = path.join(tmpDir, '.hermes');
    install(false, 'hermes');

    const customSkillDir = path.join(targetDir, 'skills', 'my-custom-skill');
    fs.mkdirSync(customSkillDir, { recursive: true });
    fs.writeFileSync(path.join(customSkillDir, 'SKILL.md'), '# My Custom Skill\n');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')), 'custom skill exists before uninstall');

    uninstall(false, 'hermes');

    assert.ok(fs.existsSync(path.join(customSkillDir, 'SKILL.md')),
      'Non-GSD skill directory should be preserved after Hermes uninstall');
  });

  test('removes engine directory on --hermes --uninstall', () => {
    const targetDir = path.join(tmpDir, '.hermes');
    install(false, 'hermes');

    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')),
      'engine exists before uninstall');

    uninstall(false, 'hermes');

    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')),
      'get-shit-done engine should be removed after Hermes uninstall');
  });
});

// ─── Regression: no Claude references leak into Hermes install (parity with Qwen regression #2112) ──────────

describe('Hermes install contains no leaked Claude references (parity with Qwen regression #2112)', () => {
  let tmpDir;
  let previousCwd;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-hermes-refs-');
    previousCwd = process.cwd();
    process.chdir(tmpDir);
    install(false, 'hermes');
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
   * Return files under .hermes/ that contain Claude references,
   * excluding CHANGELOG.md (historical accuracy) and VERSION (no prose).
   */
  function findClaudeLeaks() {
    const hermesDir = path.join(tmpDir, '.hermes');
    const allFiles = walk(hermesDir);
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
    const hermesDir = path.join(tmpDir, '.hermes');
    const skillsDir = path.join(hermesDir, 'skills');
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
        'Skills should not contain Claude references after Hermes install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('agents contain no CLAUDE.md or Claude Code references', () => {
    const agentsDir = path.join(tmpDir, '.hermes', 'agents');
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
        'Agents should not contain Claude references after Hermes install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('hooks contain no .claude/ path references', () => {
    const hooksDir = path.join(tmpDir, '.hermes', 'hooks');
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
        'Hooks should not contain .claude/ path references after Hermes install.',
        'Leaking files:',
        ...leaks,
      ].join('\n'));
  });

  test('full tree scan finds zero Claude references outside CHANGELOG.md', () => {
    const leaks = findClaudeLeaks();
    assert.strictEqual(leaks.length, 0,
      [
        'No files under .hermes/ (except CHANGELOG.md) should contain Claude references.',
        `Found ${leaks.length} leaking file(s):`,
        ...leaks,
      ].join('\n'));
  });
});
