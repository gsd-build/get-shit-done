/**
 * Regression test for #3033: --sdk flag parsed but never used.
 *
 * `hasSdk` was set in bin/install.js but never passed to `installSdkIfNeeded`,
 * so `npx get-shit-done-cc@latest --sdk` produced a misleading "✓ GSD SDK ready"
 * message while still silently skipping SDK deployment for local installs.
 *
 * Fix: `installSdkIfNeeded` now accepts `opts.forceSdk`. When true, the
 * early-return for `isLocal=true` + missing dist is bypassed and the
 * fail-fast diagnostic fires (same as a global install with missing dist),
 * and when dist IS present the full shim-link path runs regardless of
 * install mode.
 *
 * Tests here call `installSdkIfNeeded` directly with `forceSdk: true`
 * and assert on filesystem state and console output — no source-grep.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { installSdkIfNeeded } = require('../bin/install.js');
const { createTempDir, cleanup } = require('./helpers.cjs');

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

describe('bug #3033: --sdk flag (opts.forceSdk) must be wired into installSdkIfNeeded', () => {
  let tmpRoot;
  let sdkDir;
  let pathDir;
  let homeDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = createTempDir('gsd-3033-');
    sdkDir = path.join(tmpRoot, 'sdk');
    pathDir = path.join(tmpRoot, 'somebin');
    homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(pathDir, { recursive: true });
    fs.mkdirSync(homeDir, { recursive: true });
    savedEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
    process.env.PATH = pathDir;
    process.env.HOME = homeDir;
  });

  afterEach(() => {
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    cleanup(tmpRoot);
  });

  test('forceSdk=true + isLocal=true + dist present: self-links gsd-sdk into PATH dir', () => {
    // Stage a valid dist so the installer can proceed past the missing-dist gate.
    fs.mkdirSync(path.join(sdkDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(sdkDir, 'dist', 'cli.js'),
      '#!/usr/bin/env node\nconsole.log("0.0.0-test");\n',
      { mode: 0o755 },
    );

    // Put ~/.local/bin on PATH so the shim-link step can succeed.
    const localBin = path.join(homeDir, '.local', 'bin');
    fs.mkdirSync(localBin, { recursive: true });
    process.env.PATH = `${localBin}${path.delimiter}${pathDir}`;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir, isLocal: true, forceSdk: true });
    });
    const combined = `${stdout}\n${stderr}`;

    // Shim must be materialized on PATH.
    const linkPath = path.join(localBin, 'gsd-sdk');
    assert.ok(
      fs.existsSync(linkPath),
      `forceSdk=true must materialize gsd-sdk shim at ${linkPath}. Output:\n${combined}`,
    );

    // Must report "GSD SDK ready" — not the legacy "Skipping SDK check" message.
    assert.ok(
      /GSD SDK ready/.test(combined),
      `forceSdk=true must print "GSD SDK ready" once shim is on PATH. Output:\n${combined}`,
    );
    assert.ok(
      !/Skipping SDK check for local install/.test(combined),
      `forceSdk=true must NOT print the local-skip message. Output:\n${combined}`,
    );
  });

  test('forceSdk=true + isLocal=true + dist missing: fails fast instead of silently skipping', () => {
    // No dist directory — simulate a broken/missing SDK.
    fs.mkdirSync(sdkDir, { recursive: true });
    // dist/cli.js intentionally absent.

    let exitCode = null;
    const origExit = process.exit;
    process.exit = (code) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    };

    let threw = false;
    try {
      captureConsole(() => {
        installSdkIfNeeded({ sdkDir, isLocal: true, forceSdk: true });
      });
    } catch {
      threw = true;
    } finally {
      process.exit = origExit;
    }

    // With forceSdk=true the missing-dist early-return is bypassed and the
    // fail-fast path fires, calling process.exit(1).
    assert.ok(
      threw && exitCode === 1,
      `forceSdk=true with missing dist must call process.exit(1) — exitCode=${exitCode}, threw=${threw}`,
    );
  });

  test('forceSdk=false (default) + isLocal=true + dist missing: retains #2678 soft-skip', () => {
    // Verify the #2678 contract is not broken for the default (no --sdk) path.
    fs.mkdirSync(sdkDir, { recursive: true });

    let exitCalled = false;
    const origExit = process.exit;
    process.exit = (code) => {
      exitCalled = true;
      throw new Error(`process.exit(${code}) — local install without --sdk must not exit`);
    };

    try {
      captureConsole(() => {
        installSdkIfNeeded({ sdkDir, isLocal: true });
      });
    } catch (e) {
      if (!exitCalled) throw e;
    } finally {
      process.exit = origExit;
    }

    assert.strictEqual(
      exitCalled,
      false,
      'isLocal=true without forceSdk must not call process.exit (preserves #2678 contract)',
    );
  });
});
