'use strict';
/**
 * plan-scan — canonical phase-plan scanner (k014)
 *
 * Single source of truth for detecting plan and summary files in a phase
 * directory, replacing four divergent copies in state.cjs, roadmap.cjs,
 * init.cjs, and phase.cjs (#3262).
 *
 * Layout support:
 *   Flat  (pre-#3139): phases/<N>/*-PLAN.md, *-SUMMARY.md
 *   Nested (post-#3139): phases/<N>/plans/PLAN-<NN>-*.md, SUMMARY-<NN>-*.md
 *
 * @module plan-scan
 */

const fs = require('fs');
const path = require('path');

// Excluded derivative files — present alongside real plans but must not be
// counted.  OUTLINE exclusion catches both flat (-PLAN-OUTLINE.md) and nested
// (PLAN-NN-OUTLINE.md) forms via a broad -OUTLINE.md$ pattern.  The
// pre-bounce pattern is intentionally broad (matches any *.pre-bounce.md) so
// stale bounce files never inflate plan counts (#3257 regression root cause).
const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;

/**
 * Determine whether a filename from the flat phase root is a plan file.
 *
 * Accepts:
 *   - Bare            PLAN.md
 *   - Canonical padded 01-01-PLAN.md
 *   - Extended layout  5-PLAN-01-setup.md  (the format gsd-plan-phase writes;
 *     looksLikePlanFile in phase.cjs / isPlanFile in roadmap.cjs)
 *
 * Rejects: -PLAN-OUTLINE.md, *.pre-bounce.md
 */
function isRootPlanFile(f) {
  if (PLAN_OUTLINE_RE.test(f)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(f)) return false;
  // Canonical suffix or bare name
  if (f.endsWith('-PLAN.md') || f === 'PLAN.md') return true;
  // Extended layout: any .md that contains PLAN (case-insensitive) in the name
  return /\.md$/i.test(f) && /PLAN/i.test(f);
}

/**
 * Determine whether a filename from the nested plans/ subdir is a plan file.
 *
 * Nested layout names: PLAN-NN-slug.md or N-PLAN-NN-slug.md.
 * Excludes OUTLINE and pre-bounce suffixes.
 */
function isNestedPlanFile(f) {
  if (PLAN_OUTLINE_RE.test(f)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(f)) return false;
  return /^PLAN-\d+.*\.md$/i.test(f) || /-PLAN-\d+.*\.md$/i.test(f);
}

/**
 * Determine whether a filename from the flat phase root is a summary file.
 */
function isRootSummaryFile(f) {
  return f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md';
}

/**
 * Determine whether a filename from the nested plans/ subdir is a summary.
 */
function isNestedSummaryFile(f) {
  return /^SUMMARY-\d+.*\.md$/i.test(f) || /-SUMMARY-\d+.*\.md$/i.test(f);
}

/**
 * Scan a single phase directory for plan and summary files.
 *
 * @param {string} phaseDir — absolute path to the phase directory
 * @returns {{
 *   planCount: number,
 *   summaryCount: number,
 *   completed: boolean,
 *   hasNestedPlans: boolean,
 *   planFiles: string[],
 *   summaryFiles: string[],
 * }}
 */
function scanPhasePlans(phaseDir) {
  let rootFiles;
  try {
    rootFiles = fs.readdirSync(phaseDir);
  } catch {
    return {
      planCount: 0,
      summaryCount: 0,
      completed: false,
      hasNestedPlans: false,
      planFiles: [],
      summaryFiles: [],
    };
  }

  const rootPlanFiles = rootFiles.filter(isRootPlanFile);
  const rootSummaryFiles = rootFiles.filter(isRootSummaryFile);

  let nestedPlanFiles = [];
  let nestedSummaryFiles = [];
  let hasNestedPlans = false;

  const nestedDir = path.join(phaseDir, 'plans');
  if (fs.existsSync(nestedDir)) {
    try {
      const nested = fs.readdirSync(nestedDir);
      nestedPlanFiles = nested.filter(isNestedPlanFile);
      nestedSummaryFiles = nested.filter(isNestedSummaryFile);
      hasNestedPlans = nestedPlanFiles.length > 0;
    } catch { /* ignore if plans/ is not a readable directory */ }
  }

  const planFiles = rootPlanFiles.concat(nestedPlanFiles);
  const summaryFiles = rootSummaryFiles.concat(nestedSummaryFiles);
  const planCount = planFiles.length;
  const summaryCount = summaryFiles.length;

  return {
    planCount,
    summaryCount,
    completed: planCount > 0 && summaryCount >= planCount,
    hasNestedPlans,
    planFiles,
    summaryFiles,
  };
}

module.exports = scanPhasePlans;
module.exports.scanPhasePlans = scanPhasePlans;
module.exports.isRootPlanFile = isRootPlanFile;
module.exports.isNestedPlanFile = isNestedPlanFile;
module.exports.isRootSummaryFile = isRootSummaryFile;
module.exports.isNestedSummaryFile = isNestedSummaryFile;
