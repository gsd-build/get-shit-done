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

  // Structured parsers — extract the meaningful tokens from each shim format
  // so assertions match the *shape* the runtime cares about, not arbitrary
  // substrings. This satisfies the repo's no-source-grep testing standard
  // (CONTRIBUTING.md): no .includes()/.startsWith() against file text.
  function parseCmdShim(content) {
    // Expected: 3 non-empty CRLF-separated lines, e.g.
    //   @ECHO OFF
    //   @SETLOCAL
    //   @node "<abs>" %*
    const lines = content.split('\r\n').filter((l) => l.length > 0);
    const invocation = (lines[2] || '').trim().split(/\s+/);
    return {
      lineCount: lines.length,
      header: lines[0],
      setlocal: lines[1],
      nodeCmd: invocation[0],
      target: invocation[1],
      argToken: invocation[2],
      // Whether \r\n line endings were used at all — if absent, the file is
      // LF-only and would not be a valid Windows .cmd shim.
      usesCRLF: content.includes('\r\n'),
    };
  }

  function parsePs1Invocation(content) {
    // Expected non-shebang line: `& node "<abs>" $args`
    const lines = content.split('\n').filter((l) => l.length > 0 && !l.startsWith('#!'));
    const invocation = (lines[0] || '').trim().split(/\s+/);
    return { call: invocation[0], nodeCmd: invocation[1], target: invocation[2], argToken: invocation[3] };
  }

  function parseBashInvocation(content) {
    // Expected non-shebang line: `exec node "<abs>" "$@"`
    const lines = content.split('\n').filter((l) => l.length > 0 && !l.startsWith('#!'));
    const invocation = (lines[0] || '').trim().split(/\s+/);
    return { call: invocation[0], nodeCmd: invocation[1], target: invocation[2], argToken: invocation[3] };
  }

  test('each shim invokes node with the absolute path to bin/gsd-sdk.js', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    installModule.trySelfLinkGsdSdkWindows(shimSrc); // self-contained: write before reading
    const shimAbs = path.resolve(shimSrc);
    const expectedQuoted = JSON.stringify(shimAbs);

    const cmd = parseCmdShim(fs.readFileSync(path.join(tmpDir, 'gsd-sdk.cmd'), 'utf8'));
    assert.deepEqual(
      { nodeCmd: cmd.nodeCmd, target: cmd.target, argToken: cmd.argToken },
      { nodeCmd: '@node', target: expectedQuoted, argToken: '%*' },
      '.cmd invocation tokens',
    );

    const ps1 = parsePs1Invocation(fs.readFileSync(path.join(tmpDir, 'gsd-sdk.ps1'), 'utf8'));
    assert.deepEqual(
      ps1,
      { call: '&', nodeCmd: 'node', target: expectedQuoted, argToken: '$args' },
      '.ps1 invocation tokens',
    );

    const sh = parseBashInvocation(fs.readFileSync(path.join(tmpDir, 'gsd-sdk'), 'utf8'));
    assert.deepEqual(
      sh,
      { call: 'exec', nodeCmd: 'node', target: expectedQuoted, argToken: '"$@"' },
      'bash wrapper invocation tokens',
    );
  });

  test('.cmd file structure matches Windows convention (CRLF + @ECHO OFF header)', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    installModule.trySelfLinkGsdSdkWindows(shimSrc);
    const cmd = parseCmdShim(fs.readFileSync(path.join(tmpDir, 'gsd-sdk.cmd'), 'utf8'));
    assert.equal(cmd.header, '@ECHO OFF', '.cmd first non-empty line is @ECHO OFF');
    assert.equal(cmd.setlocal, '@SETLOCAL', '.cmd second line is @SETLOCAL');
    assert.equal(cmd.usesCRLF, true, '.cmd file uses CRLF line endings');
    assert.equal(cmd.lineCount, 3, '.cmd has exactly 3 meaningful lines');
  });

  test('replaces existing stale shims rather than appending', () => {
    // Pre-seed a stale shim with a recognizable target token
    const cmdPath = path.join(tmpDir, 'gsd-sdk.cmd');
    const stalePath = '"/stale/path/that/no/longer/exists.js"';
    fs.writeFileSync(cmdPath, `@ECHO OFF\r\n@SETLOCAL\r\n@node ${stalePath} %*\r\n`);

    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    installModule.trySelfLinkGsdSdkWindows(shimSrc);

    const cmd = parseCmdShim(fs.readFileSync(cmdPath, 'utf8'));
    const expectedQuoted = JSON.stringify(path.resolve(shimSrc));
    assert.equal(cmd.target, expectedQuoted, 'fresh shim points at current shimSrc');
    assert.notEqual(cmd.target, stalePath, 'stale target must be replaced, not preserved');
    assert.equal(cmd.nodeCmd, '@node', 'fresh shim invokes node');
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
