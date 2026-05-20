// allow-test-rule: source-text-is-the-product
// Reads .md/.json/.yml product files whose deployed text IS what the
// runtime loads — testing text content tests the deployed contract.

/**
 * Installer Module — parameterised across all runtimes.
 *
 * Consolidates:
 *   hermes-install.test.cjs
 *   kilo-install.test.cjs
 *   qwen-install.test.cjs
 *   trae-install.test.cjs
 *   antigravity-install.test.cjs
 *   install-minimal.test.cjs
 *   install-minimal-all-runtimes.test.cjs
 *   install-minimal-backcompat.test.cjs
 *   install-hooks-copy.test.cjs
 *   install-uninstall-layout-loop.test.cjs
 *
 * Closes #3758
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, execFileSync } = require('node:child_process');

const { createTempDir, createTempProject, cleanup, parseFrontmatter } = require('./helpers.cjs');
const pkg = require('../package.json');

const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  install,
  uninstall,
  writeManifest,
  installRuntimeArtifacts,
  allRuntimes,
  parseRuntimeInput,
  runtimeMap,
  buildRuntimePromptText,
  resolveKiloConfigPath,
  configureKiloPermissions,
  validateHookFields,
} = require('../bin/install.js');

const {
  resolveRuntimeArtifactLayout,
} = require('../get-shit-done/bin/lib/runtime-artifact-layout.cjs');

const {
  MINIMAL_SKILL_ALLOWLIST,
  PROFILES,
  isMinimalMode,
  shouldInstallSkill,
  stageSkillsForMode,
  cleanupStagedSkills,
  loadSkillsManifest,
  resolveProfile,
} = require('../get-shit-done/bin/lib/install-profiles.cjs');

// ─── Shared profile / manifest fixtures ──────────────────────────────────────

const REAL_COMMANDS_DIR = path.join(__dirname, '..', 'commands', 'gsd');
const MANIFEST = loadSkillsManifest(REAL_COMMANDS_DIR);
const RESOLVED_CORE = resolveProfile({ modes: ['core'], manifest: MANIFEST });

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const MANIFEST_NAME = 'gsd-file-manifest.json';

// ─── Hooks dist ──────────────────────────────────────────────────────────────

const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');

const EXPECTED_SH_HOOKS = [
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
];

const EXPECTED_ALL_HOOKS = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-read-injection-scanner.js',
  'gsd-statusline.js',
  'gsd-workflow-guard.js',
  ...EXPECTED_SH_HOOKS,
];

// ─── Runtime metadata table ───────────────────────────────────────────────────
// Expected per-runtime directory names and global paths — used as typed IR
// so tests assert against structured data, not stdout strings.

const RUNTIME_META = {
  claude:       { localDir: '.claude',           globalSuffix: '.claude' },
  antigravity:  { localDir: '.agent',            globalSuffix: path.join('.gemini', 'antigravity') },
  augment:      { localDir: '.augment',          globalSuffix: '.augment' },
  cline:        { localDir: '.cline',            globalSuffix: '.cline' },
  codebuddy:    { localDir: '.codebuddy',        globalSuffix: '.codebuddy' },
  codex:        { localDir: '.codex',            globalSuffix: '.codex' },
  copilot:      { localDir: '.github',           globalSuffix: '.copilot' },
  cursor:       { localDir: '.cursor',           globalSuffix: '.cursor' },
  gemini:       { localDir: '.gemini',           globalSuffix: '.gemini' },
  hermes:       { localDir: '.hermes',           globalSuffix: '.hermes' },
  kilo:         { localDir: '.kilo',             globalSuffix: path.join('.config', 'kilo') },
  opencode:     { localDir: '.opencode',         globalSuffix: path.join('.config', 'opencode') },
  qwen:         { localDir: '.qwen',             globalSuffix: '.qwen' },
  trae:         { localDir: '.trae',             globalSuffix: '.trae' },
  windsurf:     { localDir: '.windsurf',         globalSuffix: path.join('.codeium', 'windsurf') },
};

// Runtimes that emit per-skill files under skills/ (not rules-based or commands-based)
const SKILL_RUNTIMES = [
  'claude', 'opencode', 'gemini', 'kilo', 'codex', 'copilot', 'antigravity',
  'cursor', 'windsurf', 'augment', 'trae', 'qwen', 'codebuddy',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

function simulateHookCopy(hooksSrc, hooksDest) {
  fs.mkdirSync(hooksDest, { recursive: true });
  for (const entry of fs.readdirSync(hooksSrc)) {
    const srcFile = path.join(hooksSrc, entry);
    if (!fs.statSync(srcFile).isFile()) continue;
    const destFile = path.join(hooksDest, entry);
    if (entry.endsWith('.js')) {
      fs.writeFileSync(destFile, fs.readFileSync(srcFile, 'utf8'));
      try { fs.chmodSync(destFile, 0o755); } catch { /* Windows */ }
    } else {
      fs.copyFileSync(srcFile, destFile);
      if (entry.endsWith('.sh')) {
        try { fs.chmodSync(destFile, 0o755); } catch { /* Windows */ }
      }
    }
  }
}

