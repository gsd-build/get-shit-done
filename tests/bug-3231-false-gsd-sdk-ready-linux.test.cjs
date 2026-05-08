/**
 * Regression tests for bug #3231.
 *
 * `npx get-shit-done-cc@latest` prints `✓ GSD SDK ready (sdk/dist/cli.js)` on
 * Linux but no persistent `gsd-sdk` shim is created. Two sub-bugs:
 *
 * 1. Transient npx PATH + null login-shell PATH → false success
 *    The initial isGsdSdkOnPath() call uses process.env.PATH, which includes
 *    `~/.npm/_npx/<hash>/node_modules/.bin` — a transient dir npx injects.
 *    If that dir has a `gsd-sdk` entry, onPath = true and trySelfLinkGsdSdk
 *    is skipped (no persistent shim). Then getUserShellPath() returns null
 *    (Linux, slow rc files or unset $SHELL). The guard
 *    `onPath && userShellPath !== null` is FALSE, leaving onPath = true →
 *    false `✓ GSD SDK ready` is printed.
 *
 * 2. Stale legacy symlink → installer treats gsd-sdk as "on PATH" and skips
 *    materializing a modern SDK shim. The legacy binary (`gsd-tools.cjs`) has
 *    an `@deprecated` marker in its first bytes, lacks the `query` registry,
 *    and causes "Unknown command: query" for every workflow call.
 *
 * 3. Clean path: sdk/dist/cli.js present + gsd-sdk self-linked into a
 *    persistent PATH dir → installer DOES print success.
 *
 * All assertions use typed-IR / behavioral testing. No source-grep, no
 * readFileSync on install.js.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const installModule = require('../bin/install.js');
const {
  installSdkIfNeeded,
  isGsdSdkOnPath,
  filterNpxFromPath,
  isLegacyGsdSdkShim,
} = installModule;

// ---------------------------------------------------------------------------
// Console capture helper (no ANSI)
// ---------------------------------------------------------------------------
function captureConsole(fn) {
  const stdout = [];
  const stderr = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  console.log = (...a) => stdout.push(a.join(' '));
  console.warn = (...a) => stderr.push(a.join(' '));
  console.error = (...a) => stderr.push(a.join(' '));
  let threw = null;
  try {
    fn();
  } catch (e) {
    threw = e;
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
  if (threw) throw threw;
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  return {
    stdout: stdout.map(strip).join('\n'),
    stderr: stderr.map(strip).join('\n'),
  };
}

// ---------------------------------------------------------------------------
// Shared fixture helpers
// ---------------------------------------------------------------------------
function makeSdkDir(root) {
  const sdkDir = path.join(root, 'sdk');
  fs.mkdirSync(path.join(sdkDir, 'dist'), { recursive: true });
  fs.writeFileSync(
    path.join(sdkDir, 'dist', 'cli.js'),
    ['#!/usr/bin/env node', "console.log('0.0.0-test');", ''].join('\n'),
    { mode: 0o755 },
  );
  return sdkDir;
}

// ---------------------------------------------------------------------------
// Bug 1: transient npx PATH hit + null login-shell PATH → false "GSD SDK ready"
// ---------------------------------------------------------------------------
describe('bug #3231: transient npx PATH + null login-shell PATH', () => {
  let tmpRoot;
  let sdkDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3231-a-'));
    sdkDir = makeSdkDir(tmpRoot);

    // Simulate an npx-injected PATH: a transient _npx directory that happens
    // to contain a gsd-sdk executable. This is NOT a persistent user location.
    const npxBinDir = path.join(tmpRoot, '.npm', '_npx', 'abc123', 'node_modules', '.bin');
    fs.mkdirSync(npxBinDir, { recursive: true });
    const shimName = process.platform === 'win32' ? 'gsd-sdk.cmd' : 'gsd-sdk';
    const shimPath = path.join(npxBinDir, shimName);
    fs.writeFileSync(
      shimPath,
      ['#!/bin/sh', 'exit 0', ''].join('\n'),
      { mode: 0o755 },
    );

    const homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    savedEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL,
    };

    // Install-subprocess PATH contains ONLY the npx transient dir — nothing
    // persistent. $SHELL is unset to simulate getUserShellPath() → null.
    process.env.PATH = npxBinDir;
    process.env.HOME = homeDir;
    delete process.env.SHELL;
  });

  afterEach(() => {
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    if (savedEnv.SHELL == null) delete process.env.SHELL;
    else process.env.SHELL = savedEnv.SHELL;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('does NOT print "GSD SDK ready" when only a transient _npx PATH entry has gsd-sdk', () => {
    // Pre-fix: isGsdSdkOnPath() finds gsd-sdk in the npx-injected dir,
    // onPath = true, trySelfLinkGsdSdk is skipped, getUserShellPath() returns
    // null (SHELL unset), the guard is short-circuited, and the false ✓ is
    // printed. Post-fix: _npx dirs must be excluded from the initial check
    // so the installer attempts self-link and re-probes.
    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;
    assert.ok(
      !/GSD SDK ready/.test(combined),
      'installer must NOT print "GSD SDK ready" when the only matching gsd-sdk is in an npx-transient dir. Output:\n' + combined,
    );
  });

  test('filterNpxFromPath is exported and strips /_npx/ segments', () => {
    // The fix adds a helper that removes any PATH segment whose absolute path
    // contains /_npx/ (POSIX) or \\_npx\\ (Windows).
    assert.equal(typeof filterNpxFromPath, 'function', 'filterNpxFromPath must be exported');

    const npxDir = '/home/user/.npm/_npx/abc123/node_modules/.bin';
    const persistentDir = '/home/user/.local/bin';
    const unrelatedDir = '/usr/local/bin';
    const result = filterNpxFromPath(
      [npxDir, persistentDir, unrelatedDir].join(path.delimiter),
    );
    assert.ok(!result.includes('_npx'), 'filtered PATH must not include _npx dirs');
    assert.ok(result.includes(persistentDir), 'filtered PATH must keep persistent dirs');
    assert.ok(result.includes(unrelatedDir), 'filtered PATH must keep unrelated dirs');
  });

  test('filterNpxFromPath must not strip a user-named directory that merely contains "npx" as substring', () => {
    // Containment guard: only strip when the segment truly contains /_npx/
    // (between separators), not when "npx" appears as part of a user dir name.
    assert.equal(typeof filterNpxFromPath, 'function');
    const npxLikeUserDir = '/home/user/scripts/my-npx-wrapper/bin';
    const realNpxDir = '/home/user/.npm/_npx/abc/node_modules/.bin';
    const result = filterNpxFromPath(
      [npxLikeUserDir, realNpxDir].join(path.delimiter),
    );
    assert.ok(
      result.includes(npxLikeUserDir),
      'must not strip user dirs that merely contain "npx" as a substring',
    );
    assert.ok(!result.includes(realNpxDir), 'must strip real _npx dirs');
  });
});

// ---------------------------------------------------------------------------
// Bug 2: stale legacy symlink pointing at gsd-tools.cjs (deprecated binary)
// ---------------------------------------------------------------------------
describe('bug #3231: stale legacy symlink to deprecated gsd-tools.cjs', () => {
  let tmpRoot;
  let sdkDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3231-b-'));
    sdkDir = makeSdkDir(tmpRoot);

    const homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    savedEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL,
    };
    process.env.HOME = homeDir;
    delete process.env.SHELL;
  });

  afterEach(() => {
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    if (savedEnv.SHELL == null) delete process.env.SHELL;
    else process.env.SHELL = savedEnv.SHELL;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('isLegacyGsdSdkShim detects the deprecated gsd-tools.cjs marker', () => {
    // The legacy binary starts with or contains the @deprecated marker
    // referencing gsd-tools.cjs in the first 512 bytes.
    assert.equal(typeof isLegacyGsdSdkShim, 'function', 'isLegacyGsdSdkShim must be exported');

    const legacyFile = path.join(tmpRoot, 'gsd-sdk-legacy');
    fs.writeFileSync(
      legacyFile,
      [
        '#!/usr/bin/env node',
        '// @deprecated — use gsd-tools.cjs directly',
        "require('/usr/local/lib/gsd-tools.cjs');",
        '',
      ].join('\n'),
    );

    assert.equal(isLegacyGsdSdkShim(legacyFile), true, 'must detect legacy marker');
  });

  test('isLegacyGsdSdkShim returns false for a modern SDK shim', () => {
    assert.equal(typeof isLegacyGsdSdkShim, 'function');

    const modernFile = path.join(tmpRoot, 'gsd-sdk-modern');
    fs.writeFileSync(
      modernFile,
      [
        '#!/usr/bin/env node',
        "require('/usr/local/lib/node_modules/get-shit-done-cc/bin/gsd-sdk.js');",
        '',
      ].join('\n'),
    );

    assert.equal(isLegacyGsdSdkShim(modernFile), false, 'must not flag modern shims as legacy');
  });

  test('isLegacyGsdSdkShim returns false for a non-existent file', () => {
    assert.equal(typeof isLegacyGsdSdkShim, 'function');
    const missing = path.join(tmpRoot, 'does-not-exist');
    assert.equal(isLegacyGsdSdkShim(missing), false, 'missing file is not a legacy shim');
  });

  test('installer replaces a stale legacy symlink and attempts self-link with modern SDK', () => {
    // Set up: persistent PATH dir exists and contains a gsd-sdk symlink
    // pointing at a fake "legacy" gsd-tools.cjs binary with the @deprecated
    // marker. The installer must detect this, treat it as "not the right SDK",
    // and replace it with a modern shim.
    const persistentBin = path.join(tmpRoot, 'localbin');
    fs.mkdirSync(persistentBin, { recursive: true });

    // Write a fake legacy binary
    const legacyBin = path.join(tmpRoot, 'gsd-tools.cjs');
    fs.writeFileSync(
      legacyBin,
      [
        '#!/usr/bin/env node',
        '// @deprecated — use gsd-tools.cjs directly',
        "console.log('legacy');",
        '',
      ].join('\n'),
      { mode: 0o755 },
    );

    // Place a gsd-sdk symlink in the persistent dir pointing at the legacy binary.
    const legacyShimPath = path.join(persistentBin, 'gsd-sdk');
    try {
      fs.symlinkSync(legacyBin, legacyShimPath);
    } catch {
      // On Windows or symlink-hostile FS, write a file that mimics the legacy content
      fs.writeFileSync(
        legacyShimPath,
        [
          '#!/usr/bin/env node',
          '// @deprecated — use gsd-tools.cjs directly',
          "console.log('legacy');",
          '',
        ].join('\n'),
        { mode: 0o755 },
      );
    }

    process.env.PATH = persistentBin;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;

    // After replacement the installer should succeed; if replacement fails (e.g.
    // because the link dir is truly persistent), it must at minimum NOT report
    // "GSD SDK ready" with the legacy binary still in place — it must warn.
    const sdkReady = /GSD SDK ready/.test(combined);
    if (sdkReady) {
      // Only acceptable if the symlink was replaced with the modern shim.
      assert.ok(
        !isLegacyGsdSdkShim(legacyShimPath),
        'if "GSD SDK ready" is printed, the legacy shim must have been replaced',
      );
    } else {
      // If readiness was not reported, the installer must have emitted a
      // warning or error — it must not silently swallow the failure.
      assert.ok(
        stderr.length > 0,
        'when readiness is not reported, installer should emit a warning/error path',
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Test 3: clean install with gsd-sdk self-linked into a persistent PATH dir
// ---------------------------------------------------------------------------
describe('bug #3231: clean install — gsd-sdk self-linked into persistent PATH dir', () => {
  let tmpRoot;
  let sdkDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3231-c-'));
    sdkDir = makeSdkDir(tmpRoot);
    const homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    savedEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL,
    };
    process.env.HOME = homeDir;
    delete process.env.SHELL;
  });

  afterEach(() => {
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    if (savedEnv.SHELL == null) delete process.env.SHELL;
    else process.env.SHELL = savedEnv.SHELL;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('prints "GSD SDK ready" when gsd-sdk is self-linked into a persistent dir on PATH', () => {
    const homeDir = process.env.HOME;
    const localBin = path.join(homeDir, '.local', 'bin');
    fs.mkdirSync(localBin, { recursive: true });
    // PATH contains only the persistent localBin (no npx dirs)
    process.env.PATH = localBin;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;

    assert.ok(
      /GSD SDK ready/.test(combined),
      'installer must print "GSD SDK ready" when gsd-sdk is self-linked into a dir on PATH. Output:\n' + combined,
    );
    const shimPath = path.join(localBin, 'gsd-sdk');
    assert.ok(
      fs.existsSync(shimPath),
      'installer must materialize gsd-sdk shim in the persistent PATH dir',
    );
  });
});
