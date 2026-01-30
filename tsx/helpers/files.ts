/**
 * File discovery operations - read-only filesystem queries
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { PhaseInfo, PlanInfo } from './types.js';
import { extractPhaseFromDirName, extractNameFromDirName, comparePhaseNumbers } from './phase.js';

const PHASES_DIR = '.planning/phases';
const QUICK_DIR = '.planning/quick';

/**
 * List all phase directories sorted by phase number
 */
export async function listPhaseDirectories(basePath: string = process.cwd()): Promise<PhaseInfo[]> {
  const phasesDir = path.join(basePath, PHASES_DIR);

  try {
    const entries = await fs.readdir(phasesDir, { withFileTypes: true });
    const phases: PhaseInfo[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const phaseNum = extractPhaseFromDirName(entry.name);
      const phaseName = extractNameFromDirName(entry.name);

      if (phaseNum && phaseName) {
        phases.push({
          number: phaseNum,
          name: phaseName,
          slug: phaseName,
          directory: path.join(phasesDir, entry.name),
        });
      }
    }

    // Sort by phase number
    return phases.sort((a, b) => comparePhaseNumbers(a.number, b.number));
  } catch {
    return [];
  }
}

/**
 * Find a specific phase directory by number
 */
export async function findPhaseDirectory(
  phase: string,
  basePath: string = process.cwd()
): Promise<PhaseInfo | null> {
  const phases = await listPhaseDirectories(basePath);
  const normalized = phase.padStart(2, '0');

  return phases.find((p) => p.number === normalized || p.number.startsWith(`${normalized}.`)) ?? null;
}

/**
 * List all plan files in a phase directory
 * Returns paths matching *-PLAN.md pattern
 */
export async function listPlanFiles(phaseDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(phaseDir);
    return entries
      .filter((e) => e.endsWith('-PLAN.md'))
      .map((e) => path.join(phaseDir, e))
      .sort();
  } catch {
    return [];
  }
}

/**
 * List all summary files in a phase directory
 * Returns paths matching *-SUMMARY.md pattern
 */
export async function listSummaryFiles(phaseDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(phaseDir);
    return entries
      .filter((e) => e.endsWith('-SUMMARY.md'))
      .map((e) => path.join(phaseDir, e))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Find plans that don't have corresponding summaries
 */
export async function findIncompletePlans(phaseDir: string): Promise<PlanInfo[]> {
  const plans = await listPlanFiles(phaseDir);
  const summaries = await listSummaryFiles(phaseDir);

  // Create set of summary prefixes for quick lookup
  const summaryPrefixes = new Set(
    summaries.map((s) => path.basename(s).replace('-SUMMARY.md', ''))
  );

  const incomplete: PlanInfo[] = [];

  for (const planPath of plans) {
    const baseName = path.basename(planPath);
    const prefix = baseName.replace('-PLAN.md', '');
    const hasSummary = summaryPrefixes.has(prefix);

    // Extract phase and plan numbers from prefix (e.g., "08-01" → phase="08", plan="01")
    const match = prefix.match(/^(\d{2}(?:\.\d+)?)-(\d{2})$/);
    if (match) {
      incomplete.push({
        path: planPath,
        phase: match[1],
        plan: match[2],
        hasSummary,
      });
    }
  }

  return incomplete.filter((p) => !p.hasSummary);
}

/**
 * Count plan files in a phase directory
 */
export async function countPlans(phaseDir: string): Promise<number> {
  const plans = await listPlanFiles(phaseDir);
  return plans.length;
}

/**
 * Count summary files in a phase directory
 */
export async function countSummaries(phaseDir: string): Promise<number> {
  const summaries = await listSummaryFiles(phaseDir);
  return summaries.length;
}

/**
 * Find research file in phase directory
 */
export async function findResearchFile(phaseDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(phaseDir);
    const research = entries.find((e) => e.endsWith('-RESEARCH.md'));
    return research ? path.join(phaseDir, research) : null;
  } catch {
    return null;
  }
}

/**
 * Find context file in phase directory
 */
export async function findContextFile(phaseDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(phaseDir);
    const context = entries.find((e) => e.endsWith('-CONTEXT.md'));
    return context ? path.join(phaseDir, context) : null;
  } catch {
    return null;
  }
}

/**
 * Calculate next quick task number (3-digit)
 */
export async function calculateNextQuickNumber(basePath: string = process.cwd()): Promise<string> {
  const quickDir = path.join(basePath, QUICK_DIR);

  try {
    const entries = await fs.readdir(quickDir, { withFileTypes: true });
    const numbers: number[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const match = entry.name.match(/^(\d{3})-/);
      if (match) {
        numbers.push(parseInt(match[1], 10));
      }
    }

    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return String(maxNum + 1).padStart(3, '0');
  } catch {
    return '001';
  }
}

/**
 * Get highest phase number from existing phase directories
 */
export async function getHighestPhaseNumber(basePath: string = process.cwd()): Promise<number> {
  const phases = await listPhaseDirectories(basePath);

  if (phases.length === 0) return 0;

  // Get max integer part of phase numbers
  const maxInt = phases.reduce((max, phase) => {
    const intPart = parseInt(phase.number.split('.')[0], 10);
    return Math.max(max, intPart);
  }, 0);

  return maxInt;
}

/**
 * List all quick task directories
 */
export async function listQuickDirectories(basePath: string = process.cwd()): Promise<string[]> {
  const quickDir = path.join(basePath, QUICK_DIR);

  try {
    const entries = await fs.readdir(quickDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && /^\d{3}-/.test(e.name))
      .map((e) => path.join(quickDir, e.name))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Read file content as string
 */
export async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Read STATE.md content
 */
export async function readStateFile(basePath: string = process.cwd()): Promise<string | null> {
  return readFileContent(path.join(basePath, '.planning', 'STATE.md'));
}

/**
 * Read ROADMAP.md content
 */
export async function readRoadmapFile(basePath: string = process.cwd()): Promise<string | null> {
  return readFileContent(path.join(basePath, '.planning', 'ROADMAP.md'));
}

/**
 * Read PROJECT.md content
 */
export async function readProjectFile(basePath: string = process.cwd()): Promise<string | null> {
  return readFileContent(path.join(basePath, '.planning', 'PROJECT.md'));
}
