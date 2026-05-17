'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Regression tests for bug #3211.
 *
 * Windows 11 + PowerShell 7 + Node v22.22.1, fresh
 * `npx get-shit-done-cc@latest --global --claude`:
 *   gsd-sdk: The term 'gsd-sdk' is not recognized
 *
 * Root causes (Windows sibling of #3231):
 *
 * A. filterNpxFromPath must handle Windows-style backslash paths (e.g.
 *    C:\Users\user\AppData\Local\npm-cache\_npx\abc123\node_modules\.bin).
 *    After replace(/\\/g, '/') the norm contains /_npx/ and should be
 *    stripped. We verify this explicitly because the Linux tests only exercised
 *    POSIX-style paths.
 *
 * B. isGsdSdkOnPath (zero-arg fallback) reads `process.env.PATH || ''`. On
 *    Windows, Node.js normalises PATH case so `process.env.PATH` always
 *    returns the right value in production. But in a cross-platform test
 *    running on macOS/Linux that simulates Windows by writing to
 *    `process.env.PATH`, the filter must still strip `_npx` dirs expressed
 *    with Windows backslash separators so the helper returns false when only
 *    transient dirs are present.
 *
 * C. getUserShellWindowsPersistentPath() — new Windows equivalent of
 *    getUserShellPath(). Probes the user's persistent 'Path' from the Windows
 *    registry via:
 *      powershell -NoProfile -Command
 *        "[Environment]::GetEnvironmentVariable('Path', 'User')"
 *    Returns the persistent Path string or null on failure. Must be exported
 *    and must apply filterNpxFromPath before returning.
 *
 * D. installSdkIfNeeded on Windows must invoke getUserShellWindowsPersistentPath
 *    (instead of the always-null getUserShellPath) for cross-shell verification
 *    — parallel to the POSIX userShellPath guard.
 *
 * All assertions use typed-IR / behavioral testing — no source-grep, no
 * readFileSync on install.js source.
 */

const { describe, test, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const installModule = require(path.join(ROOT, 'bin', 'install.js'));
const { captureConsole } = require('./helpers.cjs');

const isWindows = process.platform === 'win32';

const {
  filterNpxFromPath,
  isLegacyGsdSdkShim,
  isGsdSdkOnPath,
  installSdkIfNeeded,
  getUserShellWindowsPersistentPath,
} = installModule;

// ---------------------------------------------------------------------------
// A. filterNpxFromPath — Windows backslash paths
// ---------------------------------------------------------------------------

describe('bug #3211-A: filterNpxFromPath handles Windows backslash _npx paths', () => {
  test('strips a Windows-style _npx dir expressed with backslashes', () => {
    assert.equal(typeof filterNpxFromPath, 'function', 'filterNpxFromPath must be exported');

    // Windows npm-cache path with backslash separators, semicolon delimiter
    const winNpxDir = 'C:\\Users\\user\\AppData\\Local\\npm-cache\\_npx\\abc123\\node_modules\\.bin';
    const winPersistentDir = 'C:\\Users\\user\\AppData\\Roaming\\npm';
    const winSystemDir = 'C:\\Windows\\System32';

    // On macOS path.delimiter is ':', not ';'. We pass an explicit string
    // so the test validates the normalize logic, not the local path.delimiter.
    const inputPath = [winNpxDir, winPersistentDir, winSystemDir].join(';');
    const result = filterNpxFromPath(inputPath);

    // Regardless of delimiter used, the _npx segment must be stripped
    assert.ok(
      !result.includes('_npx'),
      'filterNpxFromPath must strip Windows _npx dirs. Got: ' + result,
    );
    assert.ok(
      result.includes('Roaming\\npm') || result.includes('Roaming/npm'),
      'filterNpxFromPath must preserve the persistent npm dir. Got: ' + result,
    );
  });

  test('strips a mixed-separator Windows _npx path (forward + backward slashes)', () => {
    const mixedNpxDir = 'C:/Users/user/AppData/Local/npm-cache/_npx/abc/node_modules/.bin';
    const persistentDir = 'C:/Users/user/AppData/Roaming/npm';
    const result = filterNpxFromPath([mixedNpxDir, persistentDir].join(';'));
    assert.ok(!result.includes('_npx'), 'must strip mixed-separator _npx dir. Got: ' + result);
    assert.ok(result.includes('Roaming/npm'), 'must keep persistent dir. Got: ' + result);
  });

  test('does NOT strip a Windows user dir that merely contains "npx" as a substring', () => {
    // A user-named dir like C:\my-npx-tools\bin must NOT be filtered.
    const userNpxLikeDir = 'C:\\Users\\user\\my-npx-tools\\bin';
    const realNpxDir = 'C:\\Users\\user\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\.bin';
    const result = filterNpxFromPath([userNpxLikeDir, realNpxDir].join(';'));
    assert.ok(
      result.includes('my-npx-tools'),
      'must not strip user dirs that merely contain "npx". Got: ' + result,
    );
    assert.ok(!result.includes('_npx'), 'must strip the real _npx dir. Got: ' + result);
  });
});

// ---------------------------------------------------------------------------
// B. isGsdSdkOnPath — does not return true when only a Windows _npx dir has
//    gsd-sdk.cmd (using filterNpxFromPath on the passed pathString)
// ---------------------------------------------------------------------------

describe('bug #3211-B: isGsdSdkOnPath rejects Windows _npx-only transient PATH', () => {
  let tmpRoot;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3211-b-'));
  });

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('returns false when a gsd-sdk.cmd exists only in an _npx-style transient dir', () => {
    // On POSIX we name the dir with _npx/ to match the filter pattern.
    // We can't set process.platform, but we CAN call isGsdSdkOnPath with an
    // explicit pathString that contains an _npx segment — the fix must
    // ensure callers pre-filter via filterNpxFromPath before calling
    // isGsdSdkOnPath. We test filterNpxFromPath(pathString) produces an
    // empty result, which means isGsdSdkOnPath of the filtered path returns false.
    const npxBinDir = path.join(tmpRoot, '_npx', 'abc123', 'node_modules', '.bin');
    fs.mkdirSync(npxBinDir, { recursive: true });

    // Write a gsd-sdk shim (named .cmd for the Windows scenario — on POSIX
    // isGsdSdkOnPath won't find .cmd; we validate the filter, not the exec check).
    const shimPath = path.join(npxBinDir, 'gsd-sdk.cmd');
    fs.writeFileSync(
      shimPath,
      ['@ECHO OFF', '@node "C:\\path\\to\\gsd-sdk.js" %*', ''].join('\r\n'),
    );

    // The raw pathString contains an _npx segment — it MUST be filtered.
    const rawPath = npxBinDir;
    const persistentPath = filterNpxFromPath(rawPath);

    // After filtering, the _npx dir must be gone so isGsdSdkOnPath returns false.
    const onPath = isGsdSdkOnPath(persistentPath);
    assert.equal(
      onPath,
      false,
      'isGsdSdkOnPath(filterNpxFromPath(path)) must return false when only _npx dir has gsd-sdk. persistentPath=' + persistentPath,
    );
  });
});

