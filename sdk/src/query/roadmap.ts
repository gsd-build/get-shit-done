/**
 * Roadmap query handlers — ROADMAP.md analysis and phase lookup.
 *
 * Ported from get-shit-done/bin/lib/roadmap.cjs and core.cjs.
 * Provides roadmap.analyze (multi-pass parsing with disk correlation)
 * and roadmap.get-phase (single phase section extraction).
 *
 * @example
 * ```typescript
 * import { roadmapAnalyze, roadmapGetPhase } from './roadmap.js';
 *
 * const analysis = await roadmapAnalyze([], '/project');
 * // { data: { phases: [...], phase_count: 6, progress_percent: 50, ... } }
 *
 * const phase = await roadmapGetPhase(['10'], '/project');
 * // { data: { found: true, phase_number: '10', phase_name: 'Read-Only Queries', ... } }
 * ```
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GSDError, ErrorClassification } from '../errors.js';
import {
  escapeRegex,
  normalizePhaseName,
  phaseTokenMatches,
  planningPaths,
} from './helpers.js';
import type { QueryHandler, QueryResult } from './utils.js';

// ─── Internal types ───────────────────────────────────────────────────────

interface PhaseSection {
  found: boolean;
  phase_number: string;
  phase_name: string;
  goal?: string | null;
  success_criteria?: string[];
  section?: string;
  error?: string;
  message?: string;
}

// ─── Exported helpers ─────────────────────────────────────────────────────

/**
 * Strip <details>...</details> blocks from content (shipped milestones).
 *
 * Port of stripShippedMilestones from core.cjs line 1082-1084.
 */
export function stripShippedMilestones(content: string): string {
  return content.replace(/<details>[\s\S]*?<\/details>/gi, '');
}

/**
 * Get milestone version and name from ROADMAP.md.
 *
 * Port of getMilestoneInfo from core.cjs lines 1367-1402.
 *
 * @param projectDir - Project root directory
 * @returns Object with version and name
 */
