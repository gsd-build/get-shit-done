/**
 * Regression test for bug #3020.
 *
 * The installer prints `✓ GSD SDK ready (sdk/dist/cli.js)` whenever
 * isGsdSdkOnPath() — which reads process.env.PATH from the install
 * subprocess — finds the shim. That set is not the same as the user's
 * later interactive shell PATH:
 *
 *   - Windows cross-shell: gsd-sdk.cmd resolves under PowerShell/cmd
 *     (PATHEXT) but bare `gsd-sdk` does not resolve under Git Bash /
 *     MSYS / WSL bash.
 *   - POSIX ~/.local/bin: install subprocess inherits npm/npx-injected
 *     PATH containing ~/.local/bin; user's login shell may not.
 *   - Node version managers (nvm/fnm/volta) shim PATH per-shell.
 *
 * Result: green ✓ at install time, "command not found" at workflow
 * runtime (#3011 originals + @x0rk + @stefanoginella).
 *
 * Fix: introduce two helpers and use them at install time.
 *
 *   isGsdSdkOnPath(pathString?: string)
 *     - Now accepts an optional explicit PATH string. When omitted,
 *       falls back to process.env.PATH (preserves existing behavior).
 *     - Pure: no spawn, no I/O beyond fs.statSync on candidates.
 *
 *   getUserShellPath() → string | null
 *     - Probes the user's login shell ($SHELL -lc 'printf %s "$PATH"') on
 *       POSIX so we can predict the runtime shell PATH.
 *     - Returns null on Windows or when the probe fails (caller falls
 *       back to process.env.PATH).
 *
 * Tests are typed-IR / structural — no console capture, no source grep.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const INSTALL = require(path.join(__dirname, '..', 'bin', 'install.js'));
const { isGsdSdkOnPath, getUserShellPath } = INSTALL;

describe('bug #3020: isGsdSdkOnPath accepts an explicit PATH string', () => {
  test('exported as a function', () => {
    assert.equal(typeof isGsdSdkOnPath, 'function');
  });

  test('returns true when an executable gsd-sdk exists in the supplied PATH', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3020-'));
    try {
      // Create a fake `gsd-sdk` shim with the executable bit set.
      const shimName = process.platform === 'win32' ? 'gsd-sdk.cmd' : 'gsd-sdk';
      const shimPath = path.join(tmp, shimName);
      fs.writeFileSync(shimPath, process.platform === 'win32' ? '@echo off\nexit 0\n' : '#!/bin/sh\nexit 0\n');
      if (process.platform !== 'win32') fs.chmodSync(shimPath, 0o755);
      const result = isGsdSdkOnPath(tmp);
      assert.equal(result, true, `expected true for PATH=${tmp}, got ${result}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('returns false when the supplied PATH has no gsd-sdk', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3020-'));
    try {
      const result = isGsdSdkOnPath(tmp);
      assert.equal(result, false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('zero-arg form preserves existing behavior (reads process.env.PATH)', () => {
    // Just call it — it shouldn't throw and should return a boolean.
    const result = isGsdSdkOnPath();
    assert.equal(typeof result, 'boolean');
  });

  test('treats an empty PATH string as no segments to scan', () => {
    const result = isGsdSdkOnPath('');
    assert.equal(result, false);
  });

  test('null pathString is type-guarded — falls back to process.env.PATH (#3028 CR)', () => {
    // Pre-fix: isGsdSdkOnPath(null) threw "Cannot read properties of null
    // (reading 'split')". Post-fix: typeof check falls back to process.env.PATH.
    let threw = null;
    let result;
    try {
      result = isGsdSdkOnPath(null);
    } catch (e) {
      threw = e;
    }
    assert.equal(threw, null, `must not throw on null input, got: ${threw && threw.message}`);
    assert.equal(typeof result, 'boolean', 'must return a boolean');
  });

  test('non-string pathString (number, object) falls back to process.env.PATH (#3028 CR)', () => {
    // Defensive: any non-string argument should fall back, not throw.
    assert.equal(typeof isGsdSdkOnPath(0), 'boolean');
    assert.equal(typeof isGsdSdkOnPath({}), 'boolean');
    assert.equal(typeof isGsdSdkOnPath([]), 'boolean');
  });
});

describe('bug #3020: getUserShellPath probes the user login shell PATH', () => {
  test('exported as a function', () => {
    assert.equal(typeof getUserShellPath, 'function');
  });

  test('returns a string with at least one segment OR null', () => {
    const result = getUserShellPath();
    if (result === null) {
      // Acceptable on Windows or when probing fails — caller must fall back.
      return;
    }
    assert.equal(typeof result, 'string');
    // PATH must have segments separated by the platform delimiter.
    assert.ok(result.length > 0, 'non-null result must be non-empty');
  });

  test('returns null on Windows (POSIX shell probe is not portable)', () => {
    if (process.platform !== 'win32') return;
    const result = getUserShellPath();
    assert.equal(result, null);
  });

  test('returns null when SHELL env var is unset', () => {
    if (process.platform === 'win32') return;
    const original = process.env.SHELL;
    delete process.env.SHELL;
    try {
      const result = getUserShellPath();
      assert.equal(result, null, 'must return null when $SHELL is unset (POSIX caller falls back to process.env.PATH)');
    } finally {
      if (original !== undefined) process.env.SHELL = original;
    }
  });
});

describe('bug #3020: cross-shell PATH mismatch is detectable via the new helpers', () => {
  test('install-time PATH has shim, user-shell PATH does not → mismatch detected', () => {
    const installDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3020-install-'));
    const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3020-user-'));
    try {
      const shimName = process.platform === 'win32' ? 'gsd-sdk.cmd' : 'gsd-sdk';
      const shimPath = path.join(installDir, shimName);
      fs.writeFileSync(shimPath, process.platform === 'win32' ? '@echo off\nexit 0\n' : '#!/bin/sh\nexit 0\n');
      if (process.platform !== 'win32') fs.chmodSync(shimPath, 0o755);

      const installSees = isGsdSdkOnPath(installDir);
      const userSees = isGsdSdkOnPath(userDir);

      assert.equal(installSees, true, 'install-time PATH sees the shim');
      assert.equal(userSees, false, 'user-shell PATH does not see the shim');
      // The mismatch is what the post-install check must detect to avoid
      // the false ✓.
      assert.notEqual(installSees, userSees, 'shim presence differs between install-time PATH and user-shell PATH');
    } finally {
      fs.rmSync(installDir, { recursive: true, force: true });
      fs.rmSync(userDir, { recursive: true, force: true });
    }
  });
});
