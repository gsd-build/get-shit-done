/**
 * Regression test for bug #2647 (also partial fix for #2649).
 *
 * v1.38.3 of get-shit-done-cc shipped with:
 *   - `files` array missing `sdk/dist`
 *   - `prepublishOnly` only running `build:hooks`, not `build:sdk`
 *
 * Result: the published tarball had no `sdk/dist/cli.js`. The `gsd-sdk`
 * bin shim in `bin/gsd-sdk.js` resolves `<pkg>/sdk/dist/cli.js`, which
 * didn't exist, so PATH fell through to the separately installed
 * `@gsd-build/sdk@0.1.0` (predates the `query` subcommand).
 *
 * Every `gsd-sdk query <noun>` call in workflow docs thus failed on
 * fresh installs of 1.38.3.
 *
 * This test guards the OUTER package.json (get-shit-done-cc) so future
 * edits cannot silently drop either safeguard. A sibling test at
 * tests/bug-2519-sdk-tarball-dist.test.cjs guards the inner sdk package.
 *
 * The `npm pack` dry-run assertion makes the guard concrete: if the
 * files whitelist, the prepublishOnly chain, or the shim target ever
 * drift out of alignment, this fails.
 */

'use strict';

const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.join(__dirname, '..');
const PKG_PATH = path.join(REPO_ROOT, 'package.json');
const SHIM_PATH = path.join(REPO_ROOT, 'bin', 'gsd-sdk.js');

describe('bug #2647: outer tarball ships sdk/dist so gsd-sdk query works', () => {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'));
  const filesField = Array.isArray(pkg.files) ? pkg.files : [];
  const scripts = pkg.scripts || {};

  test('package.json `files` includes sdk/dist', () => {
    const hasDist = filesField.some((entry) => {
      if (typeof entry !== 'string') return false;
      const norm = entry.replace(/\\/g, '/').replace(/^\.\//, '');
      return /^sdk\/dist(?:$|\/|\/\*\*|\/\*\*\/\*)/.test(norm);
    });
    assert.ok(
      hasDist,
      `package.json "files" must include "sdk/dist" so the compiled CLI ships in the tarball. Found: ${JSON.stringify(filesField)}`,
    );
  });

  test('package.json declares a build:sdk script', () => {
    assert.ok(
      typeof scripts['build:sdk'] === 'string' && scripts['build:sdk'].length > 0,
      'package.json must define scripts["build:sdk"] to compile sdk/dist before publish',
    );
    assert.ok(
      /\bbuild\b|\btsc\b/.test(scripts['build:sdk']),
      `scripts["build:sdk"] must run a build. Got: ${JSON.stringify(scripts['build:sdk'])}`,
    );
  });

  test('package.json `prepublishOnly` invokes build:sdk', () => {
    const prepub = scripts.prepublishOnly;
    assert.ok(
      typeof prepub === 'string' && prepub.length > 0,
      'package.json must define scripts.prepublishOnly',
    );
    assert.ok(
      /build:sdk\b/.test(prepub),
      `scripts.prepublishOnly must invoke "build:sdk" so sdk/dist exists at pack time. Got: ${JSON.stringify(prepub)}`,
    );
  });

  test('gsd-sdk bin shim resolves sdk/dist/cli.js', () => {
    assert.ok(
      pkg.bin && pkg.bin['gsd-sdk'] === 'bin/gsd-sdk.js',
      `package.json bin["gsd-sdk"] must point at bin/gsd-sdk.js. Got: ${JSON.stringify(pkg.bin)}`,
    );
    const shim = fs.readFileSync(SHIM_PATH, 'utf-8');
    assert.ok(
      /sdk['"],\s*['"]dist['"],\s*['"]cli\.js/.test(shim) ||
        /sdk\/dist\/cli\.js/.test(shim),
      'bin/gsd-sdk.js must resolve ../sdk/dist/cli.js — otherwise shipping sdk/dist does not help',
    );
  });

  test('npm pack dry-run includes sdk/dist/cli.js after build:sdk', { timeout: 180_000 }, () => {
    // Ensure the sdk is built so the pack reflects what publish would ship.
    // The outer prepublishOnly chains through build:sdk, which does `npm ci && npm run build`
    // inside sdk/. We emulate that here without full ci to keep the test fast:
    // if sdk/dist/cli.js already exists, use it; otherwise build.
    const sdkDir = path.join(REPO_ROOT, 'sdk');
    const cliJs = path.join(sdkDir, 'dist', 'cli.js');
    if (!fs.existsSync(cliJs)) {
      // Build requires node_modules; install if missing, then build.
      const sdkNodeModules = path.join(sdkDir, 'node_modules');
      if (!fs.existsSync(sdkNodeModules)) {
        execFileSync('npm', ['ci', '--silent'], { cwd: sdkDir, stdio: 'pipe' });
      }
      execFileSync('npm', ['run', 'build'], { cwd: sdkDir, stdio: 'pipe' });
    }
    assert.ok(fs.existsSync(cliJs), 'sdk build must produce sdk/dist/cli.js');

    const out = execFileSync(
      'npm',
      ['pack', '--dry-run', '--json', '--ignore-scripts'],
      { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString('utf-8');
    const manifest = JSON.parse(out);
    const files = manifest[0].files.map((f) => f.path);
    const cliPresent = files.includes('sdk/dist/cli.js');
    assert.ok(
      cliPresent,
      `npm pack must include sdk/dist/cli.js in the tarball (so "gsd-sdk query" resolves after install). sdk/dist entries found: ${files.filter((p) => p.startsWith('sdk/dist')).length}`,
    );
  });

  test('built sdk CLI exposes the `query` subcommand', { timeout: 60_000 }, () => {
    const cliJs = path.join(REPO_ROOT, 'sdk', 'dist', 'cli.js');
    if (!fs.existsSync(cliJs)) {
      assert.fail('sdk/dist/cli.js missing — the previous test should have built it');
    }
    let stdout = '';
    let stderr = '';
    let status = 0;
    try {
      stdout = execFileSync(process.execPath, [cliJs, 'query', '--help'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      }).toString('utf-8');
    } catch (err) {
      stdout = err.stdout ? err.stdout.toString('utf-8') : '';
      stderr = err.stderr ? err.stderr.toString('utf-8') : '';
      status = err.status ?? 1;
    }
    const combined = `${stdout}\n${stderr}`;
    assert.ok(
      /query/i.test(combined) && !/unknown command|unrecognized/i.test(combined),
      `sdk/dist/cli.js must expose a "query" subcommand. status=${status} output=${combined.slice(0, 500)}`,
    );
  });
});
