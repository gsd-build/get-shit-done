/**
 * Regression test for bug #2519
 *
 * `@gsd-build/sdk@0.1.0` on npm ships without `dist/` in the tarball.
 * The `package.json` had `prepublishOnly: "npm run build"`, but npm does
 * not reliably invoke prepublishOnly in all publish paths (workspace
 * publish, lerna, CI caches). The result: `npm install -g @gsd-build/sdk`
 * produces a stub-only install and every `gsd-sdk query` call fails.
 *
 * Fix:
 * - Strengthen `prepublishOnly` to `rm -rf dist && tsc && chmod +x dist/cli.js`
 *   (cleans stale builds, recompiles, and sets execute bit at publish time).
 * - Add `"README.md"` to `files` so the npm package page renders correctly.
 *
 * Test plan:
 * - Verify sdk/package.json config invariants.
 * - If sdk/dist/cli.js is present (CI pre-build), verify `npm pack --dry-run`
 *   lists it in the tarball.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const SDK_DIR = path.join(__dirname, '..', 'sdk');
const SDK_PKG = path.join(SDK_DIR, 'package.json');

const sdkPkg = JSON.parse(fs.readFileSync(SDK_PKG, 'utf-8'));

describe('bug #2519: @gsd-build/sdk tarball must ship prebuilt dist/', () => {
  test('sdk/package.json prepublishOnly triggers a clean TypeScript build', () => {
    const po = sdkPkg.scripts?.prepublishOnly;
    assert.ok(po, 'prepublishOnly script must exist');
    assert.ok(
      po.includes('tsc'),
      'prepublishOnly must run tsc so dist/ is built before publish'
    );
    assert.ok(
      po.includes('rm -rf dist'),
      'prepublishOnly must rm -rf dist first to prevent stale artifacts from shadowing fresh builds'
    );
    assert.ok(
      po.includes('chmod +x dist/cli.js'),
      'prepublishOnly must chmod +x dist/cli.js so the bin entry is executable after tarball extraction'
    );
  });

  test('sdk/package.json files array includes dist and README.md', () => {
    assert.ok(Array.isArray(sdkPkg.files), 'files must be an array');
    assert.ok(
      sdkPkg.files.includes('dist'),
      'files array must include "dist" so compiled output ships in the tarball'
    );
    assert.ok(
      sdkPkg.files.includes('README.md'),
      'files array must include "README.md" so npm registry page renders documentation'
    );
  });

  test('npm pack --dry-run lists dist/cli.js when dist is present', () => {
    const distCli = path.join(SDK_DIR, 'dist', 'cli.js');
    const hasDistCli = fs.existsSync(distCli);
    if (!hasDistCli && process.env.CI) {
      assert.fail('sdk/dist/cli.js must exist in CI before tarball validation');
    }
    if (!hasDistCli) {
      // Skip tarball assertion when dist has not been built yet (local dev).
      return;
    }

    const output = execSync('npm pack --dry-run --json', {
      cwd: SDK_DIR,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const packResult = JSON.parse(output);
    const fileList = packResult[0]?.files?.map(f => f.path) || [];

    assert.ok(
      fileList.some(f => f === 'dist/cli.js'),
      'npm pack --dry-run must include dist/cli.js in the tarball after prepublishOnly build'
    );
  });
});
