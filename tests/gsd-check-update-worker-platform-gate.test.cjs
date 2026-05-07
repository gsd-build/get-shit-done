/**
 * Tests for gsd-check-update-worker.js — Windows npm resolution platform gate.
 *
 * Background (issue #3103, PR #3102):
 *   On Windows, `npm` ships as `npm.cmd`. Node's execFileSync does not apply
 *   PATHEXT resolution (unlike execSync/exec) and fails with ENOENT. The fix
 *   is to spawn through a shell on Windows (cmd.exe resolves npm.cmd via
 *   PATHEXT). On POSIX, `npm` is a node-script symlink and resolves without
 *   a shell, so spawning `/bin/sh -c` is pure overhead and changes signal /
 *   exit-code semantics — undesirable.
 *
 * This test locks the contract: shell must be platform-gated to win32 only,
 * never an unconditional `shell: true`. A regression that re-introduces
 * `shell: true` would change POSIX runtime behavior silently — exactly the
 * cross-platform risk that adversarial review on PR #3102 flagged.
 *
 * Source-grep policy: this test reads the worker source via readFileSync.
 * The repo's lint-no-source-grep rule (scripts/lint-no-source-grep.cjs)
 * targets `.cjs` files in bin/lib/get-shit-done — `hooks/*.js` is out of
 * scope. The behavior we need to lock is a single static-spawn-options
 * shape, which only manifests at runtime under Windows; runtime testing
 * would require a Windows CI lane. A structural assertion is the
 * minimum-cost contract.
 */

// allow-test-rule: structural assertion on hook spawn-options shape; the
// behavior being tested (Windows-only shell resolution) is platform-gated
// at runtime and cannot be reached on POSIX CI without a Windows lane.

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORKER_PATH = path.join(__dirname, '..', 'hooks', 'gsd-check-update-worker.js');

describe('gsd-check-update-worker: Windows npm spawn platform gate', () => {
  test('worker file exists', () => {
    assert.ok(fs.existsSync(WORKER_PATH), `worker not found at ${WORKER_PATH}`);
  });

  test('shell option is gated to process.platform === "win32"', () => {
    const src = fs.readFileSync(WORKER_PATH, 'utf8');
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // Locks the platform gate. Allows whitespace/quote variation around
    // the comparison so trivial style fixes do not break the contract.
    const platformGate =
      /shell:\s*process\.platform\s*===\s*['"]win32['"]/;

    assert.match(
      codeOnly,
      platformGate,
      [
        'shell option must be `process.platform === "win32"`.',
        'A regression to `shell: true` would spawn /bin/sh -c on POSIX',
        '(adds shell overhead, changes signal/exit semantics, can mask',
        'windowsHide on some Node versions). See PR #3102.',
      ].join(' '),
    );
  });

  test('no unconditional shell: true on the npm spawn', () => {
    const src = fs.readFileSync(WORKER_PATH, 'utf8');

    // Strip line and block comments so prose mentions of "shell:true" in
    // documentation comments do not trigger the regression check.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

    // Reject literal `shell: true` in CODE only. The correct fix uses
    // `shell: process.platform === 'win32'` (an expression, not the
    // literal `true`), so this never matches the platform-gated form.
    // Trailing `[,\s}]` ensures we match an object-property assignment,
    // not an unrelated identifier.
    const naiveShell = /shell\s*:\s*true\s*[,\s}]/;

    assert.doesNotMatch(
      codeOnly,
      naiveShell,
      'shell: true is forbidden — use `process.platform === "win32"` gate.',
    );
  });

  test('execFileSync is still the spawn primitive (not exec/execSync)', () => {
    const src = fs.readFileSync(WORKER_PATH, 'utf8');

    // execFileSync is intentional: it does not invoke a shell on POSIX,
    // unlike exec/execSync. A regression that swaps to execSync would
    // silently always spawn a shell, defeating the platform gate.
    assert.match(
      src,
      /execFileSync\s*\(\s*['"]npm['"]/,
      'npm spawn must use execFileSync (not exec/execSync) to keep POSIX shell-free.',
    );
  });
});
