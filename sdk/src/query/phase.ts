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
function extractCanonicalPlanId(filename: string): string {
  const base = filename.replace(/-PLAN\.md$/i, '').replace(/-SUMMARY\.md$/i, '').replace(/\.md$/i, '');
  const parts = base.split('-').filter(Boolean);
  const tokenRe = /^\d+[A-Z]?(?:\.\d+)*$/i;
  const phaseIdx = parts.findIndex((p) => tokenRe.test(p));
  if (phaseIdx >= 0 && phaseIdx + 1 < parts.length && tokenRe.test(parts[phaseIdx + 1])) {
    return `${parts[phaseIdx]}-${parts[phaseIdx + 1]}`;
  }
  return base;
}

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
      summaries.flatMap((s) => {
        const exact = s.replace('-SUMMARY.md', '').replace('SUMMARY.md', '');
        const canonical = extractCanonicalPlanId(s);
        return canonical === exact ? [exact] : [exact, canonical];
      })
    );
    const incompletePlans = plans.filter((p) => {
      const planId = p.replace('-PLAN.md', '').replace('PLAN.md', '');
      const canonical = extractCanonicalPlanId(p);
      return !completedPlanIds.has(planId) && !completedPlanIds.has(canonical);
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
  const nonCanonicalPlanFiles = phaseFiles.filter((f) => (
    f.toLowerCase().endsWith('.md')
    && /(^|-)plan(-|\.)/i.test(f)
    && !(f.endsWith('-PLAN.md') || f === 'PLAN.md')
  )).sort();

  // Build set of plan IDs with summaries — match the planId derivation logic
  const completedPlanIds = new Set(
    summaryFiles.flatMap((s) => {
      const exact = s === 'SUMMARY.md' ? 'PLAN' : s.replace('-SUMMARY.md', '');
      const canonical = extractCanonicalPlanId(s);
      return canonical === exact ? [exact] : [exact, canonical];
    })
  );

  // ── Pass 1: parse each plan file ─────────────────────────────────────────

  interface RawPlan {
    id: string;
    declaredWave: number | null;
    dependsOn: string[];
    autonomous: boolean;
    objective: string | null;
    filesModified: string[];
    taskCount: number;
    hasSummary: boolean;
  }

  const rawPlans: RawPlan[] = [];

  for (const planFile of planFiles) {
    // For named plans (01-01-PLAN.md): strip suffix to get '01-01'
    // For bare PLAN.md: use the filename itself as the ID
    const planId = planFile === 'PLAN.md' ? 'PLAN' : planFile.replace('-PLAN.md', '');
    const planPath = join(phaseDir, planFile);
    const content = await readFile(planPath, 'utf-8');
    const fm = extractFrontmatter(content);

    // Count tasks: XML <task> tags (canonical) or ## Task N markdown (legacy)
    const xmlTasks = content.match(/<task[\s>]/gi) || [];
    const mdTasks = content.match(/##\s*Task\s*\d+/gi) || [];
    const taskCount = xmlTasks.length || mdTasks.length;

    // Parse wave as integer — use nullish handling so wave: 0 is preserved.
    // parseInt returns NaN for missing/non-numeric values; fall back to null
    // (meaning "no declared wave") so downstream can apply the topo default.
    const parsedWave = parseInt(String(fm.wave), 10);
    const declaredWave = Number.isNaN(parsedWave) ? null : parsedWave;

    // Parse depends_on — normalise to string[]
    let dependsOn: string[] = [];
    const fmDeps = fm['depends_on'] as string | string[] | undefined;
    if (Array.isArray(fmDeps)) {
      dependsOn = fmDeps.map(String);
    } else if (typeof fmDeps === 'string' && fmDeps.trim() !== '') {
      dependsOn = [fmDeps];
    }

    // Parse autonomous (default true if not specified)
    let autonomous = true;
    if (fm.autonomous !== undefined) {
      autonomous = fm.autonomous === 'true' || fm.autonomous === true;
    }

    // Parse files_modified
    let filesModified: string[] = [];
    const fmFiles = (fm['files_modified'] || fm['files-modified']) as string | string[] | undefined;
    if (fmFiles) {
      filesModified = Array.isArray(fmFiles) ? fmFiles : [fmFiles];
    }

    const hasSummary = completedPlanIds.has(planId) || completedPlanIds.has(extractCanonicalPlanId(planFile));

    rawPlans.push({
      id: planId,
      declaredWave,
      dependsOn,
      autonomous,
      objective: extractObjective(content) || (fm.objective as string) || null,
      filesModified,
      taskCount,
      hasSummary,
    });
  }

  // ── Pass 2: topological level assignment via depends_on DAG ──────────────

  // Build a map from plan ID → RawPlan for fast lookup.
  // Deps that reference plans outside this phase are silently ignored (treated
  // as already-satisfied external deps — the plan becomes a source node).
  const planMap = new Map<string, RawPlan>(rawPlans.map(p => [p.id, p]));
  // Secondary index: canonical prefix → full plan ID, so depends_on: ['03-01'] resolves
  // to '03-01-auth-hardening-PLAN.md'-derived ID '03-01-auth-hardening' (k015).
  const canonicalToId = new Map<string, string>(rawPlans.map(p => [extractCanonicalPlanId(p.id), p.id]));

  // Kahn's algorithm — compute in-degree and adjacency for plans in this phase only.
  const level = new Map<string, number>();
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>(); // dep → [dependents]

  for (const p of rawPlans) {
    if (!inDeg.has(p.id)) inDeg.set(p.id, 0);
    if (!adj.has(p.id)) adj.set(p.id, []);
    for (const dep of p.dependsOn) {
      // Accept both full-stem ('03-01-auth-hardening') and canonical-prefix ('03-01') forms.
      const resolvedDep = planMap.has(dep) ? dep : canonicalToId.get(dep);
      if (!resolvedDep) continue; // external dep — ignore
      if (!adj.has(resolvedDep)) adj.set(resolvedDep, []);
      adj.get(resolvedDep)!.push(p.id);
      inDeg.set(p.id, (inDeg.get(p.id) ?? 0) + 1);
    }
  }

  // Start with nodes that have no in-phase dependencies.
  const queue: string[] = [];
  for (const p of rawPlans) {
    if ((inDeg.get(p.id) ?? 0) === 0) {
      queue.push(p.id);
      level.set(p.id, 0);
    }
  }

  let visited = 0;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    visited++;
    const curLevel = level.get(cur)!;
    for (const dep of (adj.get(cur) ?? [])) {
      const newLevel = curLevel + 1;
      if (newLevel > (level.get(dep) ?? -1)) {
        level.set(dep, newLevel);
      }
      inDeg.set(dep, inDeg.get(dep)! - 1);
      if (inDeg.get(dep) === 0) {
        queue.push(dep);
      }
    }
  }

  // Cycle detection — any node not visited has a cycle.
  if (visited < rawPlans.length) {
    const cycleNodes = rawPlans.filter(p => !level.has(p.id)).map(p => p.id);
    throw new GSDError(
      `depends_on cycle detected in phase ${normalized} — cycle involves: ${cycleNodes.join(', ')}`,
      ErrorClassification.Execution,
    );
  }

  // ── Pass 3: determine lowest bucket key and build output ─────────────────

  // If any plan has declared wave: 0, the lowest level maps to "0"; otherwise "1".
  const anyWaveZero = rawPlans.some(p => p.declaredWave === 0);
  const levelOffset = anyWaveZero ? 0 : 1;

  const plans: Array<Record<string, unknown>> = [];
  const waves: Record<string, string[]> = {};
  const incomplete: string[] = [];
  let hasCheckpoints = false;
  const warnings: string[] = [];

  if (nonCanonicalPlanFiles.length > 0) {
    warnings.push(`Ignored noncanonical plan files: ${nonCanonicalPlanFiles.join(', ')}`);
  }

  for (const raw of rawPlans) {
    if (!raw.autonomous) {
      hasCheckpoints = true;
    }
    if (!raw.hasSummary) {
      incomplete.push(raw.id);
    }

    // Computed wave = topological level + offset (so lowest level → 0 or 1).
    const computedWave = (level.get(raw.id) ?? 0) + levelOffset;

    // The effective wave used for bucketing is always the computed topo level.
    // If the plan declared a wave that disagrees, emit a non-fatal warning.
    const effectiveWave = computedWave;
    if (raw.declaredWave !== null && raw.declaredWave !== computedWave) {
      warnings.push(
        `Plan ${raw.id}: declared wave: ${raw.declaredWave} but depends_on DAG places it in wave ${computedWave}`,
      );
    }

    const plan: Record<string, unknown> = {
      id: raw.id,
      wave: effectiveWave,
      depends_on: raw.dependsOn,
      autonomous: raw.autonomous,
      objective: raw.objective,
      files_modified: raw.filesModified,
      task_count: raw.taskCount,
      has_summary: raw.hasSummary,
    };

    plans.push(plan);

    const waveKey = String(effectiveWave);
    if (!waves[waveKey]) {
      waves[waveKey] = [];
    }
    waves[waveKey].push(raw.id);
  }

  const result: Record<string, unknown> = {
    phase: normalized,
    plans,
    waves,
    incomplete,
    has_checkpoints: hasCheckpoints,
  };
  if (warnings.length > 0) {
    result['warnings'] = warnings;
  }

  return { data: result };
};
