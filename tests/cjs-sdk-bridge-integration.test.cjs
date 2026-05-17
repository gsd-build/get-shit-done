'use strict';

/**
 * Integration test for `get-shit-done/bin/lib/cjs-sdk-bridge.cjs` — locks the
 * load-success invariant that Phase 5/6 silently violated before this PR.
 *
 * Original bug: the bridge used `require('@gsd-build/sdk')` to load the
 * runtime-bridge module. That package name is not resolvable from the root
 * `node_modules` (the SDK lives at `./sdk/` as a sibling, not a dependency),
 * and even if it were, the public entry didn't expose `executeForCjs` or
 * `formatStateLoadRawStdout`. `tryLoadSdk()` always returned false,
 * `_loadFailed` was cached for the process lifetime, and every CJS router
 * silently fell through to the CJS fallback path — making the entire
 * CJS→SDK delegation in Phase 5/6 dead code. CI passed because the fallback
 * still executed CJS handlers, masking the regression.
 *
 * This test proves:
 *   1. `tryLoadSdk()` returns true on the current checkout.
 *   2. `getExecuteForCjs()` returns a real function (not null).
 *   3. `getFormatStateLoadRawStdout()` returns a real function (not null).
 *   4. Calling `executeForCjs` with a real canonical registry command
 *      produces a successful SDK result — proving the bridge actually
 *      dispatches through the runtime bridge rather than failing/falling back.
 *
 * Requires `sdk/dist/` to exist (i.e. `npm run build:sdk` has run). The
 * project's `pretest` hook runs `build:sdk` before tests, so this is met by
 * default. If `dist/` is missing, the assertion failures in this file
 * surface the cause directly rather than silently masking under fallback.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const BRIDGE_PATH = path.join(__dirname, '..', 'get-shit-done', 'bin', 'lib', 'cjs-sdk-bridge.cjs');

describe('cjs-sdk-bridge: SDK runtime bridge integration', () => {
  test('tryLoadSdk() resolves the bundled SDK on the current checkout', () => {
    // Fresh require each run so module-level caches reset.
    delete require.cache[require.resolve(BRIDGE_PATH)];
    const bridge = require(BRIDGE_PATH);
    const loaded = bridge.tryLoadSdk();
    assert.strictEqual(
      loaded,
      true,
      'tryLoadSdk() must return true; if false, the bridge can no longer ' +
        'locate sdk/dist/runtime-bridge-sync/index.js or its exports — every ' +
        'CJS router will fall back to the per-side CJS handler.',
    );
  });

  test('getExecuteForCjs() returns a function after a successful load', () => {
    const bridge = require(BRIDGE_PATH);
    bridge.tryLoadSdk();
    assert.strictEqual(typeof bridge.getExecuteForCjs(), 'function');
  });

  test('getFormatStateLoadRawStdout() returns a function after a successful load', () => {
    const bridge = require(BRIDGE_PATH);
    bridge.tryLoadSdk();
    assert.strictEqual(typeof bridge.getFormatStateLoadRawStdout(), 'function');
  });

  test('executeForCjs() actually dispatches a canonical registry command (not a fallback)', () => {
    const bridge = require(BRIDGE_PATH);
    assert.strictEqual(bridge.tryLoadSdk(), true);
    const executeForCjs = bridge.getExecuteForCjs();

    // `generate-slug` is a canonical, project-independent command in the SDK
    // registry. It does not require a `.planning/` fixture, so its success
    // proves the bridge dispatch path works end-to-end without confounding
    // it with project-state setup. Same command Phase 5.0's smoke test uses.
    const result = executeForCjs({
      registryCommand: 'generate-slug',
      registryArgs: ['Phase 6 Bridge Wired'],
      legacyCommand: 'generate-slug',
      legacyArgs: ['Phase 6 Bridge Wired'],
      mode: 'json',
      projectDir: process.cwd(),
    });

    assert.strictEqual(
      result.ok,
      true,
      `executeForCjs result.ok must be true; got: ${JSON.stringify(result)}. ` +
        'If this fails, the bridge loaded but registry.dispatch did not return ' +
        'a typed-ok result for a known-canonical command — the seam is broken.',
    );
    assert.ok(result.data && typeof result.data === 'object', 'result.data must be an object');
    assert.strictEqual(result.data.slug, 'phase-6-bridge-wired');
    assert.strictEqual(result.exitCode, 0);
  });
});
