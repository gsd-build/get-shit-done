/**
 * Regression tests for fix/2441-sdk-decouple
 *
 * Verifies the architectural invariants introduced by the SDK decouple:
 *
 * (a) bin/install.js does NOT invoke `npm install -g` for the SDK at all.
 *     The old `installSdkIfNeeded()` built from source and ran `npm install -g .`
 *     in sdk/; the new version only verifies the prebuilt dist.
 *
 * (b) The parent package.json declares a `gsd-sdk` bin entry pointing at
 *     bin/gsd-sdk.js (the back-compat shim), so npm chmods it correctly.
 *
 * (c) sdk/dist/ is in the parent package `files` so it ships in the tarball.
 *
 * (d) sdk/package.json `prepublishOnly` runs `rm -rf dist && tsc && chmod +x dist/cli.js`
 *     (guards against the mode-644 bug and npm's stale-prepublishOnly issue).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INSTALL_JS = path.join(__dirname, '..', 'bin', 'install.js');
const ROOT_PKG = path.join(__dirname, '..', 'package.json');
const SDK_PKG = path.join(__dirname, '..', 'sdk', 'package.json');
const GSD_SDK_SHIM = path.join(__dirname, '..', 'bin', 'gsd-sdk.js');

const installContent = fs.readFileSync(INSTALL_JS, 'utf-8');
const rootPkg = JSON.parse(fs.readFileSync(ROOT_PKG, 'utf-8'));
const sdkPkg = JSON.parse(fs.readFileSync(SDK_PKG, 'utf-8'));

describe('fix #2441: SDK decouple — installer no longer builds from source', () => {
  test('bin/install.js does not call npm install -g in sdk/', () => {
    // The old approach ran `npm install -g .` from sdk/. This must be gone.
    // We check for the specific pattern that installed the SDK globally.
    const hasGlobalInstallFromSdk =
      /spawnSync\(npmCmd,\s*\[['"]install['"],\s*['"](-g|--global)['"]/m.test(installContent) &&
      /cwd:\s*sdkDir/.test(installContent);
    assert.ok(
      !hasGlobalInstallFromSdk,
      'bin/install.js must not run `npm install -g .` from sdk/. ' +
      'The SDK is shipped prebuilt in the tarball (fix #2441).'
    );
  });

  test('bin/install.js does not run npm run build in sdk/', () => {
    // The old approach ran `npm run build` (tsc) at install time.
    const hasBuildStep =
      /spawnSync\(npmCmd,\s*\[['"]run['"],\s*['"]build['"]\]/m.test(installContent) &&
      /cwd:\s*sdkDir/.test(installContent);
    assert.ok(
      !hasBuildStep,
      'bin/install.js must not run `npm run build` in sdk/ at install time. ' +
      'TypeScript compilation happens at publish time via prepublishOnly.'
    );
  });

  test('installSdkIfNeeded checks sdk/dist/cli.js exists instead of building', () => {
    assert.ok(
      installContent.includes('sdk/dist/cli.js') || installContent.includes("'dist', 'cli.js'"),
      'installSdkIfNeeded() must reference sdk/dist/cli.js to verify the prebuilt dist.'
    );
  });
});

describe('fix #2441: back-compat shim — parent package bin entry', () => {
  test('root package.json declares gsd-sdk bin entry', () => {
    assert.ok(
      rootPkg.bin && rootPkg.bin['gsd-sdk'],
      'root package.json must have a bin["gsd-sdk"] entry for the back-compat shim.'
    );
  });

  test('gsd-sdk bin entry points at bin/gsd-sdk.js', () => {
    assert.equal(
      rootPkg.bin['gsd-sdk'],
      'bin/gsd-sdk.js',
      'bin["gsd-sdk"] must point at bin/gsd-sdk.js'
    );
  });

  test('bin/gsd-sdk.js shim file exists', () => {
    assert.ok(
      fs.existsSync(GSD_SDK_SHIM),
      'bin/gsd-sdk.js must exist as the back-compat PATH shim.'
    );
  });

  test('bin/gsd-sdk.js resolves sdk/dist/cli.js relative to itself', () => {
    const shimContent = fs.readFileSync(GSD_SDK_SHIM, 'utf-8');
    // Require the actual path.resolve call with the expected segments, not
    // loose substring matches that would pass from comments or shebangs.
    assert.match(
      shimContent,
      /path\.resolve\(\s*__dirname\s*,\s*['"]\.\.['"]\s*,\s*['"]sdk['"]\s*,\s*['"]dist['"]\s*,\s*['"]cli\.js['"]\s*\)/,
      'bin/gsd-sdk.js must call path.resolve(__dirname, "..", "sdk", "dist", "cli.js") to locate the prebuilt CLI.'
    );
  });

  test('bin/gsd-sdk.js invokes cli.js via spawnSync(process.execPath, ...)', () => {
    const shimContent = fs.readFileSync(GSD_SDK_SHIM, 'utf-8');
    // The shim must invoke via node (not rely on execute bit), which means
    // spawnSync(process.execPath, [cliPath, ...args]).
    assert.match(
      shimContent,
      /spawnSync\(\s*process\.execPath\s*,/,
      'bin/gsd-sdk.js must spawn node via process.execPath so the execute bit on cli.js is irrelevant (#2453).'
    );
    assert.match(
      shimContent,
      /process\.argv\.slice\(\s*2\s*\)/,
      'bin/gsd-sdk.js must forward user args via process.argv.slice(2).'
    );
    assert.match(
      shimContent,
      /process\.exit\(/,
      'bin/gsd-sdk.js must propagate the child exit status via process.exit.'
    );
  });
});

describe('fix #2441: sdk/dist shipped in tarball', () => {
  test('root package.json files includes sdk/dist', () => {
    assert.ok(
      Array.isArray(rootPkg.files) && rootPkg.files.some(f => f === 'sdk/dist' || f.startsWith('sdk/dist')),
      'root package.json files must include "sdk/dist" so the prebuilt CLI ships in the tarball.'
    );
  });

  test('root package.json files still includes sdk/src (for dev/clone builds)', () => {
    assert.ok(
      Array.isArray(rootPkg.files) && rootPkg.files.some(f => f === 'sdk/src' || f.startsWith('sdk/src')),
      'root package.json files should still include sdk/src for developer builds.'
    );
  });
});

describe('fix #2453: sdk/package.json prepublishOnly guards execute bit', () => {
  test('sdk prepublishOnly deletes old dist before build (npm stale-prepublishOnly guard)', () => {
    const prepub = sdkPkg.scripts && sdkPkg.scripts.prepublishOnly;
    assert.ok(
      prepub && prepub.includes('rm -rf dist'),
      'sdk/package.json prepublishOnly must start with `rm -rf dist` to avoid stale build output.'
    );
  });

  test('sdk prepublishOnly chmods dist/cli.js after tsc', () => {
    const prepub = sdkPkg.scripts && sdkPkg.scripts.prepublishOnly;
    assert.ok(
      prepub && prepub.includes('chmod +x dist/cli.js'),
      'sdk/package.json prepublishOnly must run `chmod +x dist/cli.js` after tsc to fix mode-644 (#2453).'
    );
  });

  test('sdk prepublishOnly runs tsc', () => {
    const prepub = sdkPkg.scripts && sdkPkg.scripts.prepublishOnly;
    assert.ok(
      prepub && prepub.includes('tsc'),
      'sdk/package.json prepublishOnly must include tsc to compile TypeScript.'
    );
  });
});