export async function getMilestoneInfo(projectDir: string): Promise<{ version: string; name: string }> {
  try {
    const roadmap = await readFile(planningPaths(projectDir).roadmap, 'utf-8');

    // First: check for list-format using in-progress marker
    const inProgressMatch = roadmap.match(/🚧\s*\*\*v(\d+(?:\.\d+)+)\s+([^*]+)\*\*/);
    if (inProgressMatch) {
      return { version: 'v' + inProgressMatch[1], name: inProgressMatch[2].trim() };
    }

    // Second: heading-format — strip shipped milestones
    const cleaned = stripShippedMilestones(roadmap);
    const headingMatch = cleaned.match(/## .*v(\d+(?:\.\d+)+)[:\s]+([^\n(]+)/);
    if (headingMatch) {
      return { version: 'v' + headingMatch[1], name: headingMatch[2].trim() };
    }

    // Fallback: bare version match
    const versionMatch = cleaned.match(/v(\d+(?:\.\d+)+)/);
    return {
      version: versionMatch ? versionMatch[0] : 'v1.0',
      name: 'milestone',
    };
  } catch {
    return { version: 'v1.0', name: 'milestone' };
  }
}

/**
 * Extract the current milestone section from ROADMAP.md.
 *
 * Port of extractCurrentMilestone from core.cjs lines 1102-1170.
 *
 * @param content - Full ROADMAP.md content
 * @param projectDir - Working directory for reading STATE.md
 * @returns Content scoped to current milestone
 */
export async function extractCurrentMilestone(content: string, projectDir: string): Promise<string> {
  // Get version from STATE.md frontmatter
  let version: string | null = null;
  try {
    const stateRaw = await readFile(planningPaths(projectDir).state, 'utf-8');
    const milestoneMatch = stateRaw.match(/^milestone:\s*(.+)/m);
    if (milestoneMatch) {
      version = milestoneMatch[1].trim();
    }
  } catch { /* intentionally empty */ }

  // Fallback: derive from ROADMAP in-progress marker
  if (!version) {
    const inProgressMatch = content.match(/🚧\s*\*\*v(\d+(?:\.\d+)+)\s/);
    if (inProgressMatch) {
      version = 'v' + inProgressMatch[1];
    }
  }

  if (!version) return stripShippedMilestones(content);

  // Find section matching this version
  const escapedVersion = escapeRegex(version);
  const sectionPattern = new RegExp(
    `(^#{1,3}\\s+.*${escapedVersion}[^\\n]*)`,
    'mi'
  );
  const sectionMatch = content.match(sectionPattern);

  if (!sectionMatch || sectionMatch.index === undefined) return stripShippedMilestones(content);

  const sectionStart = sectionMatch.index;

  // Find end: next milestone heading at same or higher level, or EOF.
  // Skip headings that belong to the SAME version (e.g. "## v2.0 Phase Details").
  const headingLevelMatch = sectionMatch[1].match(/^(#{1,3})\s/);
  const headingLevel = headingLevelMatch ? headingLevelMatch[1].length : 2;
  const restContent = content.slice(sectionStart + sectionMatch[0].length);

  // Extract current version so same-version sub-headings are not treated as boundaries.
  // Capture full semver (major.minor.patch) so v2.0.1 is not collapsed to "2.0".
  const currentVersionMatch = version ? version.match(/v(\d+(?:\.\d+)+)/i) : null;
  const currentVersionStr = currentVersionMatch ? currentVersionMatch[1] : '';

  const nextMilestoneRegex = new RegExp(
    `^#{1,${headingLevel}}\\s+(?:.*v(\\d+(?:\\.\\d+)+)[^\\n]*|.*(?:✅|📋|🚧))`,
    'gm'
  );

  let sectionEnd = content.length;
  let m: RegExpExecArray | null;
  while ((m = nextMilestoneRegex.exec(restContent)) !== null) {
    const matchedVersion = m[1];
    // Skip headings that reference the same version (e.g. "## v2.0 Phase Details").
    if (matchedVersion && currentVersionStr && matchedVersion === currentVersionStr) continue;
    sectionEnd = sectionStart + sectionMatch[0].length + m.index;
    break;
  }

  // Return only the current milestone section — never include the preamble, which
  // may contain ## Backlog and other non-current-milestone phases.
  return content.slice(sectionStart, sectionEnd);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/**
 * Search for a phase section in roadmap content.
 *
 * Port of searchPhaseInContent from roadmap.cjs lines 14-73.
 */
function searchPhaseInContent(content: string, escapedPhase: string, phaseNum: string): PhaseSection | null {
  // Match "## Phase X:", "### Phase X:", or "#### Phase X:" with optional name
  const phasePattern = new RegExp(
    `#{2,4}\\s*Phase\\s+${escapedPhase}:\\s*([^\\n]+)`,
    'i'
  );
  const headerMatch = content.match(phasePattern);

  if (!headerMatch) {
    // Fallback: check if phase exists in summary list but missing detail section
    const checklistPattern = new RegExp(
      `-\\s*\\[[ x]\\]\\s*\\*\\*Phase\\s+${escapedPhase}:\\s*([^*]+)\\*\\*`,
      'i'
    );
    const checklistMatch = content.match(checklistPattern);

    if (checklistMatch) {
      return {
        found: false,
        phase_number: phaseNum,
        phase_name: checklistMatch[1].trim(),
        error: 'malformed_roadmap',
        message: `Phase ${phaseNum} exists in summary list but missing "### Phase ${phaseNum}:" detail section. ROADMAP.md needs both formats.`,
      };
    }

    return null;
  }

  const phaseName = headerMatch[1].trim();
  const headerIndex = headerMatch.index!;

  // Find the end of this section (next ## or ### phase header, or end of file)
  const restOfContent = content.slice(headerIndex);
  const nextHeaderMatch = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
  const sectionEnd = nextHeaderMatch
    ? headerIndex + nextHeaderMatch.index!
    : content.length;

  const section = content.slice(headerIndex, sectionEnd).trim();

  // Extract goal if present (supports both **Goal:** and **Goal**: formats)
  const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
  const goal = goalMatch ? goalMatch[1].trim() : null;

  // Extract success criteria as structured array
  const criteriaMatch = section.match(/\*\*Success Criteria\*\*[^\n]*:\s*\n((?:\s*\d+\.\s*[^\n]+\n?)+)/i);
  const success_criteria = criteriaMatch
    ? criteriaMatch[1].trim().split('\n').map(line => line.replace(/^\s*\d+\.\s*/, '').trim()).filter(Boolean)
    : [];

  return {
    found: true,
    phase_number: phaseNum,
    phase_name: phaseName,
    goal,
    success_criteria,
    section,
  };
}

// ─── Exported handlers ────────────────────────────────────────────────────

/**
 * Query handler for roadmap.get-phase.
 *
 * Port of cmdRoadmapGetPhase from roadmap.cjs lines 75-113.
 *
 * @param args - args[0] is phase number (required)
 * @param projectDir - Project root directory
 * @returns QueryResult with phase section info or { found: false }
 */
export const roadmapGetPhase: QueryHandler = async (args, projectDir) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError(
      'Usage: roadmap get-phase <phase-number>',
      ErrorClassification.Validation,
    );
  }

  const roadmapPath = planningPaths(projectDir).roadmap;

  let rawContent: string;
  try {
    rawContent = await readFile(roadmapPath, 'utf-8');
  } catch {
    return { data: { found: false, error: 'ROADMAP.md not found' } };
  }

  const milestoneContent = await extractCurrentMilestone(rawContent, projectDir);
  const escapedPhase = escapeRegex(phaseNum);

  // Search the current milestone slice first, then fall back to full roadmap.
  const fullContent = stripShippedMilestones(rawContent);
  const milestoneResult = searchPhaseInContent(milestoneContent, escapedPhase, phaseNum);
  const result = (milestoneResult && !milestoneResult.error)
    ? milestoneResult
    : searchPhaseInContent(fullContent, escapedPhase, phaseNum) || milestoneResult;

  if (!result) {
    return { data: { found: false, phase_number: phaseNum } };
  }

  return { data: result };
};

/**
 * Query handler for roadmap.analyze.
 *
 * Port of cmdRoadmapAnalyze from roadmap.cjs lines 115-248.
 * Multi-pass regex parsing with disk status correlation.
 *
 * @param args - Unused
 * @param projectDir - Project root directory
 * @returns QueryResult with full roadmap analysis
 */
export const roadmapAnalyze: QueryHandler = async (_args, projectDir) => {
  const roadmapPath = planningPaths(projectDir).roadmap;

  let rawContent: string;
  try {
    rawContent = await readFile(roadmapPath, 'utf-8');
  } catch {
    return { data: { error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null } };
  }

  const content = await extractCurrentMilestone(rawContent, projectDir);
  const phasesDir = planningPaths(projectDir).phases;

  // IMPORTANT: Create regex INSIDE the function to avoid /g lastIndex persistence
  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const phases: Array<Record<string, unknown>> = [];
  let match: RegExpExecArray | null;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const phaseName = match[2].replace(/\(INSERTED\)/i, '').trim();

    // Extract goal from the section
    const sectionStart = match.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + nextHeader.index! : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const depends_on = dependsMatch ? dependsMatch[1].trim() : null;

    // Check completion on disk
    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;

    try {
      const entries = await readdir(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      const dirMatch = dirs.find(d => phaseTokenMatches(d, normalized));

      if (dirMatch) {
        const phaseFiles = await readdir(join(phasesDir, dirMatch));
        planCount = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md').length;
        summaryCount = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md').length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';
      }
    } catch { /* intentionally empty */ }

    // Check ROADMAP checkbox status
    const checkboxPattern = new RegExp(`-\\s*\\[(x| )\\]\\s*.*Phase\\s+${escapeRegex(phaseNum)}[:\\s]`, 'i');
    const checkboxMatch = content.match(checkboxPattern);
    const roadmapComplete = checkboxMatch ? checkboxMatch[1] === 'x' : false;

    // If roadmap marks phase complete, trust that over disk
    if (roadmapComplete && diskStatus !== 'complete') {
      diskStatus = 'complete';
    }

    phases.push({
      number: phaseNum,
      name: phaseName,
      goal,
      depends_on,
      plan_count: planCount,
      summary_count: summaryCount,
      has_context: hasContext,
      has_research: hasResearch,
      disk_status: diskStatus,
      roadmap_complete: roadmapComplete,
    });
  }

  // Extract milestone info
  const milestones: Array<{ heading: string; version: string }> = [];
  const milestonePattern = /##\s*(.*v(\d+(?:\.\d+)+)[^(\n]*)/gi;
  let mMatch: RegExpExecArray | null;
  while ((mMatch = milestonePattern.exec(content)) !== null) {
    milestones.push({
      heading: mMatch[1].trim(),
      version: 'v' + mMatch[2],
    });
  }

  // Find current and next phase
  const currentPhase = phases.find(p => p.disk_status === 'planned' || p.disk_status === 'partial') || null;
  const nextPhase = phases.find(p => p.disk_status === 'empty' || p.disk_status === 'no_directory' || p.disk_status === 'discussed' || p.disk_status === 'researched') || null;

  // Aggregated stats
  const totalPlans = phases.reduce((sum, p) => sum + (p.plan_count as number), 0);
  const totalSummaries = phases.reduce((sum, p) => sum + (p.summary_count as number), 0);
  const completedPhases = phases.filter(p => p.disk_status === 'complete').length;

  // Detect phases in summary list without detail sections (malformed ROADMAP)
  const checklistPattern = /-\s*\[[ x]\]\s*\*\*Phase\s+(\d+[A-Z]?(?:\.\d+)*)/gi;
  const checklistPhases = new Set<string>();
  let checklistMatch: RegExpExecArray | null;
  while ((checklistMatch = checklistPattern.exec(content)) !== null) {
    checklistPhases.add(checklistMatch[1]);
  }
  const detailPhases = new Set(phases.map(p => p.number as string));
  const missingDetails = [...checklistPhases].filter(p => !detailPhases.has(p));

  const result: Record<string, unknown> = {
    milestones,
    phases,
    phase_count: phases.length,
    completed_phases: completedPhases,
    total_plans: totalPlans,
    total_summaries: totalSummaries,
    progress_percent: totalPlans > 0 ? Math.min(100, Math.round((totalSummaries / totalPlans) * 100)) : 0,
    current_phase: currentPhase ? currentPhase.number : null,
    next_phase: nextPhase ? nextPhase.number : null,
    missing_phase_details: missingDetails.length > 0 ? missingDetails : null,
  };

  return { data: result };
};

// ─── roadmapUpdatePlanProgress ────────────────────────────────────────────

export const roadmapUpdatePlanProgress: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  const paths = planningPaths(projectDir);

  if (!phase) {
    return { data: { updated: false, reason: 'phase argument required' } };
  }

  try {
    let content = await readFile(paths.roadmap, 'utf-8');
    const phaseNum = normalizePhaseName(phase);
    const updated = content.replace(
      /(-\s*\[\s*\]\s*(?:Plan\s+\d+|plan\s+\d+|\*\*Plan))/gi,
      (match) => match.replace('[ ]', '[x]'),
    );
    if (updated !== content) {
      await writeFile(paths.roadmap, updated, 'utf-8');
      return { data: { updated: true, phase: phaseNum } };
    }
    return { data: { updated: false, phase: phaseNum, reason: 'no matching checkbox found' } };
  } catch {
    return { data: { updated: false, reason: 'ROADMAP.md not found or unreadable' } };
  }
};

// ─── requirementsMarkComplete ─────────────────────────────────────────────

export const requirementsMarkComplete: QueryHandler = async (args, projectDir) => {
  const reqIds = args;
  const paths = planningPaths(projectDir);

  if (reqIds.length === 0) {
    return { data: { marked: false, reason: 'requirement IDs required' } };
  }

  try {
    let content = await readFile(paths.requirements, 'utf-8');
    let changeCount = 0;

    for (const id of reqIds) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(`(-\\s*\\[\\s*\\]\\s*)([^\\n]*${escaped})`, 'gi');
      content = content.replace(pattern, (_m, _bracket, rest) => `- [x] ${rest}`.trim() + '\n' || `- [x] ${rest}`);
      if (content.includes(`[x]`) && content.includes(id)) changeCount++;
    }

    await writeFile(paths.requirements, content, 'utf-8');
    return { data: { marked: true, ids: reqIds, changed: changeCount } };
  } catch {
    return { data: { marked: false, reason: 'REQUIREMENTS.md not found or unreadable' } };
  }
};
