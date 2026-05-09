import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PLAN_OUTLINE_RE = /-OUTLINE\.md$/i;
const PLAN_PRE_BOUNCE_RE = /\.pre-bounce\.md$/i;

export interface PhasePlanScan {
  planCount: number;
  summaryCount: number;
  completed: boolean;
  hasNestedPlans: boolean;
  planFiles: string[];
  summaryFiles: string[];
}

export function isRootPlanFile(fileName: string): boolean {
  if (PLAN_OUTLINE_RE.test(fileName)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(fileName)) return false;
  if (fileName.endsWith('-PLAN.md') || fileName === 'PLAN.md') return true;
  return /\.md$/i.test(fileName) && /PLAN/i.test(fileName);
}

export function isNestedPlanFile(fileName: string): boolean {
  if (PLAN_OUTLINE_RE.test(fileName)) return false;
  if (PLAN_PRE_BOUNCE_RE.test(fileName)) return false;
  return /^PLAN-\d+.*\.md$/i.test(fileName) || /-PLAN-\d+.*\.md$/i.test(fileName);
}

export function isRootSummaryFile(fileName: string): boolean {
  return fileName.endsWith('-SUMMARY.md') || fileName === 'SUMMARY.md';
}

export function isNestedSummaryFile(fileName: string): boolean {
  return /^SUMMARY-\d+.*\.md$/i.test(fileName) || /-SUMMARY-\d+.*\.md$/i.test(fileName);
}

export function scanPhasePlans(phaseDir: string): PhasePlanScan {
  let rootFiles: string[];
  try {
    rootFiles = readdirSync(phaseDir);
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

  let nestedPlanFiles: string[] = [];
  let nestedSummaryFiles: string[] = [];
  let hasNestedPlans = false;

  const nestedDir = join(phaseDir, 'plans');
  if (existsSync(nestedDir)) {
    try {
      const nestedFiles = readdirSync(nestedDir);
      nestedPlanFiles = nestedFiles.filter(isNestedPlanFile);
      nestedSummaryFiles = nestedFiles.filter(isNestedSummaryFile);
      hasNestedPlans = nestedPlanFiles.length > 0;
    } catch { /* ignore unreadable nested layout */ }
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
