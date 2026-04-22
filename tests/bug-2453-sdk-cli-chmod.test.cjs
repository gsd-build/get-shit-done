/**
 * Regression test for bug #2453
 *
 * installSdkIfNeeded() builds sdk/dist/cli.js via `tsc` then runs
 * `npm install -g .`. TypeScript emits files at process umask (0o644) and
 * npm install from a local directory does NOT chmod bin-script targets the
 * way tarball extraction does. The result: the globally-installed
 * dist/cli.js lands with mode 644 (non-executable), the `gsd-sdk` symlink
 * points at a non-executable file, and `command -v gsd-sdk` fails on every
 * new install.
 *
 * Fix: after `npm install -g .`, the installer must explicitly
 * `chmodSync(cliPath, 0o755)` on the installed dist/cli.js. This mirrors
 * the pattern already used four times in install.js for hook files.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

describe('bug #2453: installSdkIfNeeded chmods sdk dist/cli.js to 0o755', () => {
  let installSrc;

  test('install.js source exists', () => {
    assert.ok(fs.existsSync(INSTALL_SRC), 'bin/install.js must exist');
    installSrc = fs.readFileSync(INSTALL_SRC, 'utf-8');
  });

  test('installSdkIfNeeded contains a chmodSync call for dist/cli.js', () => {
    installSrc = installSrc || fs.readFileSync(INSTALL_SRC, 'utf-8');

    // Locate the installSdkIfNeeded function body
    const fnStart = installSrc.indexOf('function installSdkIfNeeded()');
    assert.ok(fnStart !== -1, 'installSdkIfNeeded function must exist in install.js');

    // Find the end of the function (next top-level function declaration)
    const fnEnd = installSrc.indexOf('\nfunction ', fnStart + 1);
    const fnBody = fnEnd !== -1 ? installSrc.slice(fnStart, fnEnd) : installSrc.slice(fnStart);

    // Must chmod dist/cli.js to make it executable after npm install -g .
    const hasChmod = fnBody.includes('chmodSync') && fnBody.includes('dist/cli.js');
    assert.ok(
      hasChmod,
      'installSdkIfNeeded must call chmodSync on dist/cli.js after npm install -g . ' +
      '(tsc emits 644; npm does not chmod bin targets from local dir installs — ' +
      'root cause of #2453: gsd-sdk symlink target is non-executable on first install)'
    );
  });

  test('chmodSync for dist/cli.js uses mode 0o755', () => {
    installSrc = installSrc || fs.readFileSync(INSTALL_SRC, 'utf-8');

    const fnStart = installSrc.indexOf('function installSdkIfNeeded()');
    const fnEnd = installSrc.indexOf('\nfunction ', fnStart + 1);
    const fnBody = fnEnd !== -1 ? installSrc.slice(fnStart, fnEnd) : installSrc.slice(fnStart);

    // The chmod call must use 0o755 (executable), not 0o644
    const has755 = fnBody.includes('0o755') && fnBody.includes('dist/cli.js');
    assert.ok(
      has755,
      'chmodSync for dist/cli.js must use mode 0o755 to make the binary executable'
    );
  });

  test('chmodSync appears after npm install -g . step', () => {
    installSrc = installSrc || fs.readFileSync(INSTALL_SRC, 'utf-8');

    const fnStart = installSrc.indexOf('function installSdkIfNeeded()');
    const fnEnd = installSrc.indexOf('\nfunction ', fnStart + 1);
    const fnBody = fnEnd !== -1 ? installSrc.slice(fnStart, fnEnd) : installSrc.slice(fnStart);

    const npmGlobalIdx = fnBody.indexOf("'install', '-g', '.'");
    const chmodIdx = fnBody.indexOf('chmodSync');

    assert.ok(npmGlobalIdx !== -1, "npm install -g . step must be present in installSdkIfNeeded");
    assert.ok(chmodIdx !== -1, 'chmodSync must be present in installSdkIfNeeded');
    assert.ok(
      chmodIdx > npmGlobalIdx,
      'chmodSync must appear AFTER the npm install -g . step ' +
      '(the file to chmod does not exist until npm installs it globally)'
    );
  });
});