function runMinimalInstall({ runtime, scope, extraArgs = [] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `gsd-${runtime}-${scope}-`));
  try {
    const LOCAL_DIR_NAME = {
      claude: '.claude', opencode: '.opencode', gemini: '.gemini', kilo: '.kilo',
      codex: '.codex', copilot: '.github', antigravity: '.agent', cursor: '.cursor',
      windsurf: '.windsurf', augment: '.augment', trae: '.trae', qwen: '.qwen',
      codebuddy: '.codebuddy', cline: '.',
    };
    let configDir;
    let cwd = process.cwd();
    const args = [INSTALL_SCRIPT, `--${runtime}`];
    if (scope === 'global') {
      args.push('--global', '--config-dir', root);
      configDir = root;
    } else {
      args.push('--local');
      cwd = root;
      configDir = runtime === 'cline' ? root : path.join(root, LOCAL_DIR_NAME[runtime]);
    }
    args.push(...extraArgs);
    const result = spawnSync(process.execPath, args, {
      cwd, encoding: 'utf8',
      env: installerEnv({ HOME: root, USERPROFILE: root }),
    });
    assert.strictEqual(result.status, 0,
      `installer exited with status ${result.status} for ${runtime} --${scope}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
    const manifestPath = path.join(configDir, MANIFEST_NAME);
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : null;
    return { manifest, configDir, root, stdout: result.stdout, stderr: result.stderr };
  } catch (err) {
    fs.rmSync(root, { recursive: true, force: true });
    throw err;
  }
}

/** Build a clean env for spawned installer processes.
 *  Must strip GSD_TEST_MODE so the child runs the real install, not the no-op guard. */
function installerEnv(overrides = {}) {
  const env = { ...process.env, ...overrides };
  delete env.GSD_TEST_MODE;
  return env;
}

function manifestSkillSet(manifest) {
  if (!manifest || !manifest.files) return new Set();
  const out = new Set();
  for (const key of Object.keys(manifest.files)) {
    if (key.startsWith('skills/')) {
      const seg = key.split('/')[1].replace(/^gsd-/, '').replace(/\.md$/, '');
      out.add(seg);
    } else if (key.startsWith('command/')) {
      const file = key.split('/')[1];
      out.add(file.replace(/^gsd-/, '').replace(/\.md$/, ''));
    } else if (key.startsWith('commands/gsd/')) {
      const file = key.split('/')[2];
      out.add(file.replace(/\.(md|toml)$/, ''));
    }
  }
  return out;
}

function manifestAgentCount(manifest) {
  if (!manifest || !manifest.files) return 0;
  return Object.keys(manifest.files).filter((k) => k.startsWith('agents/')).length;
}

function collectSkillBasenamesOnDisk(configDir) {
  const out = new Set();
  const skillsDir = path.join(configDir, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith('gsd-')) {
        out.add(entry.name.replace(/^gsd-/, ''));
      } else if (entry.isFile() && entry.name.startsWith('gsd-') && entry.name.endsWith('.md')) {
        out.add(entry.name.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }
  const commandDir = path.join(configDir, 'command');
  if (fs.existsSync(commandDir)) {
    for (const file of fs.readdirSync(commandDir)) {
      if (file.startsWith('gsd-') && file.endsWith('.md')) {
        out.add(file.replace(/^gsd-/, '').replace(/\.md$/, ''));
      }
    }
  }
  const commandsGsdDir = path.join(configDir, 'commands', 'gsd');
  if (fs.existsSync(commandsGsdDir)) {
    for (const file of fs.readdirSync(commandsGsdDir)) {
      if (file.endsWith('.md') || file.endsWith('.toml')) {
        out.add(file.replace(/\.(md|toml)$/, ''));
      }
    }
  }
  return out;
}

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

// ─── Section 6: installRuntimeArtifacts — parameterised layout loop ──────────

const SKILLS_RUNTIMES_LAYOUT = [
  'claude', 'cursor', 'codex', 'copilot', 'antigravity',
  'windsurf', 'augment', 'trae', 'qwen', 'codebuddy',
];

const ALL_RUNTIMES_LAYOUT = [
  'claude', 'cursor', 'gemini', 'codex', 'copilot', 'antigravity',
  'windsurf', 'augment', 'trae', 'qwen', 'hermes', 'codebuddy',
  'cline', 'opencode', 'kilo',
];

function countPrefixedEntries(destDir, prefix) {
  if (!fs.existsSync(destDir)) return 0;
  return fs.readdirSync(destDir).filter(n => n.startsWith(prefix)).length;
}

function writeSkillEntry(destDir, prefix, stem) {
  const entryDir = path.join(destDir, `${prefix}${stem}`);
  fs.mkdirSync(entryDir, { recursive: true });
  fs.writeFileSync(path.join(entryDir, 'SKILL.md'), `# ${stem}\n`);
}

function writeCommandEntry(destDir, prefix, stem) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${prefix}${stem}.md`), `# ${stem}\n`);
}

describe('installRuntimeArtifacts — skills runtimes write gsd-prefixed skill dirs', () => {
  for (const runtime of SKILLS_RUNTIMES_LAYOUT) {
    test(`${runtime}: gsd-prefixed skill dirs in skills/`, (t) => {
      const configDir = createTempDir(`gsd-ial-${runtime}-`);
      t.after(() => cleanup(configDir));

      assert.strictEqual(typeof installRuntimeArtifacts, 'function');
      installRuntimeArtifacts(runtime, configDir, 'global', RESOLVED_CORE);

      const layout = resolveRuntimeArtifactLayout(runtime, configDir, 'global');
      const skillsKind = layout.kinds.find(k => k.kind === 'skills');
      assert.ok(skillsKind, `${runtime} must have skills kind`);

      const destDir = path.join(configDir, skillsKind.destSubpath);
      assert.ok(fs.existsSync(destDir));
      assert.ok(
        fs.existsSync(path.join(destDir, `${skillsKind.prefix}help`, 'SKILL.md')),
        `${runtime}: ${skillsKind.prefix}help/SKILL.md must exist`
      );

      if (RESOLVED_CORE.skills !== '*') {
        const prefixedCount = countPrefixedEntries(destDir, skillsKind.prefix || 'gsd-');
        assert.strictEqual(prefixedCount, RESOLVED_CORE.skills.size,
          `${runtime}: installed skill count must match profile`);
      }
    });
  }
});

describe('installRuntimeArtifacts — hermes nested layout', () => {
  test('hermes: skills/gsd/<stem>/SKILL.md, no gsd- prefix in name', (t) => {
    const configDir = createTempDir('gsd-ial-hermes-');
    t.after(() => cleanup(configDir));

    installRuntimeArtifacts('hermes', configDir, 'global', RESOLVED_CORE);

    const nestedDir = path.join(configDir, 'skills', 'gsd');
    assert.ok(fs.existsSync(nestedDir));
    assert.ok(fs.existsSync(path.join(nestedDir, 'help', 'SKILL.md')));
    assert.ok(!fs.existsSync(path.join(nestedDir, 'gsd-help')),
      'hermes must NOT have gsd-help prefix');
  });
});

