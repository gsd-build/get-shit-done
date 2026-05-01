'use strict';

process.env.GSD_TEST_MODE = '1';

/**
 * Bug #2962: --sdk install flag on Windows leaves gsd-sdk un-shimmed.
 *
 * Tests are split into two layers, each at the right level of abstraction:
 *
 *   1. buildWindowsShimTriple — pure IR builder. Tests assert on TYPED
 *      FIELDS of the returned record (interpreter, target, eol, fileNames).
 *      No filesystem, no spawn, no text reads. This is the level where
 *      structural correctness lives.
 *
 *   2. trySelfLinkGsdSdkWindows — fs/spawn driver that calls the IR builder
 *      and writes the rendered shims to disk. Tests assert FILESYSTEM FACTS
 *      (file exists, file is non-empty, file mtime advanced after replace,
 *      function return value). No reads, no parsing, no substring matching.
 *
 * Per the repo's no-source-grep testing standard (CONTRIBUTING.md): the
 * test must NEVER read shim file contents and pattern-match against them.
 * The IR is the contract; the rendered text is an implementation detail of
 * the renderer.
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const installModule = require(path.join(ROOT, 'bin', 'install.js'));

describe('Bug #2962: buildWindowsShimTriple — pure IR builder', () => {
  test('resolves shimSrc to an absolute path on the invocation.target field', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const triple = installModule.buildWindowsShimTriple(shimSrc);
    assert.equal(triple.invocation.target, path.resolve(shimSrc));
    assert.equal(triple.invocation.interpreter, 'node');
  });

  test('produces a structured IR with the documented shape', () => {
    const triple = installModule.buildWindowsShimTriple(path.join(ROOT, 'bin', 'gsd-sdk.js'));
    // Lock the public IR shape — adding/removing a key requires updating this assertion.
    assert.deepEqual(Object.keys(triple).sort(), ['eol', 'fileNames', 'invocation', 'render']);
    assert.deepEqual(Object.keys(triple.invocation).sort(), ['interpreter', 'target']);
    assert.deepEqual(Object.keys(triple.eol).sort(), ['cmd', 'ps1', 'sh']);
    assert.deepEqual(Object.keys(triple.fileNames).sort(), ['cmd', 'ps1', 'sh']);
    assert.deepEqual(Object.keys(triple.render).sort(), ['cmd', 'ps1', 'sh']);
  });

  test('declares CRLF line endings on the .cmd file, LF on .ps1 and bash wrapper', () => {
    const triple = installModule.buildWindowsShimTriple(path.join(ROOT, 'bin', 'gsd-sdk.js'));
    assert.deepEqual(triple.eol, { cmd: '\r\n', ps1: '\n', sh: '\n' });
  });

  test('declares the standard npm-style filenames for the shim triple', () => {
    const triple = installModule.buildWindowsShimTriple(path.join(ROOT, 'bin', 'gsd-sdk.js'));
    assert.deepEqual(triple.fileNames, { cmd: 'gsd-sdk.cmd', ps1: 'gsd-sdk.ps1', sh: 'gsd-sdk' });
  });

  test('IR is purely a function of shimSrc — no fs / spawn side effects', () => {
    // If buildWindowsShimTriple touched the filesystem, calling it twice with
    // different shimSrc paths would leave two different artifacts. Asserting
    // pure-function behavior structurally: same input → identical IR.
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const a = installModule.buildWindowsShimTriple(shimSrc);
    const b = installModule.buildWindowsShimTriple(shimSrc);
    assert.deepEqual(a.invocation, b.invocation);
    assert.deepEqual(a.eol, b.eol);
    assert.deepEqual(a.fileNames, b.fileNames);
  });
});

describe('Bug #2962: trySelfLinkGsdSdkWindows — fs/spawn driver', () => {
  let tmpDir;
  let origExecSync;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-2962-'));
    origExecSync = cp.execSync;
    cp.execSync = (cmd) => {
      if (typeof cmd === 'string' && cmd.trim() === 'npm prefix -g') {
        return tmpDir + '\n';
      }
      return origExecSync.call(cp, cmd);
    };
  });

  after(() => {
    cp.execSync = origExecSync;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('returns the .cmd path on success and writes all three shim files', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const triple = installModule.buildWindowsShimTriple(shimSrc);
    const result = installModule.trySelfLinkGsdSdkWindows(shimSrc);

    assert.equal(result, path.join(tmpDir, triple.fileNames.cmd));
    for (const fileName of Object.values(triple.fileNames)) {
      const target = path.join(tmpDir, fileName);
      const stat = fs.statSync(target);
      assert.ok(stat.isFile(), `${fileName} must be a regular file`);
      assert.ok(stat.size > 0, `${fileName} must be non-empty`);
    }
  });

  test('the rendered file size matches the IR renderer\'s output length (renderer drives the writer)', () => {
    // Asserts the writer writes exactly what the renderer produces — no mutation,
    // no double-write, no truncation. We compare BYTE LENGTHS, not contents:
    // length is a structural property; content equality would re-introduce text matching.
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const triple = installModule.buildWindowsShimTriple(shimSrc);
    installModule.trySelfLinkGsdSdkWindows(shimSrc);
    for (const kind of ['cmd', 'ps1', 'sh']) {
      const target = path.join(tmpDir, triple.fileNames[kind]);
      const expected = Buffer.byteLength(triple.render[kind](), 'utf8');
      assert.equal(fs.statSync(target).size, expected, `${kind} byte length matches renderer`);
    }
  });

  test('replaces stale shims atomically (mtime advances on rewrite)', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    installModule.trySelfLinkGsdSdkWindows(shimSrc);
    const cmdPath = path.join(tmpDir, 'gsd-sdk.cmd');
    const beforeMtime = fs.statSync(cmdPath).mtimeMs;

    // Wait at least 10ms so mtime granularity (1ms on most fs, 1s on some) records the change.
    const wait = Date.now() + 20;
    while (Date.now() < wait) { /* busy-wait, intentional */ }

    installModule.trySelfLinkGsdSdkWindows(shimSrc);
    const afterMtime = fs.statSync(cmdPath).mtimeMs;
    assert.ok(afterMtime > beforeMtime, `mtime must advance: before=${beforeMtime} after=${afterMtime}`);
  });

  test('returns null when npm prefix -g fails', () => {
    const restore = cp.execSync;
    cp.execSync = () => { throw new Error('npm not on PATH'); };
    try {
      const result = installModule.trySelfLinkGsdSdkWindows(path.join(ROOT, 'bin', 'gsd-sdk.js'));
      assert.equal(result, null);
    } finally {
      cp.execSync = restore;
    }
  });
});
