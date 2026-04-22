/**
 * Phase finding and plan index query handlers.
 *
 * Ported from get-shit-done/bin/lib/phase.cjs and core.cjs.
 * Provides find-phase (directory lookup with archived fallback)
 * and phase-plan-index (plan metadata with wave grouping).
 *
 * @example
 * ```typescript
 * import { findPhase, phasePlanIndex } from './phase.js';
 *
 * const found = await findPhase(['9'], '/project');
 * // { data: { found: true, directory: '.planning/phases/09-foundation', ... } }
 *
 * const index = await phasePlanIndex(['9'], '/project');
 * // { data: { phase: '09', plans: [...], waves: { '1': [...] }, ... } }
 * ```
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import { extractFrontmatter } from './frontmatter.js';
import {
  normalizePhaseName,
  comparePhaseNum,
  phaseTokenMatches,
  toPosixPath,
  planningPaths,
} from './helpers.js';
import { relPlanningPath } from '../workstream-utils.js';
import type { QueryHandler } from './utils.js';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PhaseInfo {
  found: boolean;
  directory: string | null;
  phase_number: string | null;
  phase_name: string | null;
  phase_slug: string | null;
  plans: string[];
  summaries: string[];
  incomplete_plans: string[];
  has_research: boolean;
  has_context: boolean;
  has_verification: boolean;
  has_reviews: boolean;
  archived?: string;
}

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Get file stats for a phase directory.
 *
 * Port of getPhaseFileStats from core.cjs lines 1461-1471.
 */
async function getPhaseFileStats(phaseDir: string): Promise<{
  plans: string[];
  summaries: string[];
  hasResearch: boolean;
  hasContext: boolean;
  hasVerification: boolean;
  hasReviews: boolean;
}> {
  const files = await readdir(phaseDir);
  return {
    plans: files.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md'),
    summaries: files.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md'),
    hasResearch: files.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md'),
    hasContext: files.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md'),
    hasVerification: files.some(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md'),
    hasReviews: files.some(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md'),
  };
}

/**
 * Search for a phase directory matching the normalized name.
 *
 * Port of searchPhaseInDir from core.cjs lines 956-1000.
 */
async function searchPhaseInDir(baseDir: string, relBase: string, normalized: string): Promise<PhaseInfo | null> {
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));

    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (!match) return null;

    // Extract phase number and name
    const dirMatch = match.match(/^(?:[A-Z]{1,6}-)(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
      || match.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i)
      || match.match(/^([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)-(.+)/i)
      || [null, match, null];
    const phaseNumber = dirMatch ? dirMatch[1] : normalized;
    const phaseName = dirMatch && dirMatch[2] ? dirMatch[2] : null;
    const phaseDir = join(baseDir, match);

    const { plans: unsortedPlans, summaries: unsortedSummaries, hasResearch, hasContext, hasVerification, hasReviews } = await getPhaseFileStats(phaseDir);
    const plans = unsortedPlans.sort();
    const summaries = unsortedSummaries.sort();

    const completedPlanIds = new Set(
      summaries.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
    );
    const incompletePlans = plans.filter(p => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      return !completedPlanIds.has(planId);
    });

    return {
      found: true,
      directory: toPosixPath(join(relBase, match)),
      phase_number: phaseNumber,
      phase_name: phaseName,
      phase_slug: phaseName ? phaseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : null,
      plans,
      summaries,
      incomplete_plans: incompletePlans,
      has_research: hasResearch,
      has_context: hasContext,
      has_verification: hasVerification,
      has_reviews: hasReviews,
    };
  } catch {
    return null;
  }
}

/**
 * Extract objective text from plan content.
 */
function extractObjective(content: string): string | null {
  const m = content.match(/<objective>\s*\n?\s*(.+)/);
  return m ? m[1].trim() : null;
}

// ─── Exported handlers ─────────────────────────────────────────────────────

/**
 * Query handler for find-phase.
 *
 * Locates a phase directory by number/identifier, searching current phases
 * first, then archived milestone phases.
 *
 * Port of cmdFindPhase from phase.cjs lines 152-196, combined with
 * findPhaseInternal from core.cjs lines 1002-1038.
 *
 * @param args - args[0] is the phase identifier (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with PhaseInfo
 * @throws GSDError with Validation classification if phase identifier missing
 */