describe('installRuntimeArtifacts — gemini commands layout', () => {
  test('gemini: commands/gsd/ created, no skills/', (t) => {
    const configDir = createTempDir('gsd-ial-gemini-');
    t.after(() => cleanup(configDir));

    installRuntimeArtifacts('gemini', configDir, 'global', RESOLVED_CORE);

    assert.ok(fs.existsSync(path.join(configDir, 'commands', 'gsd')));
    assert.ok(fs.existsSync(path.join(configDir, 'commands', 'gsd', 'help.md')));
    assert.ok(!fs.existsSync(path.join(configDir, 'skills')));
  });
});

describe('installRuntimeArtifacts — cline no-op', () => {
  test('cline: no kinds — call succeeds, no dirs created', (t) => {
    const configDir = createTempDir('gsd-ial-cline-');
    t.after(() => cleanup(configDir));

    assert.doesNotThrow(() => installRuntimeArtifacts('cline', configDir, 'global', RESOLVED_CORE));
    assert.ok(!fs.existsSync(path.join(configDir, 'skills')));
    assert.ok(!fs.existsSync(path.join(configDir, 'commands')));
  });
});

describe('installRuntimeArtifacts — opencode / kilo flat commands', () => {
  for (const runtime of ['opencode', 'kilo']) {
    test(`${runtime}: command/gsd-help.md exists`, (t) => {
      const configDir = createTempDir(`gsd-ial-${runtime}-`);
      t.after(() => cleanup(configDir));

      installRuntimeArtifacts(runtime, configDir, 'global', RESOLVED_CORE);

      const commandDir = path.join(configDir, 'command');
      assert.ok(fs.existsSync(commandDir));
      assert.ok(fs.existsSync(path.join(commandDir, 'gsd-help.md')));
    });
  }
});

// ─── Section 7: uninstallRuntimeArtifacts — all runtimes ─────────────────────

describe('uninstallRuntimeArtifacts — removes gsd-owned entries, preserves foreign', () => {
  for (const runtime of ALL_RUNTIMES_LAYOUT) {
    test(`${runtime}: gsd entries removed, foreign preserved`, (t) => {
      const configDir = createTempDir(`gsd-ual-${runtime}-`);
      t.after(() => cleanup(configDir));

      const { uninstallRuntimeArtifacts } = require('../bin/install.js');
      assert.strictEqual(typeof uninstallRuntimeArtifacts, 'function');

      const layout = resolveRuntimeArtifactLayout(runtime, configDir, 'global');

      if (layout.kinds.length === 0) {
        const foreignDir = path.join(configDir, 'foreign-dir');
        fs.mkdirSync(foreignDir, { recursive: true });
        fs.writeFileSync(path.join(foreignDir, 'keep.md'), '# keep\n');
        assert.doesNotThrow(() => uninstallRuntimeArtifacts(runtime, configDir, 'global'));
        assert.ok(fs.existsSync(path.join(foreignDir, 'keep.md')));
        return;
      }

      if (runtime === 'hermes') {
        const kind = layout.kinds[0];
        const destDir = path.join(configDir, kind.destSubpath);
        fs.mkdirSync(path.join(destDir, 'help'), { recursive: true });
        fs.writeFileSync(path.join(destDir, 'help', 'SKILL.md'), '# help\n');
        const siblingDir = path.join(configDir, 'skills', 'user-skill');
        fs.mkdirSync(siblingDir, { recursive: true });
        fs.writeFileSync(path.join(siblingDir, 'SKILL.md'), '# user\n');

        uninstallRuntimeArtifacts(runtime, configDir, 'global');

        assert.ok(!fs.existsSync(destDir));
        assert.ok(fs.existsSync(path.join(siblingDir, 'SKILL.md')));
        return;
      }

      for (const kind of layout.kinds) {
        const destDir = path.join(configDir, kind.destSubpath);
        fs.mkdirSync(destDir, { recursive: true });
        if (kind.kind === 'skills') {
          writeSkillEntry(destDir, kind.prefix, 'help');
          writeSkillEntry(destDir, kind.prefix, 'phase');
          const foreignDir = path.join(destDir, 'user-custom-skill');
          fs.mkdirSync(foreignDir, { recursive: true });
          fs.writeFileSync(path.join(foreignDir, 'SKILL.md'), '# user\n');
        } else {
          writeCommandEntry(destDir, kind.prefix, 'help');
          writeCommandEntry(destDir, kind.prefix, 'phase');
          fs.writeFileSync(path.join(destDir, 'user-custom.md'), '# user\n');
        }
      }

      uninstallRuntimeArtifacts(runtime, configDir, 'global');

      for (const kind of layout.kinds) {
        const destDir = path.join(configDir, kind.destSubpath);
        if (kind.kind === 'skills') {
          assert.ok(!fs.existsSync(path.join(destDir, `${kind.prefix}help`)));
          assert.ok(!fs.existsSync(path.join(destDir, `${kind.prefix}phase`)));
          assert.ok(fs.existsSync(path.join(destDir, 'user-custom-skill', 'SKILL.md')));
        } else {
          assert.ok(!fs.existsSync(path.join(destDir, `${kind.prefix}help.md`)));
          assert.ok(!fs.existsSync(path.join(destDir, `${kind.prefix}phase.md`)));
          assert.ok(fs.existsSync(path.join(destDir, 'user-custom.md')));
        }
      }
    });
  }
});

// ─── Section 8: Counter-test — unknown runtime is rejected (Contract 6) ──────

