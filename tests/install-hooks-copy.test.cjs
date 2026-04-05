/**
 * Regression tests for install process hook copying, permissions, manifest
 * tracking, uninstall cleanup, and settings.json registration.
 *
 * Covers: #1755, Codex hook path/filename, cache invalidation path,
 * manifest .sh tracking, uninstall settings cleanup, dead code removal.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, beforeEach, afterEach, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cleanup, createTempDir } = require('./helpers.cjs');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');
const { writeManifest } = require(INSTALL_SRC);
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');

// Expected .sh community hooks
const EXPECTED_SH_HOOKS = [
  'gsd-session-state.sh',
  'gsd-validate-commit.sh',
  'gsd-phase-boundary.sh',
];

// All hooks that should be in hooks/dist/ after build
const EXPECTED_ALL_HOOKS = [
  'gsd-check-update.js',
  'gsd-context-monitor.js',
  'gsd-prompt-guard.js',
  'gsd-read-guard.js',
  'gsd-statusline.js',
  'gsd-workflow-guard.js',
  ...EXPECTED_SH_HOOKS,
];

const isWindows = process.platform === 'win32';

// ─── Ensure hooks/dist/ is populated ────────────────────────────────────────

before(() => {
  execFileSync(process.execPath, [BUILD_SCRIPT], {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
});

// ─── Helper: simulate the hook copy loop from install.js ────────────────────
// NOTE: This helper mirrors the chmod/copy logic only. It omits the .js
// template substitution ('.claude' → runtime dir, {{GSD_VERSION}} stamping)
// since these tests focus on file presence and permissions, not content.

function simulateHookCopy(hooksSrc, hooksDest) {
  fs.mkdirSync(hooksDest, { recursive: true });
  const hookEntries = fs.readdirSync(hooksSrc);
  for (const entry of hookEntries) {
    const srcFile = path.join(hooksSrc, entry);
    if (fs.statSync(srcFile).isFile()) {
      const destFile = path.join(hooksDest, entry);
      if (entry.endsWith('.js')) {
        const content = fs.readFileSync(srcFile, 'utf8');
        fs.writeFileSync(destFile, content);
        try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
      } else {
        fs.copyFileSync(srcFile, destFile);
        if (entry.endsWith('.sh')) {
          try { fs.chmodSync(destFile, 0o755); } catch (e) { /* Windows */ }
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Hook file copy and permissions (#1755)
// ─────────────────────────────────────────────────────────────────────────────

describe('#1755: .sh hooks are copied and executable after install', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-hook-copy-');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('all expected hooks are copied from hooks/dist/ to target', () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    for (const hook of EXPECTED_ALL_HOOKS) {
      assert.ok(
        fs.existsSync(path.join(hooksDest, hook)),
        `${hook} should exist in target hooks dir`
      );
    }
  });

  test('.sh hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    for (const sh of EXPECTED_SH_HOOKS) {
      const stat = fs.statSync(path.join(hooksDest, sh));
      assert.ok(
        (stat.mode & 0o111) !== 0,
        `${sh} should be executable after install copy`
      );
    }
  });

  test('.js hooks are executable after copy', {
    skip: isWindows ? 'Windows has no POSIX file permissions' : false,
  }, () => {
    const hooksDest = path.join(tmpDir, 'hooks');
    simulateHookCopy(HOOKS_DIST, hooksDest);

    const jsHooks = EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'));
    for (const js of jsHooks) {
      const stat = fs.statSync(path.join(hooksDest, js));
      assert.ok(
        (stat.mode & 0o111) !== 0,
        `${js} should be executable after install copy`
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. install.js source-level correctness checks
// ─────────────────────────────────────────────────────────────────────────────

describe('install.js source correctness', () => {
  let src;

  before(() => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  test('.sh files get chmod after copyFileSync', () => {
    // The else branch for non-.js hooks should apply chmod for .sh files
    assert.ok(
      src.includes("if (entry.endsWith('.sh'))"),
      'install.js should check for .sh extension to apply chmod'
    );
  });

  test('Codex hook uses correct filename gsd-check-update.js (not gsd-update-check.js)', () => {
    // The cache file gsd-update-check.json is legitimate (different artifact);
    // check that no hook registration uses the inverted .js filename.
    // Match the exact pattern: quote + gsd-update-check.js + quote
    assert.ok(
      !src.match(/['"]gsd-update-check\.js['"]/),
      'install.js must not reference the inverted hook name gsd-update-check.js in quotes'
    );
  });

  test('Codex hook path does not use get-shit-done/hooks/ subdirectory', () => {
    // The Codex hook should resolve to targetDir/hooks/, not targetDir/get-shit-done/hooks/
    assert.ok(
      !src.includes("'get-shit-done', 'hooks', 'gsd-check-update"),
      'Codex hook should not use get-shit-done/hooks/ path segment'
    );
  });

  test('cache invalidation uses ~/.cache/gsd/ path', () => {
    assert.ok(
      src.includes("os.homedir(), '.cache', 'gsd'"),
      'Cache path should use os.homedir()/.cache/gsd/'
    );
  });

  test('manifest tracks .sh hook files', () => {
    assert.ok(
      src.includes("file.endsWith('.sh')"),
      'writeManifest should track .sh files in addition to .js'
    );
  });

  test('gsd-workflow-guard.js is in uninstall hook list', () => {
    const gsdHooksMatch = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'gsdHooks array should exist');
    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      gsdHooksContent.includes('gsd-workflow-guard.js'),
      'gsdHooks should include gsd-workflow-guard.js'
    );
  });

  test('phantom gsd-check-update.sh is not in uninstall hook list', () => {
    const gsdHooksMatch = src.match(/const gsdHooks\s*=\s*\[([^\]]+)\]/);
    assert.ok(gsdHooksMatch, 'gsdHooks array should exist');
    const gsdHooksContent = gsdHooksMatch[1];
    assert.ok(
      !gsdHooksContent.includes('gsd-check-update.sh'),
      'gsdHooks should not include phantom gsd-check-update.sh'
    );
  });

  test('uninstall settings cleanup includes community hooks', () => {
    // SessionStart cleanup should include gsd-session-state
    assert.ok(
      src.includes("gsd-session-state"),
      'uninstall should filter gsd-session-state from SessionStart'
    );

    // PostToolUse/AfterTool cleanup should include gsd-phase-boundary
    const postStart = src.indexOf('Remove GSD hooks from PostToolUse');
    const postEnd = src.indexOf('Remove GSD hooks from PreToolUse');
    assert.ok(postStart !== -1, 'PostToolUse cleanup marker must exist');
    assert.ok(postEnd !== -1, 'PreToolUse cleanup marker must exist');
    const postToolBlock = src.substring(postStart, postEnd);
    assert.ok(
      postToolBlock.includes('gsd-phase-boundary'),
      'uninstall should filter gsd-phase-boundary from PostToolUse/AfterTool'
    );

    // PreToolUse/BeforeTool cleanup should include gsd-validate-commit
    const preStart = src.indexOf('Remove GSD hooks from PreToolUse');
    const preEnd = src.indexOf('Clean up empty hooks object');
    assert.ok(preStart !== -1, 'PreToolUse cleanup marker must exist');
    assert.ok(preEnd !== -1, 'empty hooks cleanup marker must exist');
    const preToolBlock = src.substring(preStart, preEnd);
    assert.ok(
      preToolBlock.includes('gsd-validate-commit'),
      'uninstall should filter gsd-validate-commit from PreToolUse/BeforeTool'
    );
  });

  test('no duplicate isCursor or isWindsurf branches in uninstall skill removal', () => {
    // The uninstall skill removal if/else chain should not have standalone
    // isCursor or isWindsurf branches — they're already handled by the combined
    // (isCodex || isCursor || isWindsurf || isTrae) branch
    const uninstallStart = src.indexOf('function uninstall(');
    const uninstallEnd = src.indexOf('function verifyInstalled(');
    assert.ok(uninstallStart !== -1, 'function uninstall( must exist in install.js');
    assert.ok(uninstallEnd !== -1, 'function verifyInstalled( must exist in install.js');
    const uninstallBlock = src.substring(uninstallStart, uninstallEnd);

    // Count occurrences of 'else if (isCursor)' in uninstall — should be 0
    const cursorBranches = (uninstallBlock.match(/else if \(isCursor\)/g) || []).length;
    assert.strictEqual(cursorBranches, 0, 'No standalone isCursor branch should exist in uninstall');

    // Count occurrences of 'else if (isWindsurf)' in uninstall — should be 0
    const windsurfBranches = (uninstallBlock.match(/else if \(isWindsurf\)/g) || []).length;
    assert.strictEqual(windsurfBranches, 0, 'No standalone isWindsurf branch should exist in uninstall');
  });

  test('verifyInstalled warns about missing .sh hooks', () => {
    assert.ok(
      src.includes('Missing expected hook:'),
      'install should warn about missing .sh hooks after verification'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Manifest tracks .sh hooks
// ─────────────────────────────────────────────────────────────────────────────

describe('writeManifest includes .sh hooks', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempDir('gsd-manifest-');
    // Set up minimal structure expected by writeManifest
    const hooksDir = path.join(tmpDir, 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    // Copy hooks from dist to simulate install
    simulateHookCopy(HOOKS_DIST, hooksDir);
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('manifest contains .sh hook entries', () => {
    writeManifest(tmpDir, 'claude');

    const manifestPath = path.join(tmpDir, 'gsd-file-manifest.json');
    assert.ok(fs.existsSync(manifestPath), 'manifest file should exist');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    for (const sh of EXPECTED_SH_HOOKS) {
      assert.ok(
        manifest.files['hooks/' + sh],
        `manifest should contain hash for ${sh}`
      );
    }
  });

  test('manifest contains .js hook entries', () => {
    writeManifest(tmpDir, 'claude');

    const manifestPath = path.join(tmpDir, 'gsd-file-manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const jsHooks = EXPECTED_ALL_HOOKS.filter(h => h.endsWith('.js'));
    for (const js of jsHooks) {
      assert.ok(
        manifest.files['hooks/' + js],
        `manifest should contain hash for ${js}`
      );
    }
  });
});
