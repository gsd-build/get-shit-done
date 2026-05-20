// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Installer Module — Sections 1–5.
 *
 * Covers: getDirName/getGlobalDir/getConfigDirFromHome, per-runtime
 * install/uninstall spot-checks (hermes/qwen/trae), uninstall skills
 * cleanup, Claude-reference leak tests, and Kilo-specific helpers.
 *
 * Consolidates (original sources from #3758):
 *   hermes-install.test.cjs
 *   kilo-install.test.cjs
 *   qwen-install.test.cjs
 *   trae-install.test.cjs
 *   antigravity-install.test.cjs
 *
 * Closes #3758
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createTempDir, createTempProject, cleanup, parseFrontmatter } = require('./helpers.cjs');
const pkg = require('../package.json');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  install,
  uninstall,
  writeManifest,
  allRuntimes,
  runtimeMap,
  buildRuntimePromptText,
  resolveKiloConfigPath,
  configureKiloPermissions,
} = require('../bin/install.js');

const {
  RUNTIME_META,
  SKILL_RUNTIMES,
  stripAnsi,
  walk,
} = require('./helpers/install-shared.cjs');

// ─── Section 1: getDirName / getGlobalDir / getConfigDirFromHome ──────────────

describe('getDirName — all runtimes', () => {
  for (const runtime of allRuntimes) {
    test(`getDirName('${runtime}') returns expected local directory name`, () => {
      const expected = RUNTIME_META[runtime].localDir;
      assert.strictEqual(getDirName(runtime), expected,
        `getDirName('${runtime}') should return '${expected}'`);
    });
  }
});

describe('getGlobalDir — all runtimes default paths', () => {
  // Test the default (no env var, no explicit dir) for each runtime
  const ENV_KEYS = [
    'HERMES_HOME', 'QWEN_CONFIG_DIR', 'TRAE_CONFIG_DIR', 'ANTIGRAVITY_CONFIG_DIR',
    'KILO_CONFIG_DIR', 'KILO_CONFIG', 'XDG_CONFIG_HOME',
  ];
  let savedEnv = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
      else delete process.env[key];
    }
  });

  for (const runtime of allRuntimes) {
    test(`getGlobalDir('${runtime}') returns expected home-relative path`, () => {
      const expected = path.join(os.homedir(), RUNTIME_META[runtime].globalSuffix);
      assert.strictEqual(getGlobalDir(runtime), expected);
    });
  }
});

describe('getGlobalDir — explicit configDir overrides env for all runtimes', () => {
  test('explicit dir overrides any env var for hermes', () => {
    const savedHome = process.env.HERMES_HOME;
    process.env.HERMES_HOME = '~/from-env';
    try {
      assert.strictEqual(getGlobalDir('hermes', '/explicit/hermes'), '/explicit/hermes');
    } finally {
      if (savedHome !== undefined) process.env.HERMES_HOME = savedHome;
      else delete process.env.HERMES_HOME;
    }
  });

  test('explicit dir overrides KILO_CONFIG_DIR', () => {
    const saved = process.env.KILO_CONFIG_DIR;
    process.env.KILO_CONFIG_DIR = '~/from-env';
    try {
      assert.strictEqual(getGlobalDir('kilo', '/explicit/kilo'), '/explicit/kilo');
    } finally {
      if (saved !== undefined) process.env.KILO_CONFIG_DIR = saved;
      else delete process.env.KILO_CONFIG_DIR;
    }
  });
});

describe('getGlobalDir — HERMES_HOME env var', () => {
  let saved;
  beforeEach(() => { saved = process.env.HERMES_HOME; });
  afterEach(() => {
    if (saved !== undefined) process.env.HERMES_HOME = saved;
    else delete process.env.HERMES_HOME;
  });

  test('respects HERMES_HOME env var (tilde-expanded)', () => {
    process.env.HERMES_HOME = '~/custom-hermes';
    assert.strictEqual(getGlobalDir('hermes'), path.join(os.homedir(), 'custom-hermes'));
  });
});

describe('getGlobalDir — Kilo env var priority', () => {
  let savedEnv;
  beforeEach(() => {
    savedEnv = {
      KILO_CONFIG_DIR: process.env.KILO_CONFIG_DIR,
      KILO_CONFIG: process.env.KILO_CONFIG,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };
    delete process.env.KILO_CONFIG_DIR;
    delete process.env.KILO_CONFIG;
    delete process.env.XDG_CONFIG_HOME;
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
  });

  test('respects KILO_CONFIG_DIR', () => {
    process.env.KILO_CONFIG_DIR = '~/custom-kilo';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'custom-kilo'));
  });

  test('falls back to XDG_CONFIG_HOME/kilo', () => {
    process.env.XDG_CONFIG_HOME = '~/xdg-config';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'xdg-config', 'kilo'));
  });

  test('uses dirname(KILO_CONFIG) when KILO_CONFIG_DIR unset', () => {
    process.env.KILO_CONFIG = '~/profiles/work/kilo.jsonc';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'profiles', 'work'));
  });

  test('KILO_CONFIG_DIR takes precedence over KILO_CONFIG', () => {
    process.env.KILO_CONFIG_DIR = '~/custom-kilo';
    process.env.KILO_CONFIG = '~/profiles/work/kilo.jsonc';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'custom-kilo'));
  });
});