export const findPhase: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase identifier required', ErrorClassification.Validation);
  }

  const phasesDir = planningPaths(projectDir, workstream).phases;
  const normalized = normalizePhaseName(phase);

  const notFound: PhaseInfo = {
    found: false,
    directory: null,
    phase_number: null,
    phase_name: null,
    phase_slug: null,
    plans: [],
    summaries: [],
    incomplete_plans: [],
    has_research: false,
    has_context: false,
    has_verification: false,
    has_reviews: false,
  };

  // Search current phases first
  const relPhasesDir = relPlanningPath(workstream) + '/phases';
  const current = await searchPhaseInDir(phasesDir, relPhasesDir, normalized);
  if (current) return { data: current };

  // Search archived milestone phases (newest first)
  const milestonesDir = join(projectDir, '.planning', 'milestones');
  try {
    const milestoneEntries = await readdir(milestonesDir, { withFileTypes: true });
    const archiveDirs = milestoneEntries
      .filter(e => e.isDirectory() && /^v[\d.]+-phases$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    for (const archiveName of archiveDirs) {
      const versionMatch = archiveName.match(/^(v[\d.]+)-phases$/);
      const version = versionMatch ? versionMatch[1] : archiveName;
      const archivePath = join(milestonesDir, archiveName);
      const relBase = '.planning/milestones/' + archiveName;
      const result = await searchPhaseInDir(archivePath, relBase, normalized);
      if (result) {
        result.archived = version;
        return { data: result };
      }
    }
  } catch { /* milestones dir doesn't exist */ }

  return { data: notFound };
};

/**
 * Query handler for phase-plan-index.
 *
 * Returns plan metadata with wave grouping for a specific phase.
 *
 * Port of cmdPhasePlanIndex from phase.cjs lines 203-310.
 *
 * @param args - args[0] is the phase identifier (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with { phase, plans[], waves{}, incomplete[], has_checkpoints }
 * @throws GSDError with Validation classification if phase identifier missing
 */
export const phasePlanIndex: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    throw new GSDError('phase required for phase-plan-index', ErrorClassification.Validation);
  }

  const phasesDir = planningPaths(projectDir, workstream).phases;
  const normalized = normalizePhaseName(phase);

  // Find phase directory
  let phaseDir: string | null = null;
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => comparePhaseNum(a, b));
    const match = dirs.find(d => phaseTokenMatches(d, normalized));
    if (match) {
      phaseDir = join(phasesDir, match);
    }
  } catch { /* phases dir doesn't exist */ }

  if (!phaseDir) {
    return {
      data: {
        phase: normalized,
        error: 'Phase not found',
        plans: [],
        waves: {},
        incomplete: [],
        has_checkpoints: false,
      },
    };
  }

  // Get all files in phase directory
  const phaseFiles = await readdir(phaseDir);
  const planFiles = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').sort();
  const summaryFiles = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

  // Build set of plan IDs with summaries
  const completedPlanIds = new Set(
    summaryFiles.map(s => s.replace('-SUMMARY.md', '').replace('SUMMARY.md', ''))
  );

  const plans: Array<Record<string, unknown>> = [];
  const waves: Record<string, string[]> = {};
  const incomplete: string[] = [];
  let hasCheckpoints = false;

  for (const planFile of planFiles) {
    const planId = planFile.replace('-PLAN.md', '').replace('PLAN.md', '');
    const planPath = join(phaseDir, planFile);
    const content = await readFile(planPath, 'utf-8');
    const fm = extractFrontmatter(content);

    // Count tasks: XML <task> tags (canonical) or ## Task N markdown (legacy)
    const xmlTasks = content.match(/<task[\s>]/gi) || [];
    const mdTasks = content.match(/##\s*Task\s*\d+/gi) || [];
    const taskCount = xmlTasks.length || mdTasks.length;

    // Parse wave as integer
    const wave = parseInt(String(fm.wave), 10) || 1;

    // Parse autonomous (default true if not specified)
    let autonomous = true;
    if (fm.autonomous !== undefined) {
      autonomous = fm.autonomous === 'true' || fm.autonomous === true;
    }

    if (!autonomous) {
      hasCheckpoints = true;
    }

    // Parse files_modified
    let filesModified: string[] = [];
    const fmFiles = (fm['files_modified'] || fm['files-modified']) as string | string[] | undefined;
    if (fmFiles) {
      filesModified = Array.isArray(fmFiles) ? fmFiles : [fmFiles];
    }

    const hasSummary = completedPlanIds.has(planId);
    if (!hasSummary) {
      incomplete.push(planId);
    }

    const plan = {
      id: planId,
      wave,
      autonomous,
      objective: extractObjective(content) || (fm.objective as string) || null,
      files_modified: filesModified,
      task_count: taskCount,
      has_summary: hasSummary,
    };

    plans.push(plan);

    // Group by wave
    const waveKey = String(wave);
    if (!waves[waveKey]) {
      waves[waveKey] = [];
    }
    waves[waveKey].push(planId);
  }

  return {
    data: {
      phase: normalized,
      plans,
      waves,
      incomplete,
      has_checkpoints: hasCheckpoints,
    },
  };
};
