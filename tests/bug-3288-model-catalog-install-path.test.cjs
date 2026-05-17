/**
 * Regression test for #3288: model-catalog.cjs uses brittle relative path
 * that breaks after install.
 *
 * Repro:
 *   After `node bin/install.js --global --claude`, the installed
 *   `~/.claude/get-shit-done/bin/lib/model-catalog.cjs` tries:
 *     require(path.join(__dirname, '..', '..', '..', 'sdk', 'shared', 'model-catalog.json'))
 *   which resolves to `~/.claude/sdk/shared/model-catalog.json`.
 *   The installer copies `get-shit-done/` but never copies `sdk/shared/`,
 *   so the require throws MODULE_NOT_FOUND.
 *
 * Fix contract:
 *   1. model-catalog.cjs must use a resolve-chain that checks a co-located
 *      path first (bin/shared/model-catalog.json) before the legacy
 *      source-repo path.
 *   2. bin/install.js must copy sdk/shared/model-catalog.json into
 *      get-shit-done/bin/shared/model-catalog.json (co-located inside the
 *      get-shit-done/ payload).
 *
 * Both halves must be true for the install layout to work.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.join(__dirname, '..');
const MODEL_CATALOG_CJS = path.join(REPO_ROOT, 'get-shit-done', 'bin', 'lib', 'model-catalog.cjs');
const MODEL_CATALOG_JSON = path.join(REPO_ROOT, 'sdk', 'shared', 'model-catalog.json');

const { install } = require('../bin/install.js');

// ─── helpers ─────────────────────────────────────────────────────────────────

const { createTempDir, cleanup } = require('./helpers.cjs');
const makeTmpDir = createTempDir;

const rmTmpDir = cleanup;

/**
 * Silence console output during install to avoid noise in test output.
 */
function silenceConsole(fn) {
  const orig = {
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
    console.log = orig.log;
    console.warn = orig.warn;
    console.error = orig.error;
  }
}

// ─── test 1: fake-install layout reproduces MODULE_NOT_FOUND ────────────────
//
// Build a fake post-install layout that mirrors what the OLD install did:
//   <tmp>/.claude/get-shit-done/bin/lib/model-catalog.cjs  (copy of real file)
//   <tmp>/.claude/sdk/shared/model-catalog.json            ABSENT
//
// Then attempt to require model-catalog.cjs from that layout.
// Under the old path scheme (3 levels up → sdk/shared/) this should throw.
// After the fix, if we DON'T also copy the json, it should still throw — this
// confirms the co-located path IS required.