describe('getConfigDirFromHome — spot-checks', () => {
  test('claude returns .claude for both scopes', () => {
    assert.strictEqual(getConfigDirFromHome('claude', false), "'.claude'");
    assert.strictEqual(getConfigDirFromHome('claude', true), "'.claude'");
  });

  test('hermes returns .hermes for both scopes', () => {
    assert.strictEqual(getConfigDirFromHome('hermes', false), "'.hermes'");
    assert.strictEqual(getConfigDirFromHome('hermes', true), "'.hermes'");
  });

  test('qwen returns .qwen for both scopes', () => {
    assert.strictEqual(getConfigDirFromHome('qwen', false), "'.qwen'");
    assert.strictEqual(getConfigDirFromHome('qwen', true), "'.qwen'");
  });

  test('trae returns .trae for both scopes', () => {
    assert.strictEqual(getConfigDirFromHome('trae', false), "'.trae'");
    assert.strictEqual(getConfigDirFromHome('trae', true), "'.trae'");
  });

  test('antigravity returns .agent (local) and .gemini, antigravity (global)', () => {
    assert.strictEqual(getConfigDirFromHome('antigravity', false), "'.agent'");
    assert.strictEqual(getConfigDirFromHome('antigravity', true), "'.gemini', 'antigravity'");
  });

  test('kilo returns .kilo (local) and .config, kilo (global)', () => {
    assert.strictEqual(getConfigDirFromHome('kilo', false), "'.kilo'");
    assert.strictEqual(getConfigDirFromHome('kilo', true), "'.config', 'kilo'");
  });
});

// ─── Section 2: Local install / uninstall for subset of runtimes ─────────────
// Full E2E for runtimes that have distinct install paths (hermes nested layout,
// qwen flat layout, trae flat layout). Others are covered by layout-loop tests.

describe('install/uninstall — hermes (nested skills/gsd/ layout)', () => {
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

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'DESCRIPTION.md')),
      'DESCRIPTION.md at category root');
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'hermes');
    assert.ok(Object.keys(manifest.files).some(f => f.startsWith('skills/gsd/help/')),
      JSON.stringify(manifest.files));

    uninstall(false, 'hermes');

    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd', 'help')));
    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd')));
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')));
  });

  test('installed SKILL.md frontmatter conforms to Hermes spec', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    const categoryDir = path.join(targetDir, 'skills', 'gsd');
    const skillDirs = fs.readdirSync(categoryDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== 'DESCRIPTION.md')
      .map(e => e.name);

    assert.ok(skillDirs.length > 0, 'at least one skill installed');

    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(categoryDir, dir, 'SKILL.md'), 'utf8');
      const fm = parseFrontmatter(content);
      assert.strictEqual(fm.name, dir, `${dir}/SKILL.md name matches dir`);
      assert.ok(typeof fm.description === 'string' && fm.description.length > 0,
        `${dir}/SKILL.md has description`);
      assert.strictEqual(fm.version, pkg.version,
        `${dir}/SKILL.md declares version ${pkg.version}`);
    }

    const desc = fs.readFileSync(path.join(categoryDir, 'DESCRIPTION.md'), 'utf8');
    const descFm = parseFrontmatter(desc);
    assert.strictEqual(descFm.name, 'gsd');
    assert.ok(typeof descFm.description === 'string' && descFm.description.length > 0);
    assert.strictEqual(descFm.version, pkg.version);

    uninstall(false, 'hermes');
  });

  test('replaces CLAUDE.md references with HERMES.md', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    const skillsDir = path.join(targetDir, 'skills');

    let referencedHermesMd = false;
    const checkWalk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { checkWalk(full); continue; }
        if (!entry.name.endsWith('.md')) continue;
        const content = fs.readFileSync(full, 'utf8');
        assert.ok(!/\bCLAUDE\.md\b/.test(content),
          `${path.relative(targetDir, full)} still references CLAUDE.md`);
        if (/\bHERMES\.md\b/.test(content)) referencedHermesMd = true;
      }
    };
    checkWalk(skillsDir);
    assert.ok(referencedHermesMd, 'at least one skill references HERMES.md');
    uninstall(false, 'hermes');
  });
});

