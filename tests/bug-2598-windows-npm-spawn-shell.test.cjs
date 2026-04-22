/**
 * Regression test for bug #2598
 *
 * On Windows, Node.js refuses to spawn `.cmd`/`.bat` files via spawnSync
 * unless `shell: true` is passed (post CVE-2024-27980, fixed in
 * Node >= 18.20.2 / >= 20.12.2 / >= 21.7.3 and every version since).
 *
 * installSdkIfNeeded() picks `npmCmd = 'npm.cmd'` on win32 and then shells
 * out five times: `npm install`, `npm run build`, `npm install -g .`, and
 * two `npm config get prefix` calls. Without `shell: true`, every single
 * one of those returns `{ status: null, error: EINVAL }` before npm ever
 * launches. The installer checks `status !== 0` (null !== 0 is true) and
 * trips its failure path — producing a silent SDK build failure with zero
 * diagnostic output because `stdio: 'inherit'` never got a child to stream.
 *
 * Fix: every spawnSync that targets `npmCmd` inside installSdkIfNeeded
 * must pass `shell: true` on Windows. The structural invariant verified
 * here is that no bare `spawnSync(npmCmd, ...)` remains inside the
 * function — all npm invocations go through a helper that injects the
 * shell option on win32 (or have it explicitly on the call site).
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const INSTALL_SRC = path.join(__dirname, '..', 'bin', 'install.js');

function installSdkBody() {
  const src = fs.readFileSync(INSTALL_SRC, 'utf-8');
  const fnStart = src.indexOf('function installSdkIfNeeded()');
  assert.ok(fnStart !== -1, 'installSdkIfNeeded function must exist in install.js');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  return fnEnd !== -1 ? src.slice(fnStart, fnEnd) : src.slice(fnStart);
}

describe('bug #2598: Windows npm.cmd spawnSync must pass shell: true', () => {
  test('install.js source exists', () => {
    assert.ok(fs.existsSync(INSTALL_SRC), 'bin/install.js must exist');
  });

  test('installSdkIfNeeded does not call spawnSync(npmCmd, ...) directly', () => {
    const body = installSdkBody();
    // A bare `spawnSync(npmCmd,` call will fail with EINVAL on Windows
    // because npm.cmd requires `shell: true`. Every npm invocation must
    // go through a wrapper that injects the shell option on win32.
    //
    // Exclude the implementation of the wrapper itself (its `spawnSync(npmCmd, args, ...)`
    // line is the ONE legitimate place that spawns npmCmd directly — and it forwards
    // a shell option from `opts`).
    const allCalls = body.match(/spawnSync\s*\(\s*npmCmd[^)]*\)/g) || [];
    const bareCalls = allCalls.filter(c => !/\bshell\s*:/.test(c));
    assert.equal(
      bareCalls.length,
      0,
      'installSdkIfNeeded must not call spawnSync(npmCmd, ...) directly. ' +
      'On Windows, npm.cmd spawns fail with EINVAL (CVE-2024-27980) unless ' +
      'shell: true is passed. Route all npm invocations through a helper ' +
      'that injects `shell: process.platform === "win32"`.'
    );
  });

  test('installSdkIfNeeded defines a shell-aware npm wrapper', () => {
    const body = installSdkBody();
    // The canonical implementation introduces `spawnNpm` (or equivalent)
    // that injects `shell: true` on win32. Accept either a helper
    // function or `shell: true` / `shell: needsShell` / `shell: win32`
    // appearing alongside an npm spawn.
    const hasHelper = /\bspawnNpm\b/.test(body);
    const hasShellOption = /shell\s*:\s*(true|needsShell|process\.platform\s*===\s*['"]win32['"])/.test(body);
    assert.ok(
      hasHelper || hasShellOption,
      'installSdkIfNeeded must introduce a helper or pass shell:true/win32-aware ' +
      'shell option for npm spawnSync calls. Found neither.'
    );
  });

  test('installSdkIfNeeded calls the npm wrapper at least five times', () => {
    const body = installSdkBody();
    // Five documented npm invocations: install, run build, install -g .,
    // and two config get prefix calls. If any are still bare spawnSync
    // calls targeting npmCmd, the first assertion above already fails.
    // `\bspawnNpm\s*\(` matches real call sites only — a `const spawnNpm = (…)`
    // declaration does not match because `=` sits between name and `(`. A
    // `function spawnNpm(…)` declaration WOULD match, so subtract one for that
    // form. `explicitShellNpm` previously double-counted the wrapper's own
    // `spawnSync(npmCmd, args, { …, shell })` — when a helper exists, its body
    // is the only legitimate raw spawn and must be excluded.
    const wrapperCallMatches = (body.match(/\bspawnNpm\s*\(/g) || []).length;
    const hasArrowHelper = /\b(?:const|let|var)\s+spawnNpm\s*=/.test(body);
    const hasFunctionHelper = /\bfunction\s+spawnNpm\s*\(/.test(body);
    const hasHelper = hasArrowHelper || hasFunctionHelper;
    const wrapperCalls = hasFunctionHelper
      ? Math.max(0, wrapperCallMatches - 1)
      : wrapperCallMatches;
    const explicitShellNpm = hasHelper
      ? 0
      : (body.match(/spawnSync\s*\(\s*npmCmd[^)]*\bshell\s*:/g) || []).length;
    const total = wrapperCalls + explicitShellNpm;
    assert.ok(
      total >= 5,
      `installSdkIfNeeded should route at least 5 npm invocations through ` +
      `a shell-aware wrapper (install, run build, install -g ., and two ` +
      `config get prefix calls). Found ${total}.`
    );
  });

  test('installSdkIfNeeded surfaces underlying spawnSync failure in fatal branches', () => {
    // Root cause of #2598 was invisible because `{ status: null, error: EINVAL }`
    // was reduced to a generic "Failed to `npm install` in sdk/." with no
    // diagnostic — stdio: 'inherit' had no child to stream and result.error was
    // dropped. Each of the three `emitSdkFatal` calls inside the install/build/
    // global-install failure paths must now thread spawn diagnostics (error,
    // signal, or numeric status) into the reason string so future regressions
    // print their real cause instead of failing silently.
    const body = installSdkBody();
    const hasFormatter = /formatSpawnFailure\s*\(/.test(body);
    const fatalCalls = body.match(/emitSdkFatal\s*\([^)]*`[^`]*`[^)]*\)/gs) || [];
    const fatalWithDiagnostic = fatalCalls.filter(
      (c) => /formatSpawnFailure|\.error|\.signal|\.status/.test(c),
    );
    assert.ok(
      hasFormatter,
      'installSdkIfNeeded must define a spawn-failure formatter so fatal ' +
      'npm failures surface result.error / result.signal / result.status ' +
      'instead of swallowing them (root cause of #2598 being invisible).',
    );
    assert.ok(
      fatalWithDiagnostic.length >= 3,
      `At least 3 emitSdkFatal calls (install, build, install -g .) must ` +
      `include spawn diagnostics. Found ${fatalWithDiagnostic.length} that ` +
      `reference formatSpawnFailure or result.error/signal/status.`,
    );
  });
});
