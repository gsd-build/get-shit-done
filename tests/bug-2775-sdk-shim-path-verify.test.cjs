/**
 * Regression test for bug #2775
 *
 * `npx get-shit-done-cc@latest --global` runs the installer, which prints
 * `✓ GSD SDK ready` even though the secondary `gsd-sdk` bin is not on the
 * user's PATH. Root cause: `npx` only links the package's primary bin into
 * the ephemeral cache; secondary bins are not symlinked. The installer's
 * `installSdkIfNeeded` only verified that `sdk/dist/cli.js` exists on disk
 * — a strictly weaker invariant than `command -v gsd-sdk` resolving.
 *
 * The fix tightens the success gate: after confirming the dist is present,
 * the installer must verify `gsd-sdk` resolves on PATH. If it does not, the
 * installer attempts to materialize the shim into a user-writable PATH
 * location (`~/.local/bin/gsd-sdk`) and re-checks. Only when the PATH probe
 * succeeds does it print `✓ GSD SDK ready`. Otherwise it emits a clear
 * warning + remediation and does NOT lie about readiness.
 *
 * This test exercises `installSdkIfNeeded` against a synthetic npx-cache
 * shape: sdk/dist/cli.js present, but PATH does not contain any directory
 * with a `gsd-sdk` shim. The legacy code printed the success line in this
 * shape; the fixed code must not.
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const installModule = require('../bin/install.js');
const { installSdkIfNeeded } = installModule;

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

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
  // strip ANSI for matching
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  return {
    stdout: stdout.map(strip).join('\n'),
    stderr: stderr.map(strip).join('\n'),
    threw,
  };
}

describe('bug #2775: installSdkIfNeeded must verify gsd-sdk on PATH before reporting ready', () => {
  let tmpRoot;
  let sdkDir;
  let pathDir;
  let homeDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = makeTempDir('gsd-2775-');
    sdkDir = path.join(tmpRoot, 'sdk');
    fs.mkdirSync(path.join(sdkDir, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(sdkDir, 'dist', 'cli.js'),
      '#!/usr/bin/env node\nconsole.log("0.0.0-test");\n',
      { mode: 0o755 },
    );
    pathDir = path.join(tmpRoot, 'somebin');
    fs.mkdirSync(pathDir, { recursive: true });
    homeDir = path.join(tmpRoot, 'home');
    fs.mkdirSync(homeDir, { recursive: true });
    savedEnv = { PATH: process.env.PATH, HOME: process.env.HOME };
    // PATH does NOT contain anything with a gsd-sdk shim — simulates npx-cache.
    process.env.PATH = pathDir;
    process.env.HOME = homeDir;
  });

  afterEach(() => {
    process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test('does NOT print "GSD SDK ready" when gsd-sdk is not callable on PATH and cannot be linked', () => {
    // Make ~/.local/bin not on PATH and not creatable-friendly: PATH stays
    // as a single dir with no gsd-sdk. The installer may attempt to create
    // ~/.local/bin/gsd-sdk, but that location isn't on PATH either, so the
    // post-link probe should still fail and the success line must be withheld.
    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;
    const hasReady = /GSD SDK ready/.test(combined);
    const mentionsPath = /not on (your )?PATH|gsd-sdk.*PATH|PATH.*gsd-sdk/i.test(combined);
    assert.ok(
      !hasReady,
      `installer must not print "GSD SDK ready" when gsd-sdk is not on PATH. Output:\n${combined}`,
    );
    assert.ok(
      mentionsPath,
      `installer must surface a PATH-related warning when gsd-sdk is not callable. Output:\n${combined}`,
    );
  });

  test('DOES print "GSD SDK ready" after self-linking into a directory that IS on PATH', () => {
    // Put ~/.local/bin on PATH; the installer should create the shim there
    // and the post-link callability probe should succeed.
    const localBin = path.join(homeDir, '.local', 'bin');
    fs.mkdirSync(localBin, { recursive: true });
    process.env.PATH = `${localBin}${path.delimiter}${pathDir}`;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;
    assert.ok(
      /GSD SDK ready/.test(combined),
      `installer must print "GSD SDK ready" after self-linking to a dir on PATH. Output:\n${combined}`,
    );
    // And the link must actually exist + resolve back to the shim.
    const linkPath = path.join(localBin, 'gsd-sdk');
    assert.ok(fs.existsSync(linkPath), `installer must materialize ${linkPath}`);
  });

  test('DOES print "GSD SDK ready" when gsd-sdk is already resolvable on PATH', () => {
    // Pre-populate PATH with a `gsd-sdk` shim so the probe finds one.
    const preexisting = path.join(pathDir, 'gsd-sdk');
    fs.writeFileSync(preexisting, '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    const { stdout } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    assert.ok(
      /GSD SDK ready/.test(stdout),
      `installer must print "GSD SDK ready" when gsd-sdk is already on PATH. Output:\n${stdout}`,
    );
  });
});
