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

import { existsSync } from 'node:fs';
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
  // Pattern 1: <details>...</details> blocks (explicit collapse)
  let result = content.replace(/<details>[\s\S]*?<\/details>/gi, '');
  // Pattern 2: inline milestone headings marked as shipped.
  // Keep aligned with heading levels accepted by extractCurrentMilestone() (## and ###).
  const sections = result.split(/(?=^#{2,3}\s)/m);
  result = sections.filter(s => !/^#{2,3}\s[^\n]*✅\s*SHIPPED\b/im.test(s)).join('');
  return result;
}

/**
 * Read milestone + name from STATE.md frontmatter when ROADMAP does not encode them.
 */
async function parseMilestoneFromState(projectDir: string, workstream?: string): Promise<{ version: string; name: string } | null> {
  try {
    const stateRaw = await readFile(planningPaths(projectDir, workstream).state, 'utf-8');
    const vm = stateRaw.match(/^milestone:\s*(.+)$/m);
    if (!vm) return null;
    const version = vm[1].trim().replace(/^["']|["']$/g, '');
    const nm = stateRaw.match(/^milestone_name:\s*(.+)$/m);
    const name = nm ? nm[1].trim().replace(/^["']|["']$/g, '') : 'milestone';
    return { version, name };
  } catch {
    return null;
  }
}

/**
 * Get milestone version and name from ROADMAP.md (and optionally STATE.md).
 *
 * Port of getMilestoneInfo from core.cjs lines 1367-1402, extended for:
 * - 🟡 in-flight marker (same list shape as 🚧)
 * - milestone bullets `**vX.Y Title**` before `## Phases` (last = current when listed in semver order)
 * - STATE.md frontmatter when ROADMAP has no parseable milestone
 * - **last** bare `vX.Y` fallback (first match was often v1.0 from the shipped list)
 *
 * @param projectDir - Project root directory
 * @returns Object with version and name
 */
export async function getMilestoneInfo(projectDir: string, workstream?: string): Promise<{ version: string; name: string }> {
  try {
    // Priority 1: STATE.md frontmatter (authoritative for version; name only when real)
    const fromState = await parseMilestoneFromState(projectDir, workstream);
    const stateVersion = fromState?.version ?? null;
    const stateName = fromState && fromState.name !== 'milestone' ? fromState.name : null;
    if (stateVersion && stateName) {
      return { version: stateVersion, name: stateName };
    }
    // STATE.md has a version but no real name — fall through to ROADMAP for the name,
    // then override the version with the authoritative STATE.md value.

    const roadmap = await readFile(planningPaths(projectDir, workstream).roadmap, 'utf-8');

    // List-format: construction / blocked (legacy emoji)
    const barricadeMatch = roadmap.match(/🚧\s*\*\*v(\d+(?:\.\d+)+)\s+([^*]+)\*\*/);
    if (barricadeMatch) {
      return { version: stateVersion ?? 'v' + barricadeMatch[1], name: barricadeMatch[2].trim() };
    }

    // List-format: in flight / active (GSD ROADMAP template uses 🟡 for current milestone)
    const inFlightMatch = roadmap.match(/🟡\s*\*\*v(\d+(?:\.\d+)+)\s+([^*]+)\*\*/);
    if (inFlightMatch) {
      return { version: stateVersion ?? 'v' + inFlightMatch[1], name: inFlightMatch[2].trim() };
    }

    // Heading-format — strip shipped <details> blocks first
    const cleaned = stripShippedMilestones(roadmap);
    const headingMatch = cleaned.match(/##\s+.*v(\d+(?:\.\d+)+)[:\s]+([^\n(]+)/);
    if (headingMatch) {
      return { version: stateVersion ?? 'v' + headingMatch[1], name: headingMatch[2].trim() };
    }

    // Milestone bullet list (## Milestones … ## Phases): use last **vX.Y Title** — typically the current row
    const beforePhases = roadmap.split(/^##\s+Phases\b/m)[0] ?? roadmap;
    const boldMatches = [...beforePhases.matchAll(/\*\*v(\d+(?:\.\d+)+)\s+([^*]+)\*\*/g)];
    if (boldMatches.length > 0) {
      const last = boldMatches[boldMatches.length - 1];
      return { version: stateVersion ?? 'v' + last[1], name: last[2].trim() };
    }

    const allBare = [...cleaned.matchAll(/\bv(\d+(?:\.\d+)+)\b/g)];
    if (allBare.length > 0) {
      const lastBare = allBare[allBare.length - 1];
      return { version: stateVersion ?? lastBare[0], name: 'milestone' };
    }

    return { version: stateVersion ?? 'v1.0', name: 'milestone' };
  } catch {
    const fromState = await parseMilestoneFromState(projectDir, workstream);
    if (fromState) return fromState;
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
export async function extractCurrentMilestone(content: string, projectDir: string, workstream?: string): Promise<string> {
  // Get version from STATE.md frontmatter
  let version: string | null = null;
  try {
    const stateRaw = await readFile(planningPaths(projectDir, workstream).state, 'utf-8');
    const milestoneMatch = stateRaw.match(/^milestone:\s*(.+)/m);
    if (milestoneMatch) {
      version = milestoneMatch[1].trim();
    }
  } catch { /* intentionally empty */ }

  // Fallback: derive from ROADMAP in-progress marker
  if (!version) {
    const inProgressMatch = content.match(/(?:🚧|🟡)\s*\*\*v(\d+(?:\.\d+)+)\s/);
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
    `^#{1,${headingLevel}}\\s+(?:.*v(\\d+(?:\\.\\d+)+)[^\\n]*|.*(?:✅|📋|🚧|🟡))`,
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
export const roadmapGetPhase: QueryHandler = async (args, projectDir, workstream) => {
  const phaseNum = args[0];
  if (!phaseNum) {
    throw new GSDError(
      'Usage: roadmap get-phase <phase-number>',
      ErrorClassification.Validation,
    );
  }

  const roadmapPath = planningPaths(projectDir, workstream).roadmap;

  let rawContent: string;
  try {
    rawContent = await readFile(roadmapPath, 'utf-8');
  } catch {
    return { data: { found: false, error: 'ROADMAP.md not found' } };
  }

  const milestoneContent = await extractCurrentMilestone(rawContent, projectDir, workstream);
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
export const roadmapAnalyze: QueryHandler = async (_args, projectDir, workstream) => {
  const roadmapPath = planningPaths(projectDir, workstream).roadmap;

  let rawContent: string;
  try {
    rawContent = await readFile(roadmapPath, 'utf-8');
  } catch {
    return { data: { error: 'ROADMAP.md not found', milestones: [], phases: [], current_phase: null } };
  }

  const content = await extractCurrentMilestone(rawContent, projectDir, workstream);
  const phasesDir = planningPaths(projectDir, workstream).phases;

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


// ─── roadmapAnnotateDependencies ─────────────────────────────────────────

/**
 * Annotate the ROADMAP.md plan list with wave dependency notes and
 * cross-cutting constraints derived from PLAN frontmatter.
 *
 * Delegates to gsd-tools.cjs which holds the full annotation logic.
 * Returns { updated, phase, waves, cross_cutting_constraints }.
 */
export const roadmapAnnotateDependencies: QueryHandler = async (args, projectDir) => {
  const phase = args[0];
  if (!phase) {
    return { data: { updated: false, reason: 'phase argument required' } };
  }

  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');

  const toolsPath = fileURLToPath(
    new URL('../../../get-shit-done/bin/gsd-tools.cjs', import.meta.url),
  );

  const result = spawnSync(process.execPath, [toolsPath, 'roadmap', 'annotate-dependencies', phase], {
    cwd: projectDir,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });

  if (result.error) {
    return { data: { updated: false, reason: result.error.message || 'gsd-tools invocation failed' } };
  }

  if (result.status !== 0) {
    return { data: { updated: false, reason: result.stderr?.trim() || 'gsd-tools error' } };
  }

  try {
    return { data: JSON.parse(result.stdout.trim()) };
  } catch {
    return { data: { updated: false, reason: 'failed to parse gsd-tools output' } };
  }
};


// ─── requirementsMarkComplete ─────────────────────────────────────────────

/**
 * Mark requirement IDs complete in REQUIREMENTS.md (checkbox + traceability table).
 * Port of `cmdRequirementsMarkComplete` from milestone.cjs lines 11–87.
 */
export const requirementsMarkComplete: QueryHandler = async (args, projectDir, workstream) => {
  if (args.length === 0) {
    throw new GSDError(
      'requirement IDs required. Usage: requirements mark-complete REQ-01,REQ-02 or REQ-01 REQ-02',
      ErrorClassification.Validation,
    );
  }

  const reqIds = args
    .join(' ')
    .replace(/[\[\]]/g, '')
    .split(/[,\s]+/)
    .map(r => r.trim())
    .filter(Boolean);

  if (reqIds.length === 0) {
    throw new GSDError('no valid requirement IDs found', ErrorClassification.Validation);
  }

  const paths = planningPaths(projectDir, workstream);
  if (!existsSync(paths.requirements)) {
    return { data: { updated: false, reason: 'REQUIREMENTS.md not found', ids: reqIds } };
  }

  let reqContent = (await readFile(paths.requirements, 'utf-8')).replace(/\r\n/g, '\n');
  const updated: string[] = [];
  const alreadyComplete: string[] = [];
  const notFound: string[] = [];

  for (const reqId of reqIds) {
    let found = false;
    const reqEscaped = escapeRegex(reqId);

    const checkboxPattern = new RegExp(`(-\\s*\\[)[ ](\\]\\s*\\*\\*${reqEscaped}\\*\\*)`, 'gi');
    const afterCheckbox = reqContent.replace(checkboxPattern, '$1x$2');
    if (afterCheckbox !== reqContent) {
      reqContent = afterCheckbox;
      found = true;
    }

    const tablePattern = new RegExp(`(\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|)\\s*Pending\\s*(\\|)`, 'gi');
    const afterTable = reqContent.replace(tablePattern, '$1 Complete $2');
    if (afterTable !== reqContent) {
      reqContent = afterTable;
      found = true;
    }

    if (found) {
      updated.push(reqId);
    } else {
      const doneCheckbox = new RegExp(`-\\s*\\[x\\]\\s*\\*\\*${reqEscaped}\\*\\*`, 'i');
      const doneTable = new RegExp(`\\|\\s*${reqEscaped}\\s*\\|[^|]+\\|\\s*Complete\\s*\\|`, 'i');
      if (doneCheckbox.test(reqContent) || doneTable.test(reqContent)) {
        alreadyComplete.push(reqId);
      } else {
        notFound.push(reqId);
      }
    }
  }

  if (updated.length > 0) {
    await writeFile(paths.requirements, reqContent, 'utf-8');
  }

  return {
    data: {
      updated: updated.length > 0,
      marked_complete: updated,
      already_complete: alreadyComplete,
      not_found: notFound,
      total: reqIds.length,
    },
  };
};
