/**
 * Regression test for #2829: `command not found: gsd-sdk` with local-mode install.
 *
 * Repro: a fresh `npx get-shit-done-cc@latest` install with the runtime set
 * to local mode left every `gsd-sdk query …` call site unable to resolve the
 * binary because the installer's previous behavior was to skip SDK linking
 * entirely for local installs (#2678 over-corrected). The published tarball
 * actually carries `sdk/dist/cli.js` and `bin/gsd-sdk.js` regardless of mode,
 * and the shim resolves the CLI relative to its own __dirname — so the same
 * self-link strategy that powers npx-cache global installs (#2775) also works
 * for local installs.
 *
 * Fix: when `installSdkIfNeeded({ isLocal: true })` runs and `sdk/dist/cli.js`
 * is present, the installer must NOT silently skip — it must verify
 * `gsd-sdk` is on PATH and self-link the shim into a user-writable PATH dir
 * if not, so `/gsd-plan` and friends can call `gsd-sdk query …` directly.
 *
 * Pre-existing #2678 contract preserved: when the dist is missing in local
 * mode, the installer warns and returns instead of process.exit(1).
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

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

describe('bug #2829: local-mode install must materialize gsd-sdk on PATH', () => {
  let tmpRoot;
  let sdkDir;
  let pathDir;
  let homeDir;
  let savedEnv;

  beforeEach(() => {
    tmpRoot = createTempDir('gsd-2829-');
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

  test('isLocal=true with sdk/dist/cli.js present self-links gsd-sdk into an on-PATH HOME bin dir', () => {
    const localBin = path.join(homeDir, '.local', 'bin');
    fs.mkdirSync(localBin, { recursive: true });
    process.env.PATH = `${localBin}${path.delimiter}${pathDir}`;

    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir, isLocal: true });
    });
    const combined = `${stdout}\n${stderr}`;

    // The shim must be materialized so `gsd-sdk query …` resolves.
    const linkPath = path.join(localBin, 'gsd-sdk');
    assert.ok(
      fs.existsSync(linkPath),
      `local install must self-link gsd-sdk into ${linkPath}. Output:\n${combined}`,
    );
    // And the installer must report ready (matches the global-mode UX).
    assert.ok(
      /GSD SDK ready/.test(combined),
      `local install must print "GSD SDK ready" once gsd-sdk is on PATH. Output:\n${combined}`,
    );
    // It must NOT print the legacy "Skipping SDK check for local install" line —
    // that's exactly the regression #2829 reports.
    assert.ok(
      !/Skipping SDK check for local install/.test(combined),
      `local install must NOT silently skip when the dist is present (#2829). Output:\n${combined}`,
    );
  });

  test('isLocal=true preserves #2678 contract when sdk/dist/cli.js is missing — warn, do not exit', () => {
    // Wipe the staged dist to simulate a missing-SDK shape.
    fs.rmSync(path.join(sdkDir, 'dist'), { recursive: true, force: true });

    let exitCalled = false;
    const origExit = process.exit;
    process.exit = (code) => {
      exitCalled = true;
      throw new Error(`process.exit(${code}) — local install must not exit on missing SDK (#2678)`);
    };

    try {
      const { stderr } = captureConsole(() => {
        installSdkIfNeeded({ sdkDir, isLocal: true });
      });
      assert.strictEqual(exitCalled, false, 'must not call process.exit in local mode');
      assert.ok(
        /Skipping SDK check for local install/.test(stderr),
        `installer must surface a local-install warning when dist is missing. stderr:\n${stderr}`,
      );
    } finally {
      process.exit = origExit;
    }
  });

  test('isLocal=true with dist present and no on-PATH HOME bin still warns rather than lying about readiness', () => {
    // PATH stays as a single non-HOME dir; any HOME bin candidate remains off-PATH.
    // Mirrors the #2775 invariant: do not print "ready" when the post-link
    // probe still cannot find gsd-sdk on PATH.
    const { stdout, stderr } = captureConsole(() => {
      installSdkIfNeeded({ sdkDir, isLocal: true });
    });
    const combined = `${stdout}\n${stderr}`;
    assert.ok(
      !/GSD SDK ready/.test(combined),
      `installer must not falsely claim ready when gsd-sdk is not callable. Output:\n${combined}`,
    );
    assert.ok(
      /not on (your )?PATH/i.test(combined),
      `installer must surface a PATH warning. Output:\n${combined}`,
    );
  });
});