describe('Contract 6: unknown runtime is rejected', () => {
  test('resolveRuntimeArtifactLayout throws TypeError for unknown runtime', () => {
    assert.throws(
      () => resolveRuntimeArtifactLayout('unknown-runtime-xyz', '/tmp/test', 'global'),
      (err) => {
        assert.ok(err instanceof TypeError, 'must be TypeError');
        assert.ok(err.message.includes('Unknown runtime'), `message: ${err.message}`);
        return true;
      }
    );
  });

  test('parseRuntimeInput returns ["claude"] for unrecognised string (safe default)', () => {
    // parseRuntimeInput processes menu numbers, not runtime names directly;
    // an unrecognised token falls through to the default ["claude"].
    const result = parseRuntimeInput('unknown-xyz');
    assert.deepStrictEqual(result, ['claude']);
  });

  test('allRuntimes does not include any unrecognised value', () => {
    // Every entry in allRuntimes must be recognised by resolveRuntimeArtifactLayout
    for (const runtime of allRuntimes) {
      assert.doesNotThrow(
        () => resolveRuntimeArtifactLayout(runtime, '/tmp/test', 'global'),
        `${runtime} must be a recognised runtime`
      );
    }
  });
});

// ─── Section 9: install-profiles — MINIMAL_SKILL_ALLOWLIST ───────────────────

describe('install-profiles: MINIMAL_SKILL_ALLOWLIST', () => {
  test('contains exactly the main-loop core (frozen)', () => {
    assert.deepStrictEqual(
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
      ['discuss-phase', 'execute-phase', 'help', 'new-project', 'phase', 'plan-phase', 'update'],
    );
    assert.ok(Object.isFrozen(MINIMAL_SKILL_ALLOWLIST));
  });

  test('every allowlisted skill exists in commands/gsd/', () => {
    const commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      assert.ok(
        fs.existsSync(path.join(commandsDir, `${name}.md`)),
        `${name} is allowlisted but commands/gsd/${name}.md does not exist`,
      );
    }
  });
});

describe('install-profiles: isMinimalMode', () => {
  test('returns true only for "minimal"', () => {
    assert.strictEqual(isMinimalMode('minimal'), true);
    assert.strictEqual(isMinimalMode('full'), false);
    assert.strictEqual(isMinimalMode(''), false);
    assert.strictEqual(isMinimalMode(undefined), false);
    assert.strictEqual(isMinimalMode(null), false);
    assert.strictEqual(isMinimalMode('MINIMAL'), false);
  });
});

describe('install-profiles: shouldInstallSkill', () => {
  test('full mode admits every skill', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase', 'full'), true);
    assert.strictEqual(shouldInstallSkill('autonomous', 'full'), true);
    assert.strictEqual(shouldInstallSkill('arbitrary-future-name', 'full'), true);
  });

  test('minimal mode admits only allowlisted skills', () => {
    for (const name of MINIMAL_SKILL_ALLOWLIST) {
      assert.strictEqual(shouldInstallSkill(name, 'minimal'), true, name);
    }
    for (const denied of ['autonomous', 'do', 'progress', 'next', 'fast', 'quick']) {
      assert.strictEqual(shouldInstallSkill(denied, 'minimal'), false, denied);
    }
  });

  test('minimal mode rejects .md-suffixed names (callers must strip)', () => {
    assert.strictEqual(shouldInstallSkill('plan-phase.md', 'minimal'), false);
  });

  test('unknown mode falls through to full behavior', () => {
    for (const unknownMode of ['compact', 'tier2', 'CORE', 'Minimal', 'mini']) {
      assert.ok(shouldInstallSkill('autonomous', unknownMode),
        `unknown mode "${unknownMode}" should admit all skills`);
    }
  });
});

describe('install-profiles: stageSkillsForMode', () => {
  function createFixtureSkillsDir() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fixture-'));
    for (const name of ['plan-phase', 'execute-phase', 'autonomous', 'do', 'help',
      'new-project', 'phase', 'discuss-phase', 'update', 'progress']) {
      fs.writeFileSync(path.join(tmp, `${name}.md`), `# ${name}\n`);
    }
    return tmp;
  }

  test('full mode returns original src dir unchanged', () => {
    const src = createFixtureSkillsDir();
    try {
      assert.strictEqual(stageSkillsForMode(src, 'full'), src);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('minimal mode returns new dir with only allowlisted skills', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(staged, src);
      assert.deepStrictEqual(
        fs.readdirSync(staged).sort(),
        ['discuss-phase.md', 'execute-phase.md', 'help.md', 'new-project.md',
          'phase.md', 'plan-phase.md', 'update.md'],
      );
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode preserves file content byte-for-byte', () => {
    const src = createFixtureSkillsDir();
    let staged;
    try {
      staged = stageSkillsForMode(src, 'minimal');
      const original = fs.readFileSync(path.join(src, 'plan-phase.md'), 'utf8');
      const copied = fs.readFileSync(path.join(staged, 'plan-phase.md'), 'utf8');
      assert.strictEqual(copied, original);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });

  test('minimal mode against non-existent source returns source path', () => {
    const ghost = path.join(os.tmpdir(), 'gsd-stage-does-not-exist-' + Date.now());
    assert.strictEqual(stageSkillsForMode(ghost, 'minimal'), ghost);
  });

  test('minimal mode skips non-md files and subdirectories', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-mixed-'));
    let staged;
    try {
      fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
      fs.writeFileSync(path.join(src, 'README.txt'), 'not a skill\n');
      fs.mkdirSync(path.join(src, 'nested-dir'));
      fs.writeFileSync(path.join(src, 'nested-dir', 'plan-phase.md'), '# nested\n');
      staged = stageSkillsForMode(src, 'minimal');
      assert.deepStrictEqual(fs.readdirSync(staged), ['plan-phase.md']);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      if (staged) fs.rmSync(staged, { recursive: true, force: true });
    }
  });
});

describe('install-profiles: cleanupStagedSkills', () => {
  test('removes staged dirs created during process', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-cleanup-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const a = stageSkillsForMode(src, 'minimal');
      const b = stageSkillsForMode(src, 'minimal');
      assert.notStrictEqual(a, b);
      assert.ok(fs.existsSync(a));
      assert.ok(fs.existsSync(b));
      cleanupStagedSkills();
      assert.ok(!fs.existsSync(a));
      assert.ok(!fs.existsSync(b));
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
    }
  });

  test('is idempotent', () => {
    cleanupStagedSkills();
    cleanupStagedSkills();
  });

  test('exit handler registers at most once across many calls', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-exit-handler-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    try {
      const before = process.listenerCount('exit');
      for (let i = 0; i < 5; i++) stageSkillsForMode(src, 'minimal');
      const after = process.listenerCount('exit');
      assert.ok(after - before <= 1, `expected <=1 new exit listener, got ${after - before}`);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });

  test('mid-copy failure removes partial staged dir and re-throws', () => {
    cleanupStagedSkills();
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-stage-fail-'));
    fs.writeFileSync(path.join(src, 'plan-phase.md'), '# plan\n');
    fs.writeFileSync(path.join(src, 'execute-phase.md'), '# x\n');
    const realCopy = fs.copyFileSync;
    const realMkdtemp = fs.mkdtempSync;
    let stagedDir = null;
    fs.mkdtempSync = (prefix, ...rest) => {
      const out = realMkdtemp(prefix, ...rest);
      if (typeof prefix === 'string' && prefix.endsWith('gsd-minimal-skills-')) stagedDir = out;
      return out;
    };
    let copyCount = 0;
    fs.copyFileSync = (s, d) => {
      copyCount++;
      if (copyCount === 2) throw new Error('synthetic disk full');
      return realCopy(s, d);
    };
    try {
      assert.throws(() => stageSkillsForMode(src, 'minimal'), /synthetic disk full/);
      assert.notStrictEqual(stagedDir, null);
      assert.equal(fs.existsSync(stagedDir), false);
    } finally {
      fs.copyFileSync = realCopy;
      fs.mkdtempSync = realMkdtemp;
      fs.rmSync(src, { recursive: true, force: true });
      cleanupStagedSkills();
    }
  });
});

