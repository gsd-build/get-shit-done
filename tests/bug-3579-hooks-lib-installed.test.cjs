/**
 * Regression tests for bug #3579 (and latent #3129 gap)
 *
 * The installer must copy hooks/lib/ (git-cmd.js + gsd-graphify-rebuild.sh)
 * into the target hooks/ directory. Before this fix, build-hooks.js never
 * shipped gsd-graphify-update.sh and the installer never recursed into lib/,
 * so fresh installs with graphify.auto_update=true would silently skip the
 * hook (the [ -f "$REBUILD_SCRIPT" ] guard in gsd-graphify-update.sh would
 * bail).
 *
 * This also retroactively ensures git-cmd.js (the canonical token-walk
 * classifier for validate-commit) is present for new installs.
 *
 * Modelled directly on bug-1834-sh-hooks-installed.test.cjs.
 */

'use strict';

const { describe, test, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const INSTALL_SCRIPT = path.join(__dirname, '..', 'bin', 'install.js');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const isWindows = process.platform === 'win32';

const LIB_HELPERS = ['git-cmd.js', 'gsd-graphify-rebuild.sh'];

// ─── Ensure hooks/dist/ is populated before any install test ────────────────

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/**
 * Run the installer targeting a temp directory.
 * Uses CLAUDE_CONFIG_DIR to redirect the global install target.
 * Returns the path to the installed hooks directory.
 */
function runInstaller(configDir) {
  execFileSync(process.execPath, [INSTALL_SCRIPT, '--claude', '--global', '--yes', '--no-sdk'], {
    encoding: 'utf-8',
    stdio: 'pipe',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: configDir,
    },
  });
  return path.join(configDir, 'hooks');
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. End-to-end install: hooks/lib/ helpers are deployed
// ─────────────────────────────────────────────────────────────────────────────

describe('#3579: installer deploys hooks/lib/ helpers (git-cmd.js, gsd-graphify-rebuild.sh)', () => {
  let tmpDir;
  let hooksDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-3579-lib-');
  });

  afterEach(() => {
    if (tmpDir) cleanup(tmpDir);
  });

  test('hooks/lib/ directory and required helpers are present after install', () => {
    hooksDir = runInstaller(tmpDir);
    const libDir = path.join(hooksDir, 'lib');

    assert.ok(fs.existsSync(libDir), 'hooks/lib/ directory must be created by installer');

    for (const helper of LIB_HELPERS) {
      const p = path.join(libDir, helper);
      assert.ok(fs.existsSync(p), `hooks/lib/${helper} must be present after install`);
    }
  });

  test('gsd-graphify-rebuild.sh in lib/ is executable after install', () => {
    if (isWindows) return; // chmod has no effect on Windows in the same way
    hooksDir = runInstaller(tmpDir);
    const p = path.join(hooksDir, 'lib', 'gsd-graphify-rebuild.sh');
    const stat = fs.statSync(p);
    assert.ok((stat.mode & 0o111) !== 0, 'gsd-graphify-rebuild.sh must be executable (chmod +x)');
  });

  test('git-cmd.js in lib/ is present (required by gsd-validate-commit.sh)', () => {
    hooksDir = runInstaller(tmpDir);
    const p = path.join(hooksDir, 'lib', 'git-cmd.js');
    assert.ok(fs.existsSync(p), 'git-cmd.js must be present — validate-commit hook does require(path.join(__dirname, "lib", "git-cmd.js"))');
  });
});
