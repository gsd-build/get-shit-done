/**
 * Regression test for #3571: configuration.generated.cjs used the source
 * checkout sdk/shared path only, which breaks installed gsd-tools.cjs because
 * runtime installs copy get-shit-done/ but not sdk/.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const CONFIGURATION_CJS = path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'configuration.generated.cjs');
const SDK_SHARED_DIR = path.join(REPO_ROOT, 'sdk', 'shared');

const { install } = require('../bin/install.js');

const { createTempDir } = require('./helpers.cjs');
const makeTmpDir = () => createTempDir('gsd-3571-');

function silenceConsole(fn) {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

describe('bug #3571: configuration generated manifests resolve in install layout', () => {
  let tmpRoot;
  let savedHome;
  let savedUserProfile;
  let savedExplicitConfigDir;

  beforeEach(() => {
    tmpRoot = makeTmpDir();
    savedHome = process.env.HOME;
    // On Windows, os.homedir() reads USERPROFILE; install() resolves via it.
    savedUserProfile = process.env.USERPROFILE;
    savedExplicitConfigDir = process.env.GSD_EXPLICIT_CONFIG_DIR;
    delete process.env.GSD_EXPLICIT_CONFIG_DIR;
  });

  afterEach(() => {
    process.env.HOME = savedHome;
    if (savedUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = savedUserProfile;
    if (savedExplicitConfigDir === undefined) {
      delete process.env.GSD_EXPLICIT_CONFIG_DIR;
    } else {
      process.env.GSD_EXPLICIT_CONFIG_DIR = savedExplicitConfigDir;
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });

  test('co-located bin/shared manifests let configuration.generated.cjs load without sdk/shared', () => {
    const gsdBinDir = path.join(tmpRoot, '.codex', 'get-shit-done', 'bin');
    const gsdLibDir = path.join(gsdBinDir, 'lib');
    const gsdSharedDir = path.join(gsdBinDir, 'shared');
    fs.mkdirSync(gsdLibDir, { recursive: true });
    fs.mkdirSync(gsdSharedDir, { recursive: true });

    const installedCjs = path.join(gsdLibDir, 'configuration.generated.cjs');
    fs.copyFileSync(CONFIGURATION_CJS, installedCjs);
    fs.copyFileSync(
      path.join(SDK_SHARED_DIR, 'config-defaults.manifest.json'),
      path.join(gsdSharedDir, 'config-defaults.manifest.json')
    );
    fs.copyFileSync(
      path.join(SDK_SHARED_DIR, 'config-schema.manifest.json'),
      path.join(gsdSharedDir, 'config-schema.manifest.json')
    );

    delete require.cache[installedCjs];
    let mod;
    assert.doesNotThrow(() => {
      mod = require(installedCjs);
    }, 'installed configuration.generated.cjs must not require ~/.codex/sdk/shared');

    assert.ok(mod.VALID_CONFIG_KEYS.has('workflow.plan_review_convergence'));
  });

  test('post-install: install() copies configuration manifests to co-located bin/shared', () => {
    process.env.HOME = tmpRoot;
    process.env.USERPROFILE = tmpRoot;

    silenceConsole(() => {
      install(true, 'codex');
    });

    const sharedDir = path.join(tmpRoot, '.codex', 'get-shit-done', 'bin', 'shared');
    for (const fileName of ['config-defaults.manifest.json', 'config-schema.manifest.json']) {
      const installedManifest = path.join(sharedDir, fileName);
      assert.ok(fs.existsSync(installedManifest), `${fileName} must be copied to ${sharedDir}`);
      assert.doesNotThrow(() => {
        JSON.parse(fs.readFileSync(installedManifest, 'utf8'));
      }, `${fileName} must be valid JSON`);
    }

    const installedCjs = path.join(
      tmpRoot,
      '.codex',
      'get-shit-done',
      'bin',
      'lib',
      'configuration.generated.cjs'
    );

    delete require.cache[installedCjs];
    assert.doesNotThrow(() => {
      require(installedCjs);
    }, 'post-install configuration.generated.cjs must load from co-located manifests');
  });
});
