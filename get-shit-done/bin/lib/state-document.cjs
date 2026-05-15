'use strict';

/**
 * STATE.md Document Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/query/state-document.ts and
 * lives in state-document.generated.cjs. This file is a thin re-export so
 * that existing call sites (state.cjs, workstream-inventory.cjs, init.cjs,
 * and tests) can continue to require('./state-document') unchanged.
 */

module.exports = require('./state-document.generated.cjs');
