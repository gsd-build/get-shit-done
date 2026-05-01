'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Behavior-based regression guard for #2962-class bugs.
 *
 * "Nothing for Windows should be deferred — if it wasn't in, it was missed
 * not deferred." (maintainer guidance, 2026-05-01.)
 *
 * Specifically guards against trySelfLinkGsdSdk silently no-op'ing on
 * Windows. Rather than regex-scanning bin/install.js source (which would
 * fail on harmless refactors and conflicts with the repo's no-source-grep
 * testing standard), this test exercises the function under a simulated
 * `process.platform === 'win32'` and asserts shim files actually land on
 * disk — i.e., the Windows branch dispatches, doesn't early-return null.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const installModule = require(path.join(ROOT, 'bin', 'install.js'));

describe('Windows parity guard for trySelfLinkGsdSdk (#2962)', () => {
  let tmpDir;
  let origPlatform;
  let origExecSync;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-win32-guard-'));
    origPlatform = process.platform;
    origExecSync = cp.execSync;
    // Override process.platform to simulate Windows. process.platform is a
    // configurable property in Node — Object.defineProperty can swap it.
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    cp.execSync = (cmd) => {
      if (typeof cmd === 'string' && cmd.trim() === 'npm prefix -g') {
        return tmpDir + '\n';
      }
      throw new Error(`unexpected execSync: ${cmd}`);
    };
  });

  after(() => {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    cp.execSync = origExecSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('trySelfLinkGsdSdk dispatches to the Windows handler and writes shims (does NOT silently return null)', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const result = installModule.trySelfLinkGsdSdk(shimSrc);

    assert.notEqual(
      result,
      null,
      'trySelfLinkGsdSdk must not silently return null on Windows; ' +
        'a no-op skip is a missed-parity regression (see #2962, #2775).',
    );
    assert.ok(
      fs.existsSync(path.join(tmpDir, 'gsd-sdk.cmd')),
      'Windows dispatch must materialize gsd-sdk.cmd in the npm global bin',
    );
  });
});