describe('install/uninstall — qwen (flat skills/gsd-* layout)', () => {
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
    assert.ok(Object.keys(manifest.files).some(f => f.startsWith('skills/gsd-help/')));

    uninstall(false, 'qwen');
    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')));
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')));
  });
});

describe('install/uninstall — trae (flat skills/gsd-* layout)', () => {
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

  test('installs GSD into ./.trae and removes it cleanly (typed IR result)', () => {
    const result = install(false, 'trae');
    const targetDir = path.join(tmpDir, '.trae');

    assert.deepStrictEqual(result, {
      settingsPath: null,
      settings: null,
      statuslineCommand: null,
      updateBannerCommand: null,
      runtime: 'trae',
      configDir: fs.realpathSync(targetDir),
    });

    assert.ok(fs.existsSync(path.join(targetDir, 'skills', 'gsd-help', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    assert.ok(fs.existsSync(path.join(targetDir, 'agents')));

    const manifest = writeManifest(targetDir, 'trae');
    assert.ok(Object.keys(manifest.files).some(f => f.startsWith('skills/gsd-help/')));

    uninstall(false, 'trae');
    assert.ok(!fs.existsSync(path.join(targetDir, 'skills', 'gsd-help')));
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')));
  });
});

// ─── Section 3: Uninstall skills cleanup — parameterised ─────────────────────

describe('uninstall skills cleanup — hermes', () => {
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

  test('removes skills/gsd/ category dir', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    const categoryDir = path.join(targetDir, 'skills', 'gsd');
    assert.ok(fs.existsSync(categoryDir));
    const skills = fs.readdirSync(categoryDir, { withFileTypes: true }).filter(e => e.isDirectory());
    assert.ok(skills.length > 0);

    uninstall(false, 'hermes');
    assert.ok(!fs.existsSync(categoryDir));
  });

  test('preserves non-GSD skill directories', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    const custom = path.join(targetDir, 'skills', 'my-custom-skill');
    fs.mkdirSync(custom, { recursive: true });
    fs.writeFileSync(path.join(custom, 'SKILL.md'), '# custom\n');

    uninstall(false, 'hermes');
    assert.ok(fs.existsSync(path.join(custom, 'SKILL.md')));
  });

  test('removes engine directory', () => {
    install(false, 'hermes');
    const targetDir = path.join(tmpDir, '.hermes');
    assert.ok(fs.existsSync(path.join(targetDir, 'get-shit-done', 'VERSION')));
    uninstall(false, 'hermes');
    assert.ok(!fs.existsSync(path.join(targetDir, 'get-shit-done')));
  });
});

// ─── Section 4: No Claude references leak into non-Claude runtimes ────────────

for (const runtime of ['hermes', 'qwen']) {
  describe(`no Claude references leak into ${runtime} install`, () => {
    let tmpDir;
    let previousCwd;

    beforeEach(() => {
      tmpDir = createTempDir(`gsd-${runtime}-refs-`);
      previousCwd = process.cwd();
      process.chdir(tmpDir);
      install(false, runtime);
    });

    afterEach(() => {
      process.chdir(previousCwd);
      cleanup(tmpDir);
    });

    test('skills contain no CLAUDE.md or Claude Code references', () => {
      const rtDir = path.join(tmpDir, getDirName(runtime));
      const skillsDir = path.join(rtDir, 'skills');
      assert.ok(fs.existsSync(skillsDir));

      const skillFiles = walk(skillsDir).filter(f => f.endsWith('.md'));
      assert.ok(skillFiles.length > 0);

      const leaks = skillFiles.filter(f => {
        const c = fs.readFileSync(f, 'utf8');
        return /\bCLAUDE\.md\b/.test(c) || /\bClaude Code\b/.test(c);
      }).map(f => path.relative(tmpDir, f));
      assert.strictEqual(leaks.length, 0, `Leaking: ${leaks.join(', ')}`);
    });

    test('agents contain no CLAUDE.md or Claude Code references', () => {
      const agentsDir = path.join(tmpDir, getDirName(runtime), 'agents');
      assert.ok(fs.existsSync(agentsDir));

      const agentFiles = walk(agentsDir).filter(f => f.endsWith('.md'));
      assert.ok(agentFiles.length > 0);

      const leaks = agentFiles.filter(f => {
        const c = fs.readFileSync(f, 'utf8');
        return /\bCLAUDE\.md\b/.test(c) || /\bClaude Code\b/.test(c);
      }).map(f => path.relative(tmpDir, f));
      assert.strictEqual(leaks.length, 0, `Leaking: ${leaks.join(', ')}`);
    });

    test('full tree scan finds zero Claude references outside CHANGELOG.md', () => {
      const rtDir = path.join(tmpDir, getDirName(runtime));
      const allFiles = walk(rtDir).filter(f =>
        (f.endsWith('.md') || f.endsWith('.cjs') || f.endsWith('.js')) &&
        path.basename(f) !== 'CHANGELOG.md'
      );
      const leaks = allFiles.filter(f => {
        const c = fs.readFileSync(f, 'utf8');
        return /\bCLAUDE\.md\b/.test(c) || /\bClaude Code\b/.test(c) || /\.claude\//.test(c);
      }).map(f => path.relative(tmpDir, f));
      assert.strictEqual(leaks.length, 0, `Leaking: ${leaks.join(', ')}`);
    });
  });
}

// ─── Section 5: Kilo-specific helpers ────────────────────────────────────────

describe('resolveKiloConfigPath', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempProject('gsd-kilo-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('prefers kilo.jsonc when present', () => {
    const configDir = path.join(tmpDir, '.kilo');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'kilo.jsonc'), '{\n}\n');
    assert.strictEqual(resolveKiloConfigPath(configDir), path.join(configDir, 'kilo.jsonc'));
  });

  test('falls back to kilo.json', () => {
    const configDir = path.join(tmpDir, '.kilo');
    fs.mkdirSync(configDir, { recursive: true });
    assert.strictEqual(resolveKiloConfigPath(configDir), path.join(configDir, 'kilo.json'));
  });
});

