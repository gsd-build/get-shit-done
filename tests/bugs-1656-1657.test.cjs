/**
 * Regression tests for:
 *   #1656 — 3 bash hooks referenced in settings.json but never installed
 *   #1657 — SDK install prompt fires and fails during interactive install
 */

'use strict';

process.env.GSD_TEST_MODE = '1';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HOOKS_DIST = path.join(__dirname, '..', 'hooks', 'dist');
const BUILD_SCRIPT = path.join(__dirname, '..', 'scripts', 'build-hooks.js');
const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

// ─── #1656 ───────────────────────────────────────────────────────────────────

describe('#1656: community .sh hooks must be present in hooks/dist', () => {
  // Run the build script once before checking outputs.
  // hooks/dist/ is gitignored so it must be generated; this mirrors what
  // `npm run build:hooks` (prepublishOnly) does before publish.
  before(() => {
    execFileSync(process.execPath, [BUILD_SCRIPT], {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  });

  test('gsd-session-state.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'gsd-session-state.sh');
    assert.ok(fs.existsSync(p), 'gsd-session-state.sh must be in hooks/dist/ so the installer can copy it');
  });

  test('gsd-validate-commit.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'gsd-validate-commit.sh');
    assert.ok(fs.existsSync(p), 'gsd-validate-commit.sh must be in hooks/dist/ so the installer can copy it');
  });

  test('gsd-phase-boundary.sh exists in hooks/dist', () => {
    const p = path.join(HOOKS_DIST, 'gsd-phase-boundary.sh');
    assert.ok(fs.existsSync(p), 'gsd-phase-boundary.sh must be in hooks/dist/ so the installer can copy it');
  });
});

// ─── #1657 ───────────────────────────────────────────────────────────────────
//
// Historical context: #1657 originally guarded against a broken `promptSdk()`
// flow that shipped when `@gsd-build/sdk` did not yet exist on npm. The
// package was published at v0.1.0 and is now a hard runtime requirement for
// every /gsd-* command (they all shell out to `gsd-sdk query …`).
//
// #2385 restored the `--sdk` flag and made SDK install the default path in
// bin/install.js. These guards are inverted: we now assert that SDK install
// IS wired up, and that the old broken `promptSdk()` prompt is still gone.

describe('#1657 / #2385: SDK install must be wired into installer source', () => {
  let src;
  test('install.js does not contain the legacy promptSdk() prompt (#1657)', () => {
    src = fs.readFileSync(INSTALL_SRC, 'utf-8');
    assert.ok(
      !src.includes('promptSdk('),
      'promptSdk() must not be reintroduced — the old interactive prompt flow was broken'
    );
  });

  test('install.js wires up --sdk / --no-sdk flag handling (#2385)', () => {
    src = src || fs.readFileSync(INSTALL_SRC, 'utf-8');
    assert.ok(
      src.includes("args.includes('--sdk')"),
      '--sdk flag must be parsed so users can force SDK (re)install'
    );
    assert.ok(
      src.includes("args.includes('--no-sdk')"),
      '--no-sdk flag must be parsed so users can opt out of SDK install'
    );
  });

  test('install.js builds gsd-sdk from in-repo sdk/ source (#2385)', () => {
    src = src || fs.readFileSync(INSTALL_SRC, 'utf-8');
    // The installer must locate the in-repo sdk/ directory, run the build,
    // and install it globally. We intentionally do NOT install
    // @gsd-build/sdk from npm because that published version lags the source
    // tree and shipping it breaks query handlers added since the last
    // publish.
    assert.ok(
      src.includes("path.resolve(__dirname, '..', 'sdk')") ||
      src.includes('path.resolve(__dirname, "..", "sdk")'),
      'installer must locate the in-repo sdk/ directory'
    );
    assert.ok(
      src.includes("'npm install -g .'") ||
      src.includes("['install', '-g', '.']"),
      'installer must run `npm install -g .` from sdk/ to install the built package globally'
    );
    assert.ok(
      src.includes("['run', 'build']"),
      'installer must compile TypeScript via `npm run build` before installing globally'
    );
  });

  test('package.json ships sdk source in published tarball (#2385)', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    const files = rootPkg.files || [];
    assert.ok(
      files.some((f) => f === 'sdk' || f.startsWith('sdk/')),
      'root package.json `files` must include sdk source so npm-registry installs can build gsd-sdk from source'
    );
  });
});