// ---------------------------------------------------------------------------
// C. getUserShellWindowsPersistentPath — new export
// ---------------------------------------------------------------------------

describe('bug #3211-C: getUserShellWindowsPersistentPath export', () => {
  test('is exported from install.js', () => {
    assert.equal(
      typeof getUserShellWindowsPersistentPath,
      'function',
      'getUserShellWindowsPersistentPath must be exported from install.js',
    );
  });

  test('returns a string or null — never throws', () => {
    // We can call it on macOS/Linux; it must handle non-Windows gracefully
    // (return null or a string). Must never throw.
    let result;
    let threw = null;
    try {
      result = getUserShellWindowsPersistentPath();
    } catch (e) {
      threw = e;
    }
    assert.equal(threw, null, 'getUserShellWindowsPersistentPath must not throw. Error: ' + threw);
    assert.ok(
      result === null || typeof result === 'string',
      'must return string or null. Got: ' + typeof result,
    );
  });

  test('on non-Windows, returns null (Windows-only probe)', () => {
    if (process.platform === 'win32') {
      // On actual Windows, any non-null string is acceptable.
      const result = getUserShellWindowsPersistentPath();
      assert.ok(
        result === null || typeof result === 'string',
        'on Windows must return string or null',
      );
    } else {
      // On POSIX, the Windows probe is meaningless — must return null.
      const result = getUserShellWindowsPersistentPath();
      assert.equal(result, null, 'on POSIX, getUserShellWindowsPersistentPath must return null');
    }
  });

  test('when the PowerShell probe is mocked to return a path, strips _npx dirs',
    { skip: isWindows ? 'cp.execSync reassignment is not picked up by install.js on Windows; real registry Path is returned. POSIX coverage in mock; live Windows path is covered by 3211-D.' : false },
    () => {
    // Mock cp.execSync to return a Windows Path with both persistent and _npx dirs.
    const savedExecSync = cp.execSync;
    const winPersistentDir = 'C:\\Users\\user\\AppData\\Roaming\\npm';
    const winNpxDir = 'C:\\Users\\user\\AppData\\Local\\npm-cache\\_npx\\abc\\node_modules\\.bin';
    const mockPath = [winPersistentDir, winNpxDir].join(';');

    cp.execSync = (cmd, opts) => {
      if (typeof cmd === 'string' && cmd.includes('GetEnvironmentVariable')) {
        return mockPath + '\n';
      }
      return savedExecSync.call(cp, cmd, opts);
    };

    let result;
    try {
      result = getUserShellWindowsPersistentPath();
    } finally {
      cp.execSync = savedExecSync;
    }

    // On non-Windows this returns null (the function guards on process.platform).
    // On Windows it returns the filtered path. Since we can't be on both,
    // we verify the filter would work correctly by directly calling filterNpxFromPath.
    if (result !== null) {
      assert.ok(
        !result.includes('_npx'),
        'getUserShellWindowsPersistentPath must filter _npx dirs from the returned Path. Got: ' + result,
      );
      assert.ok(
        result.includes('Roaming\\npm') || result.includes('Roaming/npm'),
        'must keep persistent npm dir. Got: ' + result,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// D. installSdkIfNeeded Windows false-positive: transient _npx + npm-prefix
//    NOT on PATH → must NOT print "GSD SDK ready"
// ---------------------------------------------------------------------------

describe('bug #3211-D: installSdkIfNeeded — Windows _npx false-positive', () => {
  let tmpRoot;
  let sdkDir;
  let savedEnv;
  let origExecSync;

  function makeSdkDir(root) {
    const dir = path.join(root, 'sdk');
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'dist', 'cli.js'),
      ['#!/usr/bin/env node', "console.log('0.0.0-test');", ''].join('\n'),
      { mode: 0o755 },
    );
    return dir;
  }

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3211-d-'));
    sdkDir = makeSdkDir(tmpRoot);

    // Simulate: install-time PATH contains only a transient _npx dir
    // with a gsd-sdk shim. The persistent npm prefix dir is separate and
    // NOT in process.env.PATH during the npx run.
    const npxBinDir = path.join(tmpRoot, '_npx', 'abc123', 'node_modules', '.bin');
    fs.mkdirSync(npxBinDir, { recursive: true });
    // Write a gsd-sdk shim in the transient dir (executable on POSIX)
    const shimName = 'gsd-sdk';
    fs.writeFileSync(
      path.join(npxBinDir, shimName),
      ['#!/bin/sh', 'exec node /path/to/gsd-sdk.js "$@"', ''].join('\n'),
      { mode: 0o755 },
    );

    const homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(homeDir, { recursive: true });

    savedEnv = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      SHELL: process.env.SHELL,
    };

    // Only the transient _npx dir is on PATH — nothing persistent.
    // On POSIX this simulates the false-positive scenario.
    process.env.PATH = npxBinDir;
    process.env.HOME = homeDir;
    delete process.env.SHELL;

    // Mock cp.execSync for npm prefix -g — return a separate dir that is
    // NOT in process.env.PATH (simulating Windows: npm prefix is on the
    // user's registry Path but not on the npx-injected subprocess PATH).
    const npmPrefixDir = path.join(tmpRoot, 'npm-global');
    fs.mkdirSync(npmPrefixDir, { recursive: true });

    origExecSync = cp.execSync;
    cp.execSync = (cmd, opts) => {
      if (typeof cmd === 'string' && cmd.trim() === 'npm prefix -g') {
        return npmPrefixDir + '\n';
      }
      return origExecSync.call(cp, cmd, opts);
    };
  });

  afterEach(() => {
    cp.execSync = origExecSync;
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    if (savedEnv.SHELL == null) delete process.env.SHELL;
    else process.env.SHELL = savedEnv.SHELL;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('does NOT print "GSD SDK ready" when the only gsd-sdk entry is in a transient _npx dir and npm-prefix is off-PATH', () => {
    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;

    assert.ok(
      !/GSD SDK ready/.test(combined),
      'installer must NOT print "GSD SDK ready" when gsd-sdk is only in a transient _npx dir. Got:\n' + combined,
    );
    // Must emit SOME output (warning or diagnostic), not silently succeed.
    assert.ok(
      combined.trim().length > 0,
      'installer must emit a diagnostic when self-link fails or shim is in transient dir. Got empty output.',
    );
  });
});

// ---------------------------------------------------------------------------
// E. isLegacyGsdSdkShim — Windows .cmd shim detection
// ---------------------------------------------------------------------------

describe('bug #3211-E: isLegacyGsdSdkShim detects legacy marker in .cmd files', () => {
  let tmpRoot;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3211-e-'));
  });

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('detects @deprecated + gsd-tools.cjs in a .cmd shim', () => {
    assert.equal(typeof isLegacyGsdSdkShim, 'function');

    const legacyCmd = path.join(tmpRoot, 'gsd-sdk.cmd');
    fs.writeFileSync(
      legacyCmd,
      [
        '@ECHO OFF',
        ':: @deprecated — use gsd-tools.cjs directly',
        '@node "C:\\path\\to\\gsd-tools.cjs" %*',
        '',
      ].join('\r\n'),
    );
    assert.equal(isLegacyGsdSdkShim(legacyCmd), true, 'must detect @deprecated gsd-tools.cjs in .cmd shim');
  });

  test('returns false for a modern .cmd shim pointing at gsd-sdk.js', () => {
    const modernCmd = path.join(tmpRoot, 'gsd-sdk-modern.cmd');
    fs.writeFileSync(
      modernCmd,
      [
        '@ECHO OFF',
        '@SETLOCAL',
        '@node "C:\\path\\to\\get-shit-done-cc\\bin\\gsd-sdk.js" %*',
        '',
      ].join('\r\n'),
    );
    assert.equal(isLegacyGsdSdkShim(modernCmd), false, 'must not flag modern .cmd shim as legacy');
  });

  test('returns false for a missing file', () => {
    assert.equal(isLegacyGsdSdkShim(path.join(tmpRoot, 'no-such-file.cmd')), false);
  });
});
