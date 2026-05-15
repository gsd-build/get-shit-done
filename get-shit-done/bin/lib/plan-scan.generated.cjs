'use strict';

/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Source: sdk/src/query/plan-scan.ts
 * Regenerate: cd sdk && npm run gen:plan-scan
 *
 * Plan Scan Module — detects plan and summary files in a phase directory.
 * Supports both flat (pre-#3139) and nested (post-#3139) layouts.
 */

const { existsSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// Excluded derivative files
const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;

function isRootPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    if (fileName.endsWith('-PLAN.md') || fileName === 'PLAN.md')
        return true;
    return /\.md$/i.test(fileName) && /PLAN/i.test(fileName);
}

function isNestedPlanFile(fileName) {
    if (PLAN_OUTLINE_RE.test(fileName))
        return false;
    if (PLAN_PRE_BOUNCE_RE.test(fileName))
        return false;
    return /^PLAN-\d+.*\.md$/i.test(fileName) || /-PLAN-\d+.*\.md$/i.test(fileName);
}

function isRootSummaryFile(fileName) {
    return fileName.endsWith('-SUMMARY.md') || fileName === 'SUMMARY.md';
}

function isNestedSummaryFile(fileName) {
    return /^SUMMARY-\d+.*\.md$/i.test(fileName) || /-SUMMARY-\d+.*\.md$/i.test(fileName);
}

function scanPhasePlans(phaseDir) {
    let rootFiles;
    try {
        rootFiles = readdirSync(phaseDir);
    }
    catch {
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
    const nestedDir = join(phaseDir, 'plans');
    if (existsSync(nestedDir)) {
        try {
            const nestedFiles = readdirSync(nestedDir);
            nestedPlanFiles = nestedFiles.filter(isNestedPlanFile);
            nestedSummaryFiles = nestedFiles.filter(isNestedSummaryFile);
            hasNestedPlans = nestedPlanFiles.length > 0;
        }
        catch { /* ignore unreadable nested layout */ }
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

// CJS callers do: const scanPhasePlans = require('./plan-scan.cjs')
// and also destructure named exports — support both call styles.
module.exports = scanPhasePlans;
module.exports.scanPhasePlans = scanPhasePlans;
module.exports.isRootPlanFile = isRootPlanFile;
module.exports.isNestedPlanFile = isNestedPlanFile;
module.exports.isRootSummaryFile = isRootSummaryFile;
module.exports.isNestedSummaryFile = isNestedSummaryFile;
