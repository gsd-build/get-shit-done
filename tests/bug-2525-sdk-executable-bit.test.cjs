/**
 * Regression test for bug #2525
 *
 * After running the GSD installer on macOS with a Homebrew npm prefix,
 * `gsd-sdk` is installed but `command -v gsd-sdk` returns nothing because
 * `dist/cli.js` is installed with mode 644 (no executable bit). tsc emits
 * .js files as 644, and `npm install -g .` creates the bin symlink without
 * chmod-ing the target. The kernel then refuses to exec the file.
 *
 * Fix: between the `npm run build` step and `npm install -g .`, chmod
 * dist/cli.js to 0o755. This mirrors the pattern already used for hook
 * files at lines 5838, 5846, 5959, and 5965.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INSTALL_PATH = path.join(__dirname, '..', 'bin', 'install.js');

describe('bug #2525: dist/cli.js chmod 0o755 after tsc build', () => {
  test('install.js exists', () => {
    assert.ok(fs.existsSync(INSTALL_PATH), 'bin/install.js should exist');
  });

  test('chmodSync is called for dist/cli.js after the build step', () => {
    const content = fs.readFileSync(INSTALL_PATH, 'utf-8');
    // Find the installSdkIfNeeded function body
    const fnStart = content.indexOf('function installSdkIfNeeded()');
    assert.ok(fnStart !== -1, 'installSdkIfNeeded function must exist in bin/install.js');

    // Find the closing brace of the function (next top-level function definition)
    const nextFnIdx = content.indexOf('\nfunction ', fnStart + 1);
    const fnEnd = nextFnIdx === -1 ? content.length : nextFnIdx;
    const fnBody = content.slice(fnStart, fnEnd);

    // Locate the build step
    const buildStep = fnBody.indexOf("'run', 'build'");
    assert.ok(buildStep !== -1, "installSdkIfNeeded must contain the 'run', 'build' spawn call");

    // Locate the global install step
    const globalStep = fnBody.indexOf("'install', '-g', '.'");
    assert.ok(globalStep !== -1, "installSdkIfNeeded must contain the 'install', '-g', '.' spawn call");

    // Locate chmodSync for dist/cli.js
    const chmodIdx = fnBody.indexOf("chmodSync");
    assert.ok(chmodIdx !== -1, "installSdkIfNeeded must call chmodSync to set the executable bit on dist/cli.js");

    // The path may be assembled via path.join(sdkDir, 'dist', 'cli.js') so check
    // for the component strings rather than the joined slash form.
    const cliPathIdx = fnBody.indexOf("'cli.js'");
    assert.ok(cliPathIdx !== -1, "installSdkIfNeeded must reference 'cli.js' (via path.join or literal) for the chmod call");

    // chmodSync must appear AFTER the build step
    assert.ok(
      chmodIdx > buildStep,
      'chmodSync for dist/cli.js must appear AFTER the npm run build step'
    );

    // chmodSync must appear AFTER the global install step
    assert.ok(
      chmodIdx > globalStep,
      'chmodSync for dist/cli.js must appear AFTER the npm install -g . step'
    );
  });

  test('chmod mode is 0o755', () => {
    const content = fs.readFileSync(INSTALL_PATH, 'utf-8');
    const fnStart = content.indexOf('function installSdkIfNeeded()');
    const nextFnIdx = content.indexOf('\nfunction ', fnStart + 1);
    const fnEnd = nextFnIdx === -1 ? content.length : nextFnIdx;
    const fnBody = content.slice(fnStart, fnEnd);

    assert.ok(
      fnBody.includes('0o755'),
      "chmodSync call in installSdkIfNeeded must use mode 0o755 (not 0o644 or a bare number)"
    );
  });
});
