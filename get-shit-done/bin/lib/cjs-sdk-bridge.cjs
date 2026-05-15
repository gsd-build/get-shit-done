'use strict';

/**
 * CJS↔SDK Sync Runtime Bridge Adapter — Phase 5/6 of #3524.
 *
 * Single shared loader for the synchronous SDK runtime bridge that the CJS
 * command-router family files and `gsd-tools.cjs` non-family dispatcher all
 * delegate through. Centralizing the load prevents the seven-fold duplicated
 * `tryLoadSdk` blocks that existed across the routers from drifting against
 * each other (the exact anti-pattern the Phase 6 hand-sync lint is meant to
 * stop, applied to the SDK-load logic itself).
 *
 * Imports from the public `@gsd-build/sdk` package entry point rather than the
 * private `dist/runtime-bridge-sync/index.js` subpath, matching the router
 * convention. The `Sync Runtime Bridge Module` entry in CONTEXT.md describes
 * the underlying primitive (synckit / Atomics.wait worker thread).
 *
 * Usage:
 *   const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');
 *   if (tryLoadSdk()) {
 *     const executeForCjs = getExecuteForCjs();
 *     const result = executeForCjs({ ... });
 *   }
 *
 * For routers that need additional named exports beyond `executeForCjs`
 * (e.g. state's `formatStateLoadRawStdout` for `state load --raw` projection),
 * use `getSdkModule()` to pluck them off the loaded module.
 */

let _sdkModule = null;
let _loadFailed = false;

/**
 * Load `@gsd-build/sdk` once and cache the result. Returns true on success,
 * false if the package is unavailable (e.g. SDK not built in a dev checkout)
 * or its `executeForCjs` export is missing. Cached result is reused on
 * subsequent calls.
 */
function tryLoadSdk() {
  if (_sdkModule) return true;
  if (_loadFailed) return false;
  try {
    // eslint-disable-next-line global-require
    const sdk = require('@gsd-build/sdk');
    if (typeof sdk.executeForCjs !== 'function') {
      _loadFailed = true;
      return false;
    }
    _sdkModule = sdk;
    return true;
  } catch {
    _loadFailed = true;
    return false;
  }
}

/**
 * Returns the cached `executeForCjs` function, or null if `tryLoadSdk()` has
 * not been called or returned false. Callers must check `tryLoadSdk()` first.
 */
function getExecuteForCjs() {
  return _sdkModule ? _sdkModule.executeForCjs : null;
}

/**
 * Returns the cached `@gsd-build/sdk` module object after a successful
 * `tryLoadSdk()`, or null. Used by routers that need additional named exports
 * beyond `executeForCjs` (e.g. `formatStateLoadRawStdout`).
 */
function getSdkModule() {
  return _sdkModule;
}

module.exports = { tryLoadSdk, getExecuteForCjs, getSdkModule };
