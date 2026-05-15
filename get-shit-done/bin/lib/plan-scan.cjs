'use strict';

/**
 * Plan Scan Module — CJS adapter.
 *
 * The implementation is generated from sdk/src/query/plan-scan.ts and
 * lives in plan-scan.generated.cjs. This file is a thin re-export so
 * that existing call sites (state.cjs, roadmap.cjs, init.cjs,
 * workstream-inventory.cjs, and tests) can continue to require('./plan-scan')
 * unchanged.
 *
 * Exports (from generated file):
 *   - scanPhasePlans(phaseDir) — canonical phase-plan scanner
 *   - isRootPlanFile(fileName) — extended filter including /PLAN/i slug layouts
 *   - isNestedPlanFile(fileName) — nested plans/ subdir filter
 *   - isRootSummaryFile(fileName) — flat summary file filter
 *   - isNestedSummaryFile(fileName) — nested summary file filter
 *
 * The isRootPlanFile helper uses /PLAN/i to match the extended slug layout
 * (e.g. 5-PLAN-01-setup-database.md) in addition to bare and canonical forms.
 * This was the fix for bug #3128 (roadmap.cjs plan-count regression).
 *
 * Regenerate: cd sdk && npm run gen:plan-scan
 */

module.exports = require('./plan-scan.generated.cjs');
