'use strict';

process.env.GSD_TEST_MODE = '1';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const INSTALL = require(path.join(ROOT, 'bin', 'install.js'));
const PROJECTION = require(path.join(ROOT, 'get-shit-done', 'bin', 'lib', 'shell-command-projection.cjs'));
const DRIFT_LINT = path.join(ROOT, 'scripts', 'lint-shell-command-projection-drift.cjs');

function runLint(targetFile) {
  return spawnSync(process.execPath, [DRIFT_LINT, targetFile], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

describe('bug #3442: shim/wrapper projection seam', () => {
  test('buildWindowsShimTriple matches shared projection output', () => {
    const shimSrc = path.join(ROOT, 'bin', 'gsd-sdk.js');
    const fromInstall = INSTALL.buildWindowsShimTriple(shimSrc);
    const fromProjection = PROJECTION.buildWindowsShimTriple(shimSrc);
    assert.deepEqual(fromInstall.invocation, fromProjection.invocation);
    assert.deepEqual(fromInstall.eol, fromProjection.eol);
    assert.deepEqual(fromInstall.fileNames, fromProjection.fileNames);
    assert.equal(fromInstall.render.cmd(), fromProjection.render.cmd());
    assert.equal(fromInstall.render.ps1(), fromProjection.render.ps1());
    assert.equal(fromInstall.render.sh(), fromProjection.render.sh());
  });
});

describe('bug #3442: shim/wrapper serialized-command drift guard', () => {
  test('drift guard passes for current install.js', () => {
    const result = runLint(path.join(ROOT, 'bin', 'install.js'));
    assert.equal(result.status, 0, `expected lint pass, got:\n${result.stderr || result.stdout}`);
  });

  test('drift guard fails when install-owned inline shim text builder is present', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3442-'));
    try {
      const fixture = path.join(tmp, 'install-inline-builder.js');
      fs.writeFileSync(
        fixture,
        [
          'function badBuilder() {',
          "  return '@ECHO OFF\\r\\n@SETLOCAL\\r\\n@node \"C:/shim.js\" %*\\r\\n';",
          '}',
          '',
        ].join('\n'),
      );
      const result = runLint(fixture);
      assert.notEqual(result.status, 0, 'inline shim renderer should be rejected by the drift guard');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('drift guard does not block safe subprocess execution patterns', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3442-'));
    try {
      const fixture = path.join(tmp, 'install-subprocess-safe.js');
      fs.writeFileSync(
        fixture,
        [
          "const cp = require('node:child_process');",
          "cp.spawnSync('cmd.exe', ['/c', 'echo ok']);",
          "cp.execFileSync('bash', ['-lc', 'printf %s \"$PATH\"']);",
          '',
        ].join('\n'),
      );
      const result = runLint(fixture);
      assert.equal(result.status, 0, `spawnSync/execFileSync should remain allowed:\n${result.stderr || result.stdout}`);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
