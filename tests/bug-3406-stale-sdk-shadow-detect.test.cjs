'use strict';

/**
 * Regression tests for #3406 — stale globally-installed `@gsd-build/sdk@0.1.0`
 * shadows the `gsd-sdk` shim that `get-shit-done-cc` installs. The standalone
 * 0.1.0 binary only knows `run | auto | init` (no `query` subcommand), so
 * every workflow that calls `gsd-sdk query <command>` fails until the user
 * runs `npm uninstall -g @gsd-build/sdk`.
 *
 * Maintainer decision (per triage): option 2 — detect-and-warn during
 * install. This test pins the pure detection helper so the install-time
 * warning fires on the right input and stays silent otherwise.
 *
 * Test surface is the exported helper `detectStaleStandaloneSdk(runNpmLs)`.
 * `runNpmLs` is an injected executor: in production it spawns
 * `npm ls -g @gsd-build/sdk --json --depth=0`; in tests we hand it a stub
 * that returns canned stdout / throws, so the test never touches the host
 * npm state.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

process.env.GSD_TEST_MODE = '1';
const installer = require('../bin/install.js');
const { detectStaleStandaloneSdk } = installer;

describe('#3406: detectStaleStandaloneSdk', () => {
  test('is exported from bin/install.js under GSD_TEST_MODE', () => {
    assert.strictEqual(
      typeof detectStaleStandaloneSdk,
      'function',
      'detectStaleStandaloneSdk must be exported for install-time wiring + tests'
    );
  });

  test('returns { stale: false } when npm ls reports the package is not installed', () => {
    // `npm ls -g @gsd-build/sdk --json --depth=0` exit code 1 with this
    // JSON shape is the standard "not present" signal.
    const stub = () => JSON.stringify({
      name: 'lib',
      dependencies: {},
    });
    const result = detectStaleStandaloneSdk(stub);
    assert.deepStrictEqual(result, { stale: false });
  });

  test('returns { stale: true, version, path? } when @gsd-build/sdk is present', () => {
    const stub = () => JSON.stringify({
      name: 'lib',
      dependencies: {
        '@gsd-build/sdk': {
          version: '0.1.0',
          resolved: 'file:/Users/REDACTED/.nvm/versions/node/v24.15.0/lib/node_modules/@gsd-build/sdk',
        },
      },
    });
    const result = detectStaleStandaloneSdk(stub);
    assert.strictEqual(result.stale, true);
    assert.strictEqual(result.version, '0.1.0');
  });

  test('returns { stale: false } when runNpmLs throws (npm missing / EACCES)', () => {
    const stub = () => { throw new Error('npm: command not found'); };
    const result = detectStaleStandaloneSdk(stub);
    assert.deepStrictEqual(result, { stale: false });
  });

  test('returns { stale: false } when runNpmLs returns malformed JSON', () => {
    const stub = () => 'not-json-at-all';
    const result = detectStaleStandaloneSdk(stub);
    assert.deepStrictEqual(result, { stale: false });
  });

  test('returns { stale: false } when the JSON has no dependencies field', () => {
    const stub = () => JSON.stringify({ name: 'lib' });
    const result = detectStaleStandaloneSdk(stub);
    assert.deepStrictEqual(result, { stale: false });
  });

  test('returns { stale: false } when runNpmLs returns null/undefined', () => {
    const resultNull = detectStaleStandaloneSdk(() => null);
    const resultUndef = detectStaleStandaloneSdk(() => undefined);
    assert.deepStrictEqual(resultNull, { stale: false });
    assert.deepStrictEqual(resultUndef, { stale: false });
  });

  test('returns { stale: false } for non-0.1.0 versions (CR #3406)', () => {
    // Only 0.1.0 is the known-bad shadow. Any newer or unrelated published
    // version is an intentional install (or a future republish) and must
    // NOT be flagged. Without this gate, every maintainer with a local-link
    // or any future publish would trigger a misleading warning on install.
    const stubNewer = () => JSON.stringify({ dependencies: { '@gsd-build/sdk': { version: '1.50.0-canary.0' } } });
    const stubFuture = () => JSON.stringify({ dependencies: { '@gsd-build/sdk': { version: '2.0.0' } } });
    assert.deepStrictEqual(detectStaleStandaloneSdk(stubNewer), { stale: false });
    assert.deepStrictEqual(detectStaleStandaloneSdk(stubFuture), { stale: false });
  });
});

describe('#3406: install-time wiring stays silent when no stale package is found', () => {
  // We can't easily stub npm inside a spawned install subprocess without
  // shelling around it, so the install-side coverage here verifies the
  // negative case: when @gsd-build/sdk is NOT installed globally (the npm
  // dependency tree on CI is irrelevant — we use a doctored PATH that points
  // npm at an empty prefix), the install run prints NO #3406 warning. The
  // positive case is exhaustively covered by detectStaleStandaloneSdk above.
  const path = require('node:path');
  const fs = require('node:fs');
  const os = require('node:os');
  const { execFileSync } = require('node:child_process');

  test('install does not emit the stale-SDK warning on a clean npm prefix', () => {
    const installScript = path.resolve(__dirname, '..', 'bin', 'install.js');
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3406-home-'));
    const tmpPrefix = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-3406-npm-'));
    try {
      const stdout = execFileSync(
        process.execPath,
        [installScript, '--claude', '--global', '--yes', '--no-sdk'],
        {
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CLAUDE_CONFIG_DIR: tmpHome,
            npm_config_prefix: tmpPrefix,
            // Detect-and-warn must execute, just find nothing — so do NOT set
            // GSD_SKIP_STALE_SDK_CHECK here.
          },
          timeout: 60_000,
        }
      );
      assert.ok(
        !stdout.includes('@gsd-build/sdk'),
        'install output must not mention @gsd-build/sdk when the package is absent'
      );
      assert.ok(
        !stdout.includes('#3406'),
        'install output must not reference #3406 when no stale shadow is present'
      );
    } finally {
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch { /* ignore */ }
      try { fs.rmSync(tmpPrefix, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  });
});

describe('#3406: formatStaleStandaloneSdkWarning', () => {
  const { formatStaleStandaloneSdkWarning } = installer;

  test('is exported from bin/install.js under GSD_TEST_MODE', () => {
    assert.strictEqual(
      typeof formatStaleStandaloneSdkWarning,
      'function',
      'formatStaleStandaloneSdkWarning must be exported for tests'
    );
  });

  test('message names the stale package, the version, and the uninstall command', () => {
    const out = formatStaleStandaloneSdkWarning({ stale: true, version: '0.1.0' });
    assert.ok(out.includes('@gsd-build/sdk'), 'must name the shadowing package');
    assert.ok(out.includes('0.1.0'), 'must show the stale version');
    assert.ok(
      out.includes('npm uninstall -g @gsd-build/sdk'),
      'must include the remediation command verbatim'
    );
    assert.ok(out.includes('#3406'), 'must reference the issue for traceability');
  });
});
