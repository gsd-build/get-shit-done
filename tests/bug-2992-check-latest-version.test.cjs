'use strict';
process.env.GSD_TEST_MODE = '1';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const { checkLatestVersion, CHECK_REASON, PACKAGE_NAME } = require(
  path.join(ROOT, 'get-shit-done', 'bin', 'check-latest-version.cjs'),
);

// checkLatestVersion is a pure-ish function: it spawns one fixed npm
// command, validates the output, and returns { ok, version | reason }.
// The package name is HARDCODED — not a free choice for the caller.
// Tests use a pluggable spawn so no real npm process is invoked.

describe('Bug #2992: deterministic latest-version check', () => {
  test('PACKAGE_NAME is the constant get-shit-done-cc (no callers can override)', () => {
    assert.equal(PACKAGE_NAME, 'get-shit-done-cc');
  });

  test('CHECK_REASON enum exposes the documented codes', () => {
    assert.deepEqual(
      Object.keys(CHECK_REASON).sort(),
      ['FAIL_INVALID_OUTPUT', 'FAIL_NPM_FAILED', 'OK'].sort(),
    );
  });

  test('returns { ok: true, version } when npm prints a valid semver', () => {
    const fakeSpawn = () => ({ status: 0, stdout: '1.39.1\n', stderr: '' });
    const r = checkLatestVersion({ spawn: fakeSpawn });
    assert.deepEqual(r, { ok: true, version: '1.39.1', reason: CHECK_REASON.OK });
  });
});

describe('Bug #2992: error paths', () => {
  const { checkLatestVersion, CHECK_REASON } = require(require('node:path').join(__dirname, '..', 'get-shit-done', 'bin', 'check-latest-version.cjs'));

  test('FAIL_NPM_FAILED when npm exits non-zero (e.g. offline, 404)', () => {
    const r = checkLatestVersion({
      spawn: () => ({ status: 1, stdout: '', stderr: 'npm ERR! 404\n' }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, CHECK_REASON.FAIL_NPM_FAILED);
    assert.equal(r.detail, 'npm ERR! 404',
      'detail should be the trimmed stderr when npm reports a real error');
  });

  // #2993 CR: distinguish timeout from genuine npm failure in `detail`.
  // spawnSync sets status=null and signal='SIGTERM' on timeout; stderr is
  // typically empty. Without the signal-first branch, both shape as
  // 'npm exited non-zero' and the operator cannot tell timeout from failure.
  test('FAIL_NPM_FAILED detail names the signal when spawn times out', () => {
    const r = checkLatestVersion({
      spawn: () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, CHECK_REASON.FAIL_NPM_FAILED);
    assert.equal(r.detail, 'npm timed out (signal: SIGTERM)',
      'detail should explicitly name the signal when status is null and signal is set');
  });

  test('FAIL_NPM_FAILED detail falls back to generic when neither stderr nor signal is present', () => {
    const r = checkLatestVersion({
      spawn: () => ({ status: 1, stdout: '', stderr: '' }),
    });
    assert.equal(r.detail, 'npm exited non-zero');
  });

  test('FAIL_INVALID_OUTPUT when npm prints something that is not a semver', () => {
    // E.g. if a future npm version changes the output format, or if the
    // network returns an HTML error page captured as stdout.
    const r = checkLatestVersion({
      spawn: () => ({ status: 0, stdout: '<html>not a version</html>\n', stderr: '' }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, CHECK_REASON.FAIL_INVALID_OUTPUT);
  });

  test('FAIL_INVALID_OUTPUT when stdout is empty', () => {
    const r = checkLatestVersion({
      spawn: () => ({ status: 0, stdout: '', stderr: '' }),
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, CHECK_REASON.FAIL_INVALID_OUTPUT);
  });

  test('accepts pre-release semver (e.g. 1.40.0-rc.1)', () => {
    const r = checkLatestVersion({
      spawn: () => ({ status: 0, stdout: '1.40.0-rc.1\n', stderr: '' }),
    });
    assert.deepEqual(r, { ok: true, version: '1.40.0-rc.1', reason: CHECK_REASON.OK });
  });
});