describe('install-profiles: allowlist scope guards', () => {
  test('every main-loop command is in the allowlist', () => {
    for (const required of ['new-project', 'discuss-phase', 'plan-phase', 'execute-phase']) {
      assert.ok(shouldInstallSkill(required, 'minimal'), `"${required}" must be in allowlist`);
    }
  });

  test('off-loop commands are NOT in the allowlist', () => {
    for (const offLoop of ['autonomous', 'ship', 'do', 'progress', 'next', 'fast', 'quick', 'debug', 'code-review', 'verify-work']) {
      assert.ok(!shouldInstallSkill(offLoop, 'minimal'), `"${offLoop}" must NOT be in allowlist`);
    }
  });
});

// ─── Section 10: --minimal install — per-runtime E2E (spawned) ───────────────

describe('install: --minimal honoured for every runtime in --global mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --global --minimal: mode=minimal, correct skills, zero agents`, () => {
      const { manifest, root } = runMinimalInstall({ runtime, scope: 'global', extraArgs: ['--minimal'] });
      try {
        assert.ok(manifest, `${runtime} global must produce manifest`);
        assert.strictEqual(manifest.mode, 'minimal');
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...MINIMAL_SKILL_ALLOWLIST].sort(),
        );
        assert.strictEqual(manifestAgentCount(manifest), 0);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: --minimal honoured for every runtime in --local mode', () => {
  for (const runtime of SKILL_RUNTIMES) {
    test(`${runtime} --local --minimal: mode=minimal, correct skills, zero agents`, () => {
      const { manifest, root } = runMinimalInstall({ runtime, scope: 'local', extraArgs: ['--minimal'] });
      try {
        assert.ok(manifest, `${runtime} local must produce manifest`);
        assert.strictEqual(manifest.mode, 'minimal');
        assert.deepStrictEqual(
          [...manifestSkillSet(manifest)].sort(),
          [...MINIMAL_SKILL_ALLOWLIST].sort(),
        );
        assert.strictEqual(manifestAgentCount(manifest), 0);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: Cline --minimal (rules-based, no skills/ dir)', () => {
  for (const scope of ['global', 'local']) {
    test(`cline --${scope} --minimal: mode=minimal, zero agents, .clinerules present`, () => {
      const { manifest, configDir, root } = runMinimalInstall({
        runtime: 'cline', scope, extraArgs: ['--minimal'],
      });
      try {
        assert.ok(manifest, 'cline must produce manifest');
        assert.strictEqual(manifest.mode, 'minimal');
        assert.strictEqual(manifestAgentCount(manifest), 0);
        assert.ok(fs.existsSync(path.join(configDir, '.clinerules')));
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    });
  }
});

describe('install: on-disk skill files match manifest for --minimal', () => {
  for (const runtime of SKILL_RUNTIMES) {
    for (const scope of ['global', 'local']) {
      test(`${runtime} --${scope} --minimal: on-disk matches manifest`, () => {
        const { manifest, configDir, root } = runMinimalInstall({
          runtime, scope, extraArgs: ['--minimal'],
        });
        try {
          assert.ok(manifest);
          const onDisk = collectSkillBasenamesOnDisk(configDir);
          const inManifest = manifestSkillSet(manifest);
          assert.deepStrictEqual([...onDisk].sort(), [...inManifest].sort());
          const agentsDir = path.join(configDir, 'agents');
          if (fs.existsSync(agentsDir)) {
            const gsdAgents = fs.readdirSync(agentsDir)
              .filter(f => f.startsWith('gsd-') && f.endsWith('.md'));
            assert.deepStrictEqual(gsdAgents, []);
          }
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
        }
      });
    }
  }
});

// ─── Section 11: --minimal manifest mode + downgrade ─────────────────────────

describe('install: manifest records mode for both profiles', () => {
  function manifestModeAfterInstall(extraArgs) {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-manifest-mode-'));
    try {
      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, ...extraArgs],
        { encoding: 'utf8', env: installerEnv() },
      );
      const manifestPath = path.join(targetDir, MANIFEST_NAME);
      if (!fs.existsSync(manifestPath)) return { mode: '<no manifest>', skillCount: 0, agentCount: 0 };
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const skillCount = new Set(
        Object.keys(m.files || {}).filter(k => k.startsWith('skills/')).map(k => k.split('/')[1]),
      ).size;
      const agentCount = Object.keys(m.files || {}).filter(k => k.startsWith('agents/')).length;
      return { mode: m.mode, skillCount, agentCount };
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  test('default install records mode: "full" with full skill+agent count', () => {
    const r = manifestModeAfterInstall([]);
    assert.strictEqual(r.mode, 'full');
    assert.ok(r.skillCount > 7);
    assert.ok(r.agentCount > 0);
  });

  test('--minimal records mode: "minimal" with exactly 7 skills and 0 agents', () => {
    const r = manifestModeAfterInstall(['--minimal']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 7);
    assert.strictEqual(r.agentCount, 0);
  });

  test('--core-only is an alias for --minimal', () => {
    const r = manifestModeAfterInstall(['--core-only']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 7);
    assert.strictEqual(r.agentCount, 0);
  });
});

describe('install-minimal-backcompat: PROFILES.core matches MINIMAL_SKILL_ALLOWLIST', () => {
  test('PROFILES.core contains the same 7 skills as MINIMAL_SKILL_ALLOWLIST', () => {
    assert.deepStrictEqual(
      [...PROFILES.core].sort(),
      [...MINIMAL_SKILL_ALLOWLIST].sort(),
    );
  });
});

describe('install-minimal-backcompat: --minimal and --profile=core produce same manifest', () => {
  function installAndGetManifest(extraArgs) {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-backcompat-'));
    try {
      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, ...extraArgs],
        { encoding: 'utf8', env: installerEnv() },
      );
      const manifestPath = path.join(targetDir, MANIFEST_NAME);
      if (!fs.existsSync(manifestPath)) return { mode: null, skillCount: 0, profileMarker: null };
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const skillCount = new Set(
        Object.keys(m.files || {}).filter(k => k.startsWith('skills/')).map(k => k.split('/')[1]),
      ).size;
      const markerPath = path.join(targetDir, '.gsd-profile');
      const profileMarker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : null;
      return { mode: m.mode, skillCount, profileMarker };
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  }

  test('--minimal produces mode "minimal" with exactly 7 skills', () => {
    const r = installAndGetManifest(['--minimal']);
    assert.strictEqual(r.mode, 'minimal');
    assert.strictEqual(r.skillCount, 7);
  });

  test('--minimal writes .gsd-profile marker "core"', () => {
    const r = installAndGetManifest(['--minimal']);
    assert.strictEqual(r.profileMarker, 'core');
  });

  test('default install writes .gsd-profile marker "full"', () => {
    const r = installAndGetManifest([]);
    assert.strictEqual(r.profileMarker, 'full');
  });

  test('--profile=core writes .gsd-profile marker "core"', () => {
    const r = installAndGetManifest(['--profile=core']);
    assert.strictEqual(r.profileMarker, 'core');
  });

  test('--profile=standard writes .gsd-profile marker "standard"', () => {
    const r = installAndGetManifest(['--profile=standard']);
    assert.strictEqual(r.profileMarker, 'standard');
  });
});

describe('install: Codex full → minimal downgrade cleans stale agent state', () => {
  test('--minimal removes stale .toml agents and strips [agents.gsd-*] from config.toml', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-codex-downgrade-'));
    try {
      const agentsDir = path.join(targetDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.toml'), 'name = "gsd-executor"\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.toml'), 'name = "gsd-planner"\n');
      fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');
      const codexConfig = [
        '# user-owned setting',
        'model = "gpt-5"',
        '',
        '# GSD Agent Configuration — managed by get-shit-done installer',
        '[agents.gsd-executor]',
        'cmd = "stale"',
        '',
        '[agents.gsd-planner]',
        'cmd = "stale"',
        '',
      ].join('\n');
      fs.writeFileSync(path.join(targetDir, 'config.toml'), codexConfig);

      const result = spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--codex', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8', env: installerEnv() },
      );
      assert.ok(result.stdout || result.stderr);

      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];
      assert.ok(!remaining.includes('gsd-executor.md'));
      assert.ok(!remaining.includes('gsd-planner.md'));
      assert.ok(!remaining.includes('gsd-executor.toml'));
      assert.ok(!remaining.includes('gsd-planner.toml'));
      assert.ok(remaining.includes('my-custom-agent.md'));

      const configPath = path.join(targetDir, 'config.toml');
      if (fs.existsSync(configPath)) {
        const config = fs.readFileSync(configPath, 'utf8');
        assert.ok(!config.includes('[agents.gsd-executor]'));
        assert.ok(!config.includes('[agents.gsd-planner]'));
        assert.ok(config.includes('model = "gpt-5"'));
      }
      assert.ok(fs.existsSync(configPath));
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

describe('install: Claude full → minimal downgrade removes stale agents', () => {
  test('--minimal removes stale gsd-*.md agents but preserves user-owned agents', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-claude-downgrade-'));
    try {
      const agentsDir = path.join(targetDir, 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, 'gsd-executor.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), 'stale\n');
      fs.writeFileSync(path.join(agentsDir, 'my-custom-agent.md'), 'user owns this\n');

      spawnSync(
        process.execPath,
        [INSTALL_SCRIPT, '--claude', '--global', '--config-dir', targetDir, '--minimal'],
        { encoding: 'utf8', env: installerEnv() },
      );

      const remaining = fs.existsSync(agentsDir) ? fs.readdirSync(agentsDir) : [];
      assert.ok(!remaining.includes('gsd-executor.md'));
      assert.ok(!remaining.includes('gsd-planner.md'));
      assert.ok(remaining.includes('my-custom-agent.md'));
      assert.deepStrictEqual(remaining.filter(f => f.startsWith('gsd-')), []);
    } finally {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
  });
});

// ─── Section 12: Legacy migrations in installRuntimeArtifacts ────────────────

describe('installRuntimeArtifacts — legacy migrations run before layout copy', () => {
  test('claude: legacy commands/gsd/dev-preferences.md migrated AND new skills written', (t) => {
    const configDir = createTempDir('gsd-legacy-install-');
    t.after(() => cleanup(configDir));

    const legacyDir = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'dev-preferences.md'), '# My dev prefs\n');

    installRuntimeArtifacts('claude', configDir, 'global', RESOLVED_CORE);

    assert.ok(!fs.existsSync(legacyDir));
    assert.ok(fs.existsSync(path.join(configDir, 'skills', 'gsd-dev-preferences', 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(configDir, 'skills', 'gsd-help', 'SKILL.md')));
  });

  test('hermes: legacy flat skills/gsd-*/ migrated AND new nested skills/gsd/<stem>/ written', (t) => {
    const configDir = createTempDir('gsd-legacy-hermes-install-');
    t.after(() => cleanup(configDir));

    const legacyFlatHelp = path.join(configDir, 'skills', 'gsd-help');
    fs.mkdirSync(legacyFlatHelp, { recursive: true });
    fs.writeFileSync(path.join(legacyFlatHelp, 'SKILL.md'), '# legacy help\n');

    installRuntimeArtifacts('hermes', configDir, 'global', RESOLVED_CORE);

    assert.ok(!fs.existsSync(legacyFlatHelp));
    assert.ok(fs.existsSync(path.join(configDir, 'skills', 'gsd', 'help', 'SKILL.md')));
  });
});

describe('uninstallRuntimeArtifacts — legacy cleanup runs before layout removal', () => {
  test('hermes: both flat and nested layouts removed', (t) => {
    const { uninstallRuntimeArtifacts } = require('../bin/install.js');
    const configDir = createTempDir('gsd-legacy-uninstall-hermes-');
    t.after(() => cleanup(configDir));

    const skillsDir = path.join(configDir, 'skills');
    const flatHelp = path.join(skillsDir, 'gsd-help');
    fs.mkdirSync(flatHelp, { recursive: true });
    fs.writeFileSync(path.join(flatHelp, 'SKILL.md'), '# legacy flat\n');

    const nestedGsd = path.join(skillsDir, 'gsd');
    fs.mkdirSync(path.join(nestedGsd, 'help'), { recursive: true });
    fs.writeFileSync(path.join(nestedGsd, 'help', 'SKILL.md'), '# nested help\n');

    const userSkill = path.join(skillsDir, 'user-skill');
    fs.mkdirSync(userSkill, { recursive: true });
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), '# user\n');

    uninstallRuntimeArtifacts('hermes', configDir, 'global');

    assert.ok(!fs.existsSync(flatHelp));
    assert.ok(!fs.existsSync(nestedGsd));
    assert.ok(fs.existsSync(path.join(userSkill, 'SKILL.md')));
  });

  test('claude: legacy commands/gsd/ cleaned AND new skills/ entries removed', (t) => {
    const { uninstallRuntimeArtifacts } = require('../bin/install.js');
    const configDir = createTempDir('gsd-legacy-uninstall-claude-');
    t.after(() => cleanup(configDir));

    const skillsDir = path.join(configDir, 'skills');
    const gsdHelp = path.join(skillsDir, 'gsd-help');
    fs.mkdirSync(gsdHelp, { recursive: true });
    fs.writeFileSync(path.join(gsdHelp, 'SKILL.md'), '# help\n');

    const legacyDir = path.join(configDir, 'commands', 'gsd');
    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'help.md'), '# legacy\n');

    const userSkill = path.join(skillsDir, 'user-skill');
    fs.mkdirSync(userSkill, { recursive: true });
    fs.writeFileSync(path.join(userSkill, 'SKILL.md'), '# user\n');

    uninstallRuntimeArtifacts('claude', configDir, 'global');

    assert.ok(!fs.existsSync(gsdHelp));
    assert.ok(!fs.existsSync(legacyDir));
    assert.ok(fs.existsSync(path.join(userSkill, 'SKILL.md')));
  });
});

