/**
 * Regression test for #2248: local Claude install clobbers profile-level statusLine
 *
 * When installing with `--claude --local`, the repo-level `.claude/settings.json`
 * takes precedence over the user's profile-level `~/.claude/settings.json` in
 * Claude Code. Writing `statusLine` to repo settings during a local install
 * silently overrides any profile-level statusLine the user configured.
 *
 * Fix: local installs skip writing `statusLine` to settings.json unless
 * `--force-statusline` is passed.
 *
 * Note: `install()` only copies files. `finishInstall()` writes settings.json.
 * The production code calls both from `installAllRuntimes()`. Tests must mirror
 * that two-phase pattern.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const { install, finishInstall } = require(INSTALL_SRC);

// ─── Ensure hooks/dist/ is populated before install tests ────────────────────
before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
});

// ─── #2248: local install must NOT write statusLine to repo settings.json ────

describe('#2248: local Claude install does not clobber profile-level statusLine', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-local-install-2248-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('local install does not write statusLine to .claude/settings.json', (t) => {
    const origCwd = process.cwd();
    t.after(() => { process.chdir(origCwd); });
    process.chdir(tmpDir);

    // Phase 1: copy files (mirrors installAllRuntimes)
    const result = install(false, 'claude');

    // Phase 2: configure settings.json (mirrors installAllRuntimes → finalize)
    // shouldInstallStatusline=true mirrors what handleStatusline picks for a fresh install
    finishInstall(
      result.settingsPath,
      result.settings,
      result.statuslineCommand,
      true,   // shouldInstallStatusline
      'claude',
      false   // isGlobal=false → local install
    );

    const settingsPath = path.join(tmpDir, '.claude', 'settings.json');
    assert.ok(
      fs.existsSync(settingsPath),
      '.claude/settings.json must exist after local install'
    );

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.strictEqual(
      settings.statusLine,
      undefined,
      'Local install must not write statusLine to repo settings.json — it would clobber profile-level settings (#2248)'
    );
  });

  test('global install still writes statusLine to settings.json', (t) => {
    const origCwd = process.cwd();
    t.after(() => { process.chdir(origCwd); });

    // Global install writes to CLAUDE_CONFIG_DIR; point it at our tmpDir
    const configDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(configDir, { recursive: true });
    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = configDir;
    t.after(() => {
      if (origEnv === undefined) {
        delete process.env.CLAUDE_CONFIG_DIR;
      } else {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      }
    });

    // Phase 1: copy files
    const result = install(true, 'claude');

    // Phase 2: configure settings.json
    finishInstall(
      result.settingsPath,
      result.settings,
      result.statuslineCommand,
      true,  // shouldInstallStatusline
      'claude',
      true   // isGlobal=true
    );

    const settingsPath = path.join(configDir, 'settings.json');
    assert.ok(
      fs.existsSync(settingsPath),
      '~/.claude/settings.json must exist after global install'
    );

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    assert.ok(
      settings.statusLine !== undefined,
      'Global install should write statusLine to settings.json'
    );
  });
});
