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

  test('install.js verifies prebuilt sdk/dist/cli.js instead of building from source (#2441)', () => {
    src = src || fs.readFileSync(INSTALL_SRC, 'utf-8');
    // As of fix/2441-sdk-decouple, the installer no longer runs `npm run build`
    // or `npm install -g .` from sdk/. Instead it verifies sdk/dist/cli.js exists
    // (shipped prebuilt in the tarball) and optionally chmods it.
    assert.ok(
      src.includes('sdk/dist/cli.js') || src.includes("'dist', 'cli.js'"),
      'installer must reference sdk/dist/cli.js to verify the prebuilt dist (#2441)'
    );
    // Confirm the old build-from-source pattern is gone.
    const hasBuildFromSource =
      src.includes("['run', 'build']") &&
      src.includes("cwd: sdkDir");
    assert.ok(
      !hasBuildFromSource,
      'installer must NOT run `npm run build` from sdk/ at install time (#2441)'
    );
    const hasGlobalInstall =
      (src.includes("['install', '-g', '.']") || src.includes("'npm install -g .'")) &&
      src.includes("cwd: sdkDir");
    assert.ok(
      !hasGlobalInstall,
      'installer must NOT run `npm install -g .` from sdk/ (#2441)'
    );
  });

  test('package.json ships sdk dist and source in published tarball (#2441)', () => {
    const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));
    const files = rootPkg.files || [];
    assert.ok(
      files.some((f) => f === 'sdk/src' || f.startsWith('sdk/src')),
      'root package.json `files` must include sdk/src'
    );
    assert.ok(
      files.some((f) => f === 'sdk/dist' || f.startsWith('sdk/dist')),
      'root package.json `files` must include sdk/dist so the prebuilt CLI ships in the tarball (#2441)'
    );
  });
});