describe('configureKiloPermissions', () => {
  let tmpDir;
  let configDir;
  let savedEnv;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-kilo-perms-');
    configDir = path.join(tmpDir, '.config', 'kilo');
    savedEnv = {
      KILO_CONFIG_DIR: process.env.KILO_CONFIG_DIR,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
    };
    process.env.KILO_CONFIG_DIR = configDir;
    delete process.env.XDG_CONFIG_HOME;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v !== undefined) process.env[k] = v;
      else delete process.env[k];
    }
    cleanup(tmpDir);
  });

  test('writes GSD permissions to kilo.json when config is missing', () => {
    configureKiloPermissions(true);
    const configPath = path.join(configDir, 'kilo.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const gsdPath = `${configDir.replace(/\\/g, '/')}/get-shit-done/*`;
    assert.strictEqual(config.permission.read[gsdPath], 'allow');
    assert.strictEqual(config.permission.external_directory[gsdPath], 'allow');
  });

  test('updates existing kilo.jsonc configs via JSONC parsing', () => {
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'kilo.jsonc');
    fs.writeFileSync(configPath, '{\n  // existing\n  "permission": {\n    "bash": "ask",\n  },\n}\n');
    configureKiloPermissions(true);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const gsdPath = `${configDir.replace(/\\/g, '/')}/get-shit-done/*`;
    assert.strictEqual(config.permission.bash, 'ask');
    assert.strictEqual(config.permission.read[gsdPath], 'allow');
    assert.strictEqual(config.permission.external_directory[gsdPath], 'allow');
  });

  test('writes permissions to an explicit config dir argument', () => {
    const explicitDir = path.join(tmpDir, 'custom-kilo-config');
    configureKiloPermissions(true, explicitDir);
    const configPath = path.join(explicitDir, 'kilo.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const gsdPath = `${explicitDir.replace(/\\/g, '/')}/get-shit-done/*`;
    assert.strictEqual(config.permission.read[gsdPath], 'allow');
    assert.strictEqual(config.permission.external_directory[gsdPath], 'allow');
  });
});

describe('Kilo source integration assertions', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');
  const updateWorkflowSrc = fs.readFileSync(
    path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md'), 'utf8');

  test('--kilo flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--kilo')"));
  });

  test('runtimeMap has Kilo as option 11', () => {
    assert.strictEqual(runtimeMap['11'], 'kilo');
  });

  test('prompt text shows Kilo above OpenCode without marketing copy', () => {
    const plain = stripAnsi(buildRuntimePromptText());
    assert.ok(/\b11\)\s*Kilo\b/.test(plain));
    assert.ok(plain.indexOf('11) Kilo') < plain.indexOf('OpenCode'));
    assert.ok(!plain.includes('the #1 AI coding platform on OpenRouter'));
  });

  test('finishInstall passes the actual config dir to Kilo permissions', () => {
    assert.ok(src.includes('configureKiloPermissions(isGlobal, configDir);'));
  });

  test('uninstall cleans Kilo permissions from the resolved target dir', () => {
    assert.ok(src.includes('const configPath = resolveKiloConfigPath(targetDir);'));
  });

  test('update workflow checks preferred custom config dirs', () => {
    assert.ok(updateWorkflowSrc.includes('PREFERRED_CONFIG_DIR'));
    assert.ok(updateWorkflowSrc.includes('kilo.jsonc'));
    assert.ok(updateWorkflowSrc.includes('KILO_CONFIG'));
  });
});
