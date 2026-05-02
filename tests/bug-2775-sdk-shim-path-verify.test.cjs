// allow-test-rule: pending-migration-to-typed-ir [#2974]
// Tracked in #2974 for migration to typed-IR assertions per CONTRIBUTING.md
// "Prohibited: Raw Text Matching on Test Outputs". Per-file review may
// reclassify some entries as source-text-is-the-product during migration.

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

const installModule = require('../bin/install.js');
const { installSdkIfNeeded } = installModule;
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
  // Re-throw any captured exception AFTER restoring console so callers don't
  // have to destructure-and-assert on `threw` (and a future regression that
  // crashes before printing won't falsely pass `!hasReady`). (#2775
  // CodeRabbit follow-up)
  if (threw) throw threw;
  // strip ANSI for matching
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
  return {
    stdout: stdout.map(strip).join('\n'),
    stderr: stderr.map(strip).join('\n'),
  };
}

describe('bug #2775: installSdkIfNeeded must verify gsd-sdk on PATH before reporting ready', () => {
  let tmpRoot;
  let sdkDir;
  let pathDir;
  let homeDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = createTempDir('gsd-2775-');
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
    if (savedEnv.PATH == null) delete process.env.PATH;
    else process.env.PATH = savedEnv.PATH;
    if (savedEnv.HOME == null) delete process.env.HOME;
    else process.env.HOME = savedEnv.HOME;
    cleanup(tmpRoot);
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

  test('symlink-fallback writes a wrapper that require()s the real shim by absolute path (preserves __dirname)', () => {
    // Simulate a symlink-hostile filesystem by forcing fs.symlinkSync to throw.
    // The fallback must NOT copy bin/gsd-sdk.js into ~/.local/bin (which would
    // break the shim's `path.resolve(__dirname, '..', 'sdk', 'dist', 'cli.js')`
    // resolution). Instead it must write a tiny wrapper script that
    // require()s the real shim by absolute path so __dirname stays correct.
    const localBin = path.join(homeDir, '.local', 'bin');
    fs.mkdirSync(localBin, { recursive: true });
    process.env.PATH = `${localBin}${path.delimiter}${pathDir}`;

    const realShimSrc = path.resolve(__dirname, '..', 'bin', 'gsd-sdk.js');
    const origSymlink = fs.symlinkSync;
    fs.symlinkSync = () => {
      const err = new Error('EPERM: simulated symlink-hostile filesystem');
      err.code = 'EPERM';
      throw err;
    };
    try {
      captureConsole(() => {
        installSdkIfNeeded({ sdkDir });
      });
    } finally {
      fs.symlinkSync = origSymlink;
    }

    const target = path.join(localBin, 'gsd-sdk');
    assert.ok(fs.existsSync(target), `fallback must materialize ${target}`);
    // Critical: it must NOT be a verbatim copy of bin/gsd-sdk.js.
    const targetContent = fs.readFileSync(target, 'utf8');
    const realShimContent = fs.readFileSync(realShimSrc, 'utf8');
    assert.notStrictEqual(
      targetContent,
      realShimContent,
      'fallback must not copyFileSync bin/gsd-sdk.js — that breaks __dirname-based CLI resolution',
    );
    // It must be a wrapper that require()s the real shim by absolute path.
    assert.ok(
      targetContent.includes('require(') && targetContent.includes(realShimSrc),
      `fallback wrapper must require() the real shim by absolute path. Got:\n${targetContent}`,
    );
    // And it must be executable.
    const st = fs.statSync(target);
    assert.ok(
      (st.mode & 0o111) !== 0,
      `fallback wrapper must have execute bit set (mode=${st.mode.toString(8)})`,
    );
    // (Earlier assertions on targetContent already verify the wrapper points
    // at the real shim by absolute path, which is what guarantees __dirname
    // resolves correctly. A separate "does <pkg>/sdk/dist exist?" check would
    // be tautological — that path is true regardless of what the wrapper
    // wrote.) (#2775 CodeRabbit follow-up)
  });

  test('self-link prefers a PATH-backed HOME dir over ~/.local/bin when ~/.local/bin is off-PATH', () => {
    // Regression for #2775 CodeRabbit follow-up: the candidate ordering must
    // try PATH-backed HOME dirs FIRST, falling back to ~/.local/bin only when
    // it's not on PATH. Otherwise we self-link to ~/.local/bin (off-PATH) and
    // warn — when we could have linked to ~/bin (on-PATH) and printed success.
    const homeBin = path.join(homeDir, 'bin');
    fs.mkdirSync(homeBin, { recursive: true });
    // PATH contains ~/bin (a HOME dir) but NOT ~/.local/bin.
    process.env.PATH = `${homeBin}${path.delimiter}${pathDir}`;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir });
    });
    const combined = `${stdout}\n${stderr}`;
    assert.ok(
      /GSD SDK ready/.test(combined),
      `installer must self-link into the on-PATH HOME dir and print success. Output:\n${combined}`,
    );
    assert.ok(
      fs.existsSync(path.join(homeBin, 'gsd-sdk')),
      `installer must materialize the link in the on-PATH HOME dir (~/bin), not ~/.local/bin`,
    );
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
