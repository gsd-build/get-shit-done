/**
 * Regression test for bug #2439
 *
 * /gsd-set-profile crashed with `command not found: gsd-sdk` when the
 * gsd-sdk binary was not installed or not in PATH. The command body
 * invoked `gsd-sdk query config-set-model-profile` directly with no
 * pre-flight check, so missing gsd-sdk produced an opaque shell error.
 *
 * Fix mirrors bug #2334: guard the invocation with `command -v gsd-sdk`
 * and emit an install hint when absent.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const COMMAND_PATH = path.join(__dirname, '..', 'commands', 'gsd', 'set-profile.md');

describe('bug #2439: /gsd-set-profile gsd-sdk pre-flight check', () => {
  const content = fs.readFileSync(COMMAND_PATH, 'utf-8');

  test('command file exists', () => {
    assert.ok(fs.existsSync(COMMAND_PATH), 'commands/gsd/set-profile.md should exist');
  });

  test('guards gsd-sdk invocation with command -v check', () => {
    const sdkCall = content.indexOf('gsd-sdk query config-set-model-profile');
    assert.ok(sdkCall !== -1, 'gsd-sdk query config-set-model-profile must be present');

    const preamble = content.slice(0, sdkCall);
    assert.ok(
      preamble.includes('command -v gsd-sdk') || preamble.includes('which gsd-sdk'),
      'set-profile must check for gsd-sdk in PATH before invoking it. ' +
      'Without this guard the command crashes with exit 127 when gsd-sdk ' +
      'is not installed (root cause of #2439).'
    );
  });

  test('pre-flight error message references install/update path', () => {
    const sdkCall = content.indexOf('gsd-sdk query config-set-model-profile');
    const preamble = content.slice(0, sdkCall);
    const hasInstallHint =
      preamble.includes('@gsd-build/sdk') ||
      preamble.includes('gsd-update') ||
      preamble.includes('/gsd-update');
    assert.ok(
      hasInstallHint,
      'Pre-flight error must point users at `npm install -g @gsd-build/sdk` or `/gsd-update`.'
    );
  });
});
