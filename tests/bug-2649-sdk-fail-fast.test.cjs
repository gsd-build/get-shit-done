/**
 * Regression test for #2649 — installer must fail fast with a clear,
 * actionable error when `sdk/dist/cli.js` is missing, and must NOT attempt
 * a nested `npm install` inside the sdk directory (which, on Windows, lives
 * in the read-only npx cache `%LOCALAPPDATA%\\npm-cache\\_npx\\<hash>\\...`).
 *
 * Shares a root cause with #2647 (packaging drops sdk/dist/). This test
 * covers the installer's defensive behavior when that packaging bug — or
 * any future regression that loses the prebuilt dist — reaches users.
 */

'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

function loadInstaller() {
  process.env.GSD_TEST_MODE = '1';
  delete require.cache[require.resolve(INSTALL_PATH)];
  return require(INSTALL_PATH);
}

function makeTempSdk({ npxCache = false } = {}) {
  let root;
  if (npxCache) {
    root = path.join(os.tmpdir(), `gsd-npx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, 'npm-cache', '_npx', 'deadbeefcafe0001', 'node_modules', 'get-shit-done-cc');
    fs.mkdirSync(root, { recursive: true });
  } else {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-clone-'));
  }
  const sdkDir = path.join(root, 'sdk');
  fs.mkdirSync(sdkDir, { recursive: true });
  // Note: intentionally no sdk/dist/ directory.
  return { root, sdkDir };
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function runWithIntercepts(fn) {
  const stderr = [];
  const stdout = [];
  const origErr = console.error;
  const origLog = console.log;
  console.error = (...a) => stderr.push(a.join(' '));
  console.log = (...a) => stdout.push(a.join(' '));

  const origExit = process.exit;
  let exitCode = null;
  process.exit = (code) => { exitCode = code; throw new Error('__EXIT__'); };

  const cp = require('child_process');
  const origSpawnSync = cp.spawnSync;
  const origExecSync = cp.execSync;
  const spawnCalls = [];
  cp.spawnSync = (cmd, argv, opts) => {
    spawnCalls.push({ cmd, argv, opts });
    return { status: 0, stdout: Buffer.from(''), stderr: Buffer.from('') };
  };
  cp.execSync = (cmd, opts) => {
    spawnCalls.push({ cmd, opts, via: 'execSync' });
    return Buffer.from('');
  };

  try {
    try { fn(); } catch (e) { if (e.message !== '__EXIT__') throw e; }
  } finally {
    console.error = origErr;
    console.log = origLog;
    process.exit = origExit;
    cp.spawnSync = origSpawnSync;
    cp.execSync = origExecSync;
  }

  return {
    stderr: stderr.join('\n'),
    stdout: stdout.join('\n'),
    exitCode,
    spawnCalls,
  };
}

describe('installer SDK dist-missing fail-fast (#2649)', () => {
  let installer;
  before(() => { installer = loadInstaller(); });

  test('exposes test hooks for SDK check', () => {
    assert.ok(typeof installer.installSdkIfNeeded === 'function',
      'installSdkIfNeeded must be exported in test mode');
    assert.ok(typeof installer.classifySdkInstall === 'function',
      'classifySdkInstall must be exported in test mode');
  });

  test('classifySdkInstall tags npx cache paths as tarball + npxCache', () => {
    const { root, sdkDir } = makeTempSdk({ npxCache: true });
    try {
      const c = installer.classifySdkInstall(sdkDir);
      assert.strictEqual(c.mode, 'tarball');
      assert.strictEqual(c.npxCache, true);
      assert.ok('readOnly' in c);
    } finally {
      cleanup(root);
    }
  });

  test('classifySdkInstall tags plain git-clone dirs as dev-clone', () => {
    const { root, sdkDir } = makeTempSdk({ npxCache: false });
    try {
      fs.mkdirSync(path.join(root, '.git'), { recursive: true });
      const c = installer.classifySdkInstall(sdkDir);
      assert.strictEqual(c.mode, 'dev-clone');
      assert.strictEqual(c.npxCache, false);
    } finally {
      cleanup(root);
    }
  });

  test('missing dist in npx cache: fail fast, no nested npm install', () => {
    const { root, sdkDir } = makeTempSdk({ npxCache: true });
    try {
      const result = runWithIntercepts(() => {
        installer.installSdkIfNeeded({ sdkDir });
      });

      assert.strictEqual(result.exitCode, 1, 'must exit non-zero');

      // (a) actionable upgrade path in error output
      assert.match(result.stderr, /npm i(nstall)? -g get-shit-done-cc@latest/,
        'error must mention the global-install upgrade path');
      assert.match(result.stderr, /sdk\/dist/,
        'error must name the missing artifact');

      // (b) no nested `npm install` / `npm.cmd install` inside sdkDir
      const nestedInstall = result.spawnCalls.find((c) => {
        const argv = Array.isArray(c.argv) ? c.argv : [];
        const cwd = c.opts && c.opts.cwd;
        const isNpm = /\bnpm(\.cmd)?$/i.test(String(c.cmd || ''));
        const isInstall = argv.includes('install') || argv.includes('i');
        const isInSdk = typeof cwd === 'string' && cwd.includes(sdkDir);
        return isNpm && isInstall && isInSdk;
      });
      assert.strictEqual(nestedInstall, undefined,
        'must NOT spawn `npm install` inside the npx-cache sdk dir');
    } finally {
      cleanup(root);
    }
  });

  test('missing dist in a dev clone: fail fast with clone build hint', () => {
    const { root, sdkDir } = makeTempSdk({ npxCache: false });
    try {
      fs.mkdirSync(path.join(root, '.git'), { recursive: true });
      const result = runWithIntercepts(() => {
        installer.installSdkIfNeeded({ sdkDir });
      });
      assert.strictEqual(result.exitCode, 1);
      // Dev clone path: suggest the local build, not the global upgrade.
      assert.match(result.stderr, /cd sdk && npm install && npm run build/,
        'dev-clone error must keep the build-from-clone instructions');

      const nestedInstall = result.spawnCalls.find((c) => {
        const argv = Array.isArray(c.argv) ? c.argv : [];
        const isNpm = /\bnpm(\.cmd)?$/i.test(String(c.cmd || ''));
        const isInstall = argv.includes('install') || argv.includes('i');
        return isNpm && isInstall;
      });
      assert.strictEqual(nestedInstall, undefined,
        'installer itself must never shell out to `npm install`; the user does that');
    } finally {
      cleanup(root);
    }
  });
});
