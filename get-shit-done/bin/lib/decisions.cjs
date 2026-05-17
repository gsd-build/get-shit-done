'use strict';

/**
 * Decisions Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/query/decisions.ts and
 * lives in decisions.generated.cjs. This file is a thin re-export so
 * that existing call sites (gap-checker.cjs, tests) can continue to
 * require('./decisions') unchanged.
 *
 * Exports (from generated file):
 *   - parseDecisions(content) — parse <decisions> blocks, returns {id, text, category, tags, trackable}[]
 *     CJS callers using only {id, text} safely ignore the extra fields.
 *     Accepts both numeric (D-42) and alphanumeric (D-INFRA-01) IDs.
 *
 * Regenerate: cd sdk && npm run gen:decisions
 */

module.exports = require('./decisions.generated.cjs');