describe('bug #3288: model-catalog.cjs install-layout resolution', () => {
  let tmpRoot;
  let savedHome;
  let savedUserProfile;
  let savedExplicitConfigDir;

  beforeEach(() => {
    tmpRoot = makeTmpDir('gsd-3288-');
    savedHome = process.env.HOME;
    // On Windows, os.homedir() reads USERPROFILE (and HOMEDRIVE+HOMEPATH), NOT
    // HOME. install() resolves the install destination via os.homedir(), so the
    // tests must also redirect USERPROFILE → tmpRoot on win32 to keep the
    // installer writing inside the fixture.
    savedUserProfile = process.env.USERPROFILE;
    // Stash and clear explicitConfigDir via env so install() picks up our tmp dir.
    // Must delete (not just save) so any CI-set value doesn't leak into install()
    // and target a different directory than tmpRoot (CR finding, PR #3293).
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
    rmTmpDir(tmpRoot);
  });

  // ── test A ──────────────────────────────────────────────────────────────────
  test('OLD layout (3-level __dirname, no co-located json) fails to require', () => {
    // Build the old install layout manually:
    //   <tmpRoot>/.claude/get-shit-done/bin/lib/model-catalog.cjs  (copy of the real CJS)
    //   sdk/shared/model-catalog.json                              ABSENT
    const gsdLibDir = path.join(tmpRoot, '.claude', 'get-shit-done', 'bin', 'lib');
    fs.mkdirSync(gsdLibDir, { recursive: true });

    // Write a minimal model-catalog.cjs that uses ONLY the 3-level path (the old/broken path).
    const oldCjsContent = `'use strict';
const path = require('node:path');
// This is the BRITTLE path: 3 levels up from bin/lib → sdk/shared/
const catalog = require(path.join(__dirname, '..', '..', '..', 'sdk', 'shared', 'model-catalog.json'));
module.exports = { catalog };
`;
    const catalogCjsPath = path.join(gsdLibDir, 'model-catalog.cjs');
    fs.writeFileSync(catalogCjsPath, oldCjsContent);

    // Deliberately do NOT create sdk/shared/model-catalog.json (simulates missing file post-install).

    // Require must fail with MODULE_NOT_FOUND.
    assert.throws(
      () => {
        // Delete from require cache to force a fresh load.
        delete require.cache[catalogCjsPath];
        require(catalogCjsPath);
      },
      (err) => {
        assert.ok(
          err.code === 'MODULE_NOT_FOUND' || err.message.includes('model-catalog.json'),
          `Expected MODULE_NOT_FOUND or model-catalog.json error, got: ${err.message}`,
        );
        return true;
      },
      'OLD 3-level path must fail when sdk/shared/model-catalog.json is not present (install layout)',
    );
  });

  // ── test B ──────────────────────────────────────────────────────────────────
  test('NEW layout (co-located bin/shared/model-catalog.json) resolves correctly', () => {
    // Build the new install layout:
    //   <tmpRoot>/.claude/get-shit-done/bin/lib/model-catalog.cjs (copy of real CJS)
    //   <tmpRoot>/.claude/get-shit-done/bin/shared/model-catalog.json (co-located copy)
    const gsdBinDir = path.join(tmpRoot, '.claude', 'get-shit-done', 'bin');
    const gsdLibDir = path.join(gsdBinDir, 'lib');
    const gsdSharedDir = path.join(gsdBinDir, 'shared');
    fs.mkdirSync(gsdLibDir, { recursive: true });
    fs.mkdirSync(gsdSharedDir, { recursive: true });

    // Copy the real model-catalog.cjs into the fake install.
    const catalogCjsPath = path.join(gsdLibDir, 'model-catalog.cjs');
    fs.copyFileSync(MODEL_CATALOG_CJS, catalogCjsPath);

    // Copy the real model-catalog.json to the co-located path.
    fs.copyFileSync(MODEL_CATALOG_JSON, path.join(gsdSharedDir, 'model-catalog.json'));

    // Require must succeed and expose catalog with expected shape.
    delete require.cache[catalogCjsPath];
    let mod;
    assert.doesNotThrow(() => {
      mod = require(catalogCjsPath);
    }, 'NEW co-located layout must not throw MODULE_NOT_FOUND');

    assert.ok(mod.catalog, 'module must export catalog');
    assert.ok(Array.isArray(mod.VALID_PROFILES), 'module must export VALID_PROFILES');
    assert.ok(mod.VALID_PROFILES.length > 0, 'VALID_PROFILES must not be empty');
  });

  // ── test C ──────────────────────────────────────────────────────────────────
  test('post-install: install() copies model-catalog.json to co-located path', () => {
    // Run the real installer against a tmp target dir, then assert the co-located
    // json is present and parseable.
    const claudeDir = path.join(tmpRoot, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    process.env.HOME = tmpRoot;
    process.env.USERPROFILE = tmpRoot;

    // Capture process.exit to prevent the test from being killed.
    const origExit = process.exit;
    let exitCalled = false;
    process.exit = (code) => {
      exitCalled = true;
      throw new Error(`process.exit(${code}) during install — should not happen`);
    };

    try {
      silenceConsole(() => {
        install(true /* isGlobal */, 'claude');
      });
    } catch (e) {
      if (exitCalled) {
        assert.fail(`install() called process.exit — unexpected: ${e.message}`);
      }
      throw e;
    } finally {
      process.exit = origExit;
    }

    // The co-located json must be present after install.
    const colocatedJson = path.join(
      claudeDir,
      'get-shit-done',
      'bin',
      'shared',
      'model-catalog.json',
    );
    assert.ok(
      fs.existsSync(colocatedJson),
      `model-catalog.json must be present at co-located path post-install: ${colocatedJson}`,
    );

    // The json must be valid and have expected shape.
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(fs.readFileSync(colocatedJson, 'utf8'));
    }, 'co-located model-catalog.json must be valid JSON');

    assert.ok(Array.isArray(parsed.profiles), 'catalog.profiles must be an array');
    assert.ok(parsed.profiles.length > 0, 'catalog.profiles must not be empty');

    // And the installed model-catalog.cjs must be requireable from its install location.
    const installedCjs = path.join(
      claudeDir,
      'get-shit-done',
      'bin',
      'lib',
      'model-catalog.cjs',
    );
    assert.ok(fs.existsSync(installedCjs), `model-catalog.cjs must be installed at: ${installedCjs}`);

    delete require.cache[installedCjs];
    let installedMod;
    assert.doesNotThrow(() => {
      installedMod = require(installedCjs);
    }, 'installed model-catalog.cjs must not throw MODULE_NOT_FOUND after install');

    assert.ok(installedMod.catalog, 'installed module must export catalog');
    assert.ok(installedMod.VALID_PROFILES.length > 0, 'installed module must have valid profiles');
  });
});
