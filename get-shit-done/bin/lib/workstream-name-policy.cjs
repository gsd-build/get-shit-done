/**
 * Workstream Name Policy Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/workstream-name-policy.ts and
 * lives in workstream-name-policy.generated.cjs. This file is a thin re-export
 * so that existing call sites (active-workstream-store.cjs,
 * planning-workspace.cjs, workstream.cjs, and tests) can continue to
 * require('./workstream-name-policy') unchanged.
 *
 * Exports (from generated file):
 *   - toWorkstreamSlug(name)             — normalize to URL/filesystem slug
 *   - hasInvalidPathSegment(name)        — true if name has slashes or dot-dot
 *   - isValidActiveWorkstreamName(name)  — true if name passes all policy rules
 *   - validateWorkstreamName(name)       — SDK alias for isValidActiveWorkstreamName
 *
 * Regenerate: cd sdk && npm run gen:workstream-name-policy
 */

module.exports = require('./workstream-name-policy.generated.cjs');