// ─── Section 13: Hooks copy, manifest, uninstall settings cleanup ─────────────

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], { encoding: 'utf-8', stdio: 'pipe' });
});

const isWindows = process.platform === 'win32';

describe('#1755: .sh hooks are copied and executable after install', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = createTempDir('gsd-hook-copy-'); });
  afterEach(() => { cleanup(tmpDir); });

  test('all expected hooks are copied from hooks/dist/ to target', () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const hook of EXPECTED_ALL_HOOKS) {
      assert.ok(fs.existsSync(path.join(hooksDest, hook)), `${hook} should exist`);
    }
  });

  test('.sh hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const sh of EXPECTED_SH_HOOKS) {
      const stat = fs.statSync(path.join(hooksDest, sh));
      assert.ok((stat.mode & 0o111) !== 0, `${sh} should be executable`);
    }
  });

  test('.js hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);
    for (const js of EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'))) {
      const stat = fs.statSync(path.join(hooksDest, js));
      assert.ok((stat.mode & 0o111) !== 0, `${js} should be executable`);
    }
  });
});

describe('install.js source correctness', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('.sh files get chmod after copyFileSync', () => {
    assert.ok(src.includes("if (entry.endsWith('.sh'))"));
  });

  test('Codex hook uses correct filename gsd-check-update.js', () => {
    assert.ok(!src.match(/['"]gsd-update-check\.js['"]/));
  });

  test('Codex hook path does not use get-shit-done/hooks/ subdirectory', () => {
    assert.ok(!src.includes("'get-shit-done', 'hooks', 'gsd-check-update"));
  });

  test('cache invalidation uses ~/.cache/gsd/ path', () => {
    assert.ok(src.includes("os.homedir(), '.cache', 'gsd'"));
  });

  test('manifest tracks .sh hook files', () => {
    assert.ok(src.includes("file.endsWith('.sh')"));
  });

  test('gsd-workflow-guard.js is in uninstall hook list', () => {
    const m = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(m, 'gsdHooks array must exist');
    assert.ok(m[1].includes('gsd-workflow-guard.js'));
  });

  test('phantom gsd-check-update.sh is not in uninstall hook list', () => {
    const m = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(m);
    assert.ok(!m[1].includes('gsd-check-update.sh'));
  });

  test('isGsdHookCommand covers all GSD hook names', () => {
    const names = [
      'gsd-check-update', 'gsd-statusline', 'gsd-session-state',
      'gsd-context-monitor', 'gsd-phase-boundary', 'gsd-prompt-guard',
      'gsd-read-guard', 'gsd-validate-commit', 'gsd-workflow-guard',
    ];
    for (const name of names) {
      assert.ok(src.includes(`'${name}'`) || src.includes(`"${name}"`));
    }
  });

  test('no duplicate isCursor or isWindsurf branches in uninstall', () => {
    const uninstallStart = src.indexOf('function uninstall(');
    const uninstallEnd = src.indexOf('function verifyInstalled(');
    assert.ok(uninstallStart !== -1);
    assert.ok(uninstallEnd !== -1);
    const block = src.substring(uninstallStart, uninstallEnd);
    assert.strictEqual((block.match(/else if \(isCursor\)/g) || []).length, 0);
    assert.strictEqual((block.match(/else if \(isWindsurf\)/g) || []).length, 0);
  });
});

describe('writeManifest includes .sh hooks', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = createTempDir('gsd-manifest-');
    const hooksDir = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDir);
  });
  afterEach(() => { cleanup(tmpDir); });

  test('manifest contains .sh hook entries', () => {
    writeManifest(tmpDir, 'claude');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'utf8'));
    for (const sh of EXPECTED_SH_HOOKS) {
      assert.ok(manifest.files['hooks/' + sh], `manifest should contain hash for ${sh}`);
    }
  });

  test('manifest contains .js hook entries', () => {
    writeManifest(tmpDir, 'claude');
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'gsd-file-manifest.json'), 'utf8'));
    for (const js of EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'))) {
      assert.ok(manifest.files['hooks/' + js], `manifest should contain hash for ${js}`);
    }
  });
});

