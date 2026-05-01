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
