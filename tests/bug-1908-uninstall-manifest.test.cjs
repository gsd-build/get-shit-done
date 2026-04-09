/**
 * Regression test for bug #1908
 *
 * `--uninstall` did not remove `gsd-file-manifest.json` from the target
 * directory, leaving a stale metadata file after uninstall.
 *
 * Fix: `uninstall()` must call
 *   fs.rmSync(path.join(targetDir, MANIFEST_NAME), { force: true })
 * after cleaning up the rest of the GSD artefacts.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { uninstall } = require('../bin/install.js');

const MANIFEST_NAME = 'gsd-file-manifest.json';

// ─── helpers ──────────────────────────────────────────────────────────────────

function createFakeInstall(prefix = 'gsd-uninstall-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  // Simulate the minimum directory/file layout produced by the installer:
  // get-shit-done/ directory, agents/ directory, and the manifest file.
  fs.mkdirSync(path.join(dir, 'get-shit-done', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'get-shit-done', 'workflows', 'execute-phase.md'), '# stub');

  fs.mkdirSync(path.join(dir, 'agents'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'agents', 'gsd-executor.md'), '# stub');

  const manifest = {
    version: '1.34.0',
    timestamp: new Date().toISOString(),
    files: {
      'get-shit-done/workflows/execute-phase.md': 'abc123',
      'agents/gsd-executor.md': 'def456',
    },
  };
  fs.writeFileSync(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2));

  return dir;
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('uninstall — manifest cleanup (#1908)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createFakeInstall();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('gsd-file-manifest.json is removed after global uninstall', () => {
    const manifestPath = path.join(tmpDir, MANIFEST_NAME);

    // Pre-condition: manifest exists before uninstall
    assert.ok(
      fs.existsSync(manifestPath),
      'Test setup failure: manifest file should exist before uninstall'
    );

    // Run uninstall against tmpDir (pass it via CLAUDE_CONFIG_DIR so getGlobalDir()
    // resolves to our temp directory; pass isGlobal=true)
    const savedEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = tmpDir;
    try {
      uninstall(true, 'claude');
    } finally {
      if (savedEnv === undefined) {
        delete process.env.CLAUDE_CONFIG_DIR;
      } else {
        process.env.CLAUDE_CONFIG_DIR = savedEnv;
      }
    }

    assert.ok(
      !fs.existsSync(manifestPath),
      [
        `${MANIFEST_NAME} must be removed by uninstall() but still exists at`,
        manifestPath,
      ].join(' ')
    );
  });

  test('gsd-file-manifest.json is removed after local uninstall', () => {
    const manifestPath = path.join(tmpDir, MANIFEST_NAME);

    assert.ok(
      fs.existsSync(manifestPath),
      'Test setup failure: manifest file should exist before uninstall'
    );

    // For a local install, getGlobalDir is not called — targetDir = cwd + dirName.
    // Simulate by creating .claude/ inside tmpDir and placing artefacts there.
    const localDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(path.join(localDir, 'get-shit-done', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(localDir, 'get-shit-done', 'workflows', 'execute-phase.md'), '# stub');
    const localManifestPath = path.join(localDir, MANIFEST_NAME);
    fs.writeFileSync(localManifestPath, JSON.stringify({ version: '1.34.0', files: {} }, null, 2));

    const savedCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      uninstall(false, 'claude');
    } finally {
      process.chdir(savedCwd);
    }

    assert.ok(
      !fs.existsSync(localManifestPath),
      [
        `${MANIFEST_NAME} must be removed by uninstall() (local) but still exists at`,
        localManifestPath,
      ].join(' ')
    );
  });
});
