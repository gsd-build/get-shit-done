'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2962: --sdk install flag on Windows leaves gsd-sdk un-shimmed.
 *
 * trySelfLinkGsdSdk previously contained `if (process.platform === 'win32')
 * return null;` — this was a missed gap from #2775's POSIX self-link, not an
 * intentional design choice. The Windows path now writes the npm-style shim
 * triple (.cmd, .ps1, bash wrapper) into the npm global bin directory, the
 * same way `npm install -g <pkg>` itself does.
 *
 * This test exercises trySelfLinkGsdSdkWindows directly with a mocked npm
 * prefix and asserts the three shim files are written with the correct
 * contents. The shim path embedded in each must be the absolute path to the
 * source shim (bin/gsd-sdk.js) so that the shim location is decoupled from
 * the SDK CLI location.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const installModule = require(path.join(ROOT, 'bin', 'install.js'));

describe('Bug #2962: trySelfLinkGsdSdkWindows shim materialization', () => {
  let tmpDir;
  let origExecSync;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2962-'));
    origExecSync = cp.execSync;
    // Intercept `npm prefix -g` so the shim writer targets our temp dir.
    // On Windows `npm` is `npm.cmd`, so the production code uses execSync
    // (which spawns through cmd.exe) per Node's documented .cmd handling.
    cp.execSync = (cmd, opts) => {
      if (typeof cmd === 'string' && cmd.trim() === 'npm prefix -g') {
        return tmpDir + '\n';
      }
      return origExecSync.call(cp, cmd, opts);
    };
  });

  after(() => {
    cp.execSync = origExecSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('writes gsd-sdk.cmd, gsd-sdk.ps1, and gsd-sdk shims to npm global bin', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const result = installModule.trySelfLinkGsdSdkWindows(shimSrc);

    assert.equal(result, path.join(tmpDir, 'gsd-sdk.cmd'), 'returns .cmd path on success');
    assert.ok(fs.existsSync(path.join(tmpDir, 'gsd-sdk.cmd')), 'gsd-sdk.cmd exists');
    assert.ok(fs.existsSync(path.join(tmpDir, 'gsd-sdk.ps1')), 'gsd-sdk.ps1 exists');
    assert.ok(fs.existsSync(path.join(tmpDir, 'gsd-sdk')), 'bash wrapper gsd-sdk exists');
  });

  test('each shim invokes node with the absolute path to bin/gsd-sdk.js', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const shimAbs = path.resolve(shimSrc);
    const cmdContent = fs.readFileSync(path.join(tmpDir, 'gsd-sdk.cmd'), 'utf8');
    const ps1Content = fs.readFileSync(path.join(tmpDir, 'gsd-sdk.ps1'), 'utf8');
    const shContent = fs.readFileSync(path.join(tmpDir, 'gsd-sdk'), 'utf8');

    // Each shim must reference the absolute path so it survives a stale
    // working directory at invocation time.
    const jsonQuoted = JSON.stringify(shimAbs);
    assert.ok(cmdContent.includes(`@node ${jsonQuoted} %*`), `.cmd embeds absolute shim path: got ${cmdContent}`);
    assert.ok(ps1Content.includes(`& node ${jsonQuoted} $args`), '.ps1 embeds absolute shim path');
    assert.ok(shContent.includes(`exec node ${jsonQuoted} "$@"`), 'bash wrapper embeds absolute shim path');
  });

  test('.cmd file uses CRLF line endings (Windows convention)', () => {
    const cmdContent = fs.readFileSync(path.join(tmpDir, 'gsd-sdk.cmd'), 'utf8');
    assert.ok(cmdContent.includes('\r\n'), '.cmd file uses CRLF');
    assert.ok(cmdContent.startsWith('@ECHO OFF\r\n'), '.cmd starts with @ECHO OFF');
  });

  test('replaces existing stale shims rather than appending', () => {
    // Pre-seed a stale shim with sentinel content
    const cmdPath = path.join(tmpDir, 'gsd-sdk.cmd');
    fs.writeFileSync(cmdPath, '@ECHO STALE_SENTINEL\r\n');

    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    installModule.trySelfLinkGsdSdkWindows(shimSrc);

    const post = fs.readFileSync(cmdPath, 'utf8');
    assert.ok(!post.includes('STALE_SENTINEL'), 'stale shim must be replaced, not appended to');
    assert.ok(post.includes('@node '), 'fresh shim invokes node');
  });

  test('returns null when npm prefix -g fails', () => {
    const restoreSpy = cp.execSync;
    cp.execSync = () => { throw new Error('npm not on PATH'); };
    try {
      const result = installModule.trySelfLinkGsdSdkWindows(path.join(ROOT, 'bin', 'gsd-sdk.js'));
      assert.equal(result, null);
    } finally {
      cp.execSync = restoreSpy;
    }
  });
});