describe('uninstall settings cleanup preserves user hooks', () => {
  const isGsdHook = (cmd) =>
    cmd && (cmd.includes('gsd-check-update') || cmd.includes('gsd-statusline') ||
      cmd.includes('gsd-session-state') || cmd.includes('gsd-context-monitor') ||
      cmd.includes('gsd-phase-boundary') || cmd.includes('gsd-prompt-guard') ||
      cmd.includes('gsd-read-guard') || cmd.includes('gsd-validate-commit') ||
      cmd.includes('gsd-workflow-guard'));

  function filterGsdHooks(entries) {
    return entries
      .map(e => {
        if (!e.hooks || !Array.isArray(e.hooks)) return e;
        e.hooks = e.hooks.filter(h => !isGsdHook(h.command));
        return e.hooks.length > 0 ? e : null;
      })
      .filter(Boolean);
  }

  test('mixed entry preserves user hooks', () => {
    const entries = [{
      matcher: 'Bash',
      hooks: [
        { type: 'command', command: 'node /path/gsd-prompt-guard.js' },
        { type: 'command', command: 'bash /my/custom-lint.sh' },
      ],
    }];
    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].hooks.length, 1);
    assert.ok(result[0].hooks[0].command.includes('custom-lint'));
  });

  test('entry with only GSD hooks is fully removed', () => {
    const entries = [{
      hooks: [
        { type: 'command', command: 'node /path/gsd-check-update.js' },
        { type: 'command', command: 'node /path/gsd-statusline.js' },
      ],
    }];
    assert.strictEqual(filterGsdHooks(entries).length, 0);
  });

  test('entry with only user hooks is untouched', () => {
    const entries = [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash /my/pre-check.sh' }] }];
    const result = filterGsdHooks(entries);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].hooks.length, 1);
  });

  test('non-array hook entries are preserved (#1825)', () => {
    const entries = [
      { type: 'custom', command: 'echo hello' },
      { matcher: 'Bash', hooks: [{ type: 'command', command: 'node /path/gsd-prompt-guard.js' }] },
      { url: 'https://example.com/webhook' },
    ];
    const result = filterGsdHooks(JSON.parse(JSON.stringify(entries)));
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result[0], { type: 'custom', command: 'echo hello' });
    assert.deepStrictEqual(result[1], { url: 'https://example.com/webhook' });
  });

  test('all GSD hook names are recognised', () => {
    const cmds = [
      'node /path/gsd-check-update.js', 'node /path/gsd-statusline.js',
      'bash /path/gsd-session-state.sh', 'node /path/gsd-context-monitor.js',
      'bash /path/gsd-phase-boundary.sh', 'node /path/gsd-prompt-guard.js',
      'node /path/gsd-read-guard.js', 'bash /path/gsd-validate-commit.sh',
      'node /path/gsd-workflow-guard.js',
    ];
    for (const cmd of cmds) {
      assert.ok(isGsdHook(cmd), `should recognise: ${cmd}`);
    }
  });
});

