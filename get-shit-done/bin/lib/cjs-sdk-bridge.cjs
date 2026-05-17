'use strict';

/**
 * CJS↔SDK Sync Runtime Bridge Adapter — Phase 5/6 of #3524.
 *
 * Single shared loader for the synchronous SDK runtime bridge that every CJS
 * command-router family file and `gsd-tools.cjs` non-family dispatcher
 * delegates through. Centralizing the load prevents the seven-fold duplicated
 * `tryLoadSdk` blocks that existed across the routers from drifting against
 * each other (the exact anti-pattern the Phase 6 hand-sync lint is meant to
 * stop, applied to the SDK-load logic itself).
 *
 * Load path policy: the bridge resolves the bundled SDK by package-relative
 * filesystem path, NOT by the `@gsd-build/sdk` package name. The package name
 * is not installed in the root `node_modules` (it lives as a sibling workspace
 * package, not a dependency), and the SDK's public entry doesn't re-export
 * `executeForCjs` or `formatStateLoadRawStdout` anyway. Using the relative
 * path means the loader works identically in (a) the development checkout
 * (`<repo>/sdk/dist/...`) and (b) the published package layout
 * (`node_modules/get-shit-done-cc/sdk/dist/...`) because the `files` array in
 * `package.json` keeps `sdk/dist` at the same path inside the published
 * tarball.
 *
 * The previous implementation used `require('@gsd-build/sdk')`, which always
 * failed because the package was unresolvable from the consumer location.
 * That cached `_loadFailed = true` for the lifetime of the process and made
 * every router silently fall through to CJS — defeating Phase 5/6's entire
 * goal. The integration test at `tests/cjs-sdk-bridge-integration.test.cjs`
 * locks the load-success invariant so this regression cannot recur.
 *
 * Usage:
 *   const { tryLoadSdk, getExecuteForCjs } = require('./cjs-sdk-bridge.cjs');
 *   if (tryLoadSdk()) {
 *     const result = getExecuteForCjs()({ ... });
 *   }
 *
 * Plus `getFormatStateLoadRawStdout()` for the `state load --raw` adapter and
 * `getSdkModule()` for routers that need the raw runtime-bridge-sync module.
 */

const path = require('path');

// Computed once at module load. Resolves the bundled SDK relative to this
// file's on-disk location, so both dev and post-install layouts work.
//   <root>/get-shit-done/bin/lib/cjs-sdk-bridge.cjs
//   <root>/sdk/dist/runtime-bridge-sync/index.js
//   <root>/sdk/dist/query/state-project-load.js
const RUNTIME_BRIDGE_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'sdk',
  'dist',
  'runtime-bridge-sync',
  'index.js',
);
const STATE_PROJECT_LOAD_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'sdk',
  'dist',
  'query',
  'state-project-load.js',
);

let _runtimeBridge = null;
let _formatStateLoadRawStdout = null;
let _loadFailed = false;

/**
 * Load the bundled SDK runtime bridge once and cache the result. Returns true
 * on success, false if the dist artifacts are missing (e.g. `npm run
 * build:sdk` has not been executed in a fresh dev checkout) or if the
 * expected `executeForCjs` export is absent. Cached result is reused on
 * subsequent calls.
 */
function tryLoadSdk() {
  if (_runtimeBridge) return true;
  if (_loadFailed) return false;
  try {
    // eslint-disable-next-line global-require
    const bridge = require(RUNTIME_BRIDGE_PATH);
    if (typeof bridge.executeForCjs !== 'function') {
      _loadFailed = true;
      return false;
    }
    // eslint-disable-next-line global-require
    const stateProjectLoad = require(STATE_PROJECT_LOAD_PATH);
    if (typeof stateProjectLoad.formatStateLoadRawStdout !== 'function') {
      _loadFailed = true;
      return false;
    }
    _runtimeBridge = bridge;
    _formatStateLoadRawStdout = stateProjectLoad.formatStateLoadRawStdout;
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
  return _runtimeBridge ? _runtimeBridge.executeForCjs : null;
}

/**
 * Returns the cached `formatStateLoadRawStdout` function, or null. Used by
 * the state command router for the `state load --raw` adapter that projects
 * SDK return data into the legacy key=value lines format.
 */
function getFormatStateLoadRawStdout() {
  return _formatStateLoadRawStdout;
}

/**
 * Returns the cached runtime-bridge-sync module object after a successful
 * `tryLoadSdk()`, or null. Provided for callers that need additional named
 * exports beyond `executeForCjs`.
 */
function getSdkModule() {
  return _runtimeBridge;
}

module.exports = {
  tryLoadSdk,
  getExecuteForCjs,
  getFormatStateLoadRawStdout,
  getSdkModule,
};
