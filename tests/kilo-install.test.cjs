/**
 * GSD Tools Tests - Kilo Install Plumbing
 *
 * Tests for Kilo runtime directory resolution, config paths,
 * permission config, and installer source integration.
 */

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { createTempProject, cleanup } = require('./helpers.cjs');
const {
  getDirName,
  getGlobalDir,
  getConfigDirFromHome,
  resolveKiloConfigPath,
  configureKiloPermissions,
} = require('../bin/install.js');

describe('getDirName (Kilo)', () => {
  test('returns .kilo for kilo', () => {
    assert.strictEqual(getDirName('kilo'), '.kilo');
  });
});

describe('getConfigDirFromHome (Kilo)', () => {
  test('returns .kilo for local installs', () => {
    assert.strictEqual(getConfigDirFromHome('kilo', false), "'.kilo'");
  });

  test('returns .config, kilo for global installs', () => {
    assert.strictEqual(getConfigDirFromHome('kilo', true), "'.config', 'kilo'");
  });
});

describe('getGlobalDir (Kilo)', () => {
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
    if (savedEnv.KILO_CONFIG_DIR === undefined) {
      delete process.env.KILO_CONFIG_DIR;
    } else {
      process.env.KILO_CONFIG_DIR = savedEnv.KILO_CONFIG_DIR;
    }

    if (savedEnv.KILO_CONFIG === undefined) {
      delete process.env.KILO_CONFIG;
    } else {
      process.env.KILO_CONFIG = savedEnv.KILO_CONFIG;
    }

    if (savedEnv.XDG_CONFIG_HOME === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = savedEnv.XDG_CONFIG_HOME;
    }
  });

  test('returns ~/.config/kilo by default', () => {
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), '.config', 'kilo'));
  });

  test('respects KILO_CONFIG_DIR env var', () => {
    process.env.KILO_CONFIG_DIR = '~/custom-kilo';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'custom-kilo'));
  });

  test('falls back to XDG_CONFIG_HOME/kilo', () => {
    process.env.XDG_CONFIG_HOME = '~/xdg-config';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'xdg-config', 'kilo'));
  });

  test('uses dirname(KILO_CONFIG) when KILO_CONFIG_DIR is unset', () => {
    process.env.KILO_CONFIG = '~/profiles/work/kilo.jsonc';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'profiles', 'work'));
  });

  test('KILO_CONFIG_DIR takes precedence over KILO_CONFIG', () => {
    process.env.KILO_CONFIG_DIR = '~/custom-kilo';
    process.env.KILO_CONFIG = '~/profiles/work/kilo.jsonc';
    assert.strictEqual(getGlobalDir('kilo'), path.join(os.homedir(), 'custom-kilo'));
  });

  test('explicit config-dir overrides env vars', () => {
    process.env.KILO_CONFIG_DIR = '~/from-env';
    process.env.XDG_CONFIG_HOME = '~/xdg-config';
    assert.strictEqual(getGlobalDir('kilo', '/explicit/kilo'), '/explicit/kilo');
  });
});

describe('Kilo config file helpers', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject('gsd-kilo-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('resolveKiloConfigPath prefers kilo.jsonc when present', () => {
    const configDir = path.join(tmpDir, '.kilo');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'kilo.jsonc'), '{\n  // comment\n}\n');

    assert.strictEqual(resolveKiloConfigPath(configDir), path.join(configDir, 'kilo.jsonc'));
  });

  test('resolveKiloConfigPath falls back to kilo.json', () => {
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
    if (savedEnv.KILO_CONFIG_DIR === undefined) {
      delete process.env.KILO_CONFIG_DIR;
    } else {
      process.env.KILO_CONFIG_DIR = savedEnv.KILO_CONFIG_DIR;
    }

    if (savedEnv.XDG_CONFIG_HOME === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = savedEnv.XDG_CONFIG_HOME;
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
    fs.writeFileSync(configPath, '{\n  // existing config\n  "permission": {\n    "bash": "ask",\n  },\n}\n');

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

describe('Source code integration (Kilo)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'install.js'), 'utf8');
  const updateWorkflowSrc = fs.readFileSync(path.join(__dirname, '..', 'get-shit-done', 'workflows', 'update.md'), 'utf8');
  // #2790: reapply-patches.md command was absorbed into update.md --reapply.
  // The Kilo-specific env-var checks (KILO_CONFIG_DIR, KILO_CONFIG, XDG_CONFIG_HOME)
  // now live in the update.md workflow (which covers both --sync and --reapply paths).
  const reapplyPatchesSrc = updateWorkflowSrc;

  test('--kilo flag parsing exists', () => {
    assert.ok(src.includes("args.includes('--kilo')"), '--kilo flag parsed');
  });

  test('help text includes --kilo', () => {
    assert.ok(src.includes('Install for Kilo only'), 'help text includes Kilo option');
  });

  test('--all array includes kilo', () => {
    assert.ok(src.includes("'kilo'"), '--all includes kilo runtime');
  });

  test('promptRuntime runtimeMap has Kilo as option 10', () => {
    assert.ok(src.includes("'10': 'kilo'"), 'runtimeMap has 10 -> kilo');
  });

  test('prompt text shows Kilo above OpenCode without marketing copy', () => {
    assert.ok(src.includes('10${reset}) Kilo'), 'prompt lists Kilo as option 10');
    assert.ok(!src.includes('the #1 AI coding platform on OpenRouter'), 'prompt does not include marketing tagline');
  });

  test('hooks are skipped for Kilo', () => {
    assert.ok(src.includes('!isOpencode && !isKilo'), 'hooks skip check includes kilo');
  });

  test('settings.json write excludes Kilo', () => {
    assert.ok(src.includes('!isCodex && !isCopilot && !isKilo && !isCursor && !isWindsurf'), 'settings write excludes kilo');
  });

  test('agent path replacement does not exclude Kilo', () => {
    assert.ok(src.includes('if (!isCopilot && !isAntigravity)'), 'generic agent path replacement still applies');
  });

  test('finishInstall passes the actual config dir to Kilo permissions', () => {
    assert.ok(src.includes('configureKiloPermissions(isGlobal, configDir);'), 'Kilo permission config uses actual install dir');
  });

  test('uninstall cleans Kilo permissions from the resolved target dir', () => {
    assert.ok(src.includes('const configPath = resolveKiloConfigPath(targetDir);'), 'Kilo uninstall cleanup uses targetDir');
  });

  test('update workflow checks preferred custom config dirs before defaults', () => {
    assert.ok(updateWorkflowSrc.includes('PREFERRED_CONFIG_DIR'), 'workflow tracks preferred config dir');
    assert.ok(updateWorkflowSrc.includes('kilo.jsonc'), 'workflow infers Kilo from config files');
    assert.ok(updateWorkflowSrc.includes('ENV_RUNTIME_DIRS'), 'workflow checks env-derived config dirs');
    assert.ok(updateWorkflowSrc.includes('KILO_CONFIG'), 'workflow checks KILO_CONFIG');
  });

  test('reapply-patches checks Kilo custom config env vars first', () => {
    assert.ok(reapplyPatchesSrc.includes('KILO_CONFIG_DIR'), 'reapply-patches checks KILO_CONFIG_DIR');
    assert.ok(reapplyPatchesSrc.includes('KILO_CONFIG'), 'reapply-patches checks KILO_CONFIG');
    assert.ok(reapplyPatchesSrc.includes('XDG_CONFIG_HOME'), 'reapply-patches checks XDG_CONFIG_HOME');
  });
});