describe('Codex legacy gsd-update-check migration', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');

  test('install.js strips legacy gsd-update-check hook blocks', () => {
    assert.ok(src.includes('gsd-update-check') && src.includes('replace('));
  });

  test('migration regex removes LF legacy hook block', () => {
    const legacyBlock = ['[features]', 'codex_hooks = true', '',
      '# GSD Hooks', '[[hooks]]', 'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"', ''].join('\n');
    let content = legacyBlock.replace(
      /\n# GSD Hooks\n\[\[hooks\]\]\nevent = "SessionStart"\ncommand = "node [^\n]*gsd-update-check\.js"\n/g, '\n',
    );
    assert.ok(!content.includes('gsd-update-check'));
    assert.ok(content.includes('[features]'));
  });

  test('migration regex removes CRLF legacy hook block', () => {
    const legacyBlock = ['[features]', 'codex_hooks = true', '',
      '# GSD Hooks', '[[hooks]]', 'event = "SessionStart"',
      'command = "node /old/path/gsd-update-check.js"', ''].join('\r\n');
    let content = legacyBlock.replace(
      /\r\n# GSD Hooks\r\n\[\[hooks\]\]\r\nevent = "SessionStart"\r\ncommand = "node [^\r\n]*gsd-update-check\.js"\r\n/g, '\r\n',
    );
    assert.ok(!content.includes('gsd-update-check'));
    assert.ok(content.includes('[features]'));
  });
});
