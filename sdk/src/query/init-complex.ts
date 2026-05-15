/**
 * Complex init composition handlers — the 3 heavyweight init commands
 * that require deep filesystem scanning and ROADMAP.md parsing.
 *
 * Composes existing atomic SDK queries into the same flat JSON bundles
 * that CJS init.cjs produces for the new-project, progress, and manager
 * workflows.
 *
 * Port of get-shit-done/bin/lib/init.cjs cmdInitNewProject (lines 296-399),
 * cmdInitProgress (lines 1139-1284), cmdInitManager (lines 854-1137).
 *
 * @example
 * ```typescript
 * import { initProgress, initManager } from './init-complex.js';
 *
 * const result = await initProgress([], '/project');
 * // { data: { phases: [...], milestone_version: 'v3.0', ... } }
 * ```
 */

import { existsSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { execSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';

import { loadConfig } from '../config.js';
import { resolveModel } from './config-query.js';
import {
  detectRuntime,
  planningPaths,
  normalizePhaseName,
  phaseTokenMatches,
  resolveAgentsDir,
  toPosixPath,
} from './helpers.js';
import {
  getMilestoneInfo,
  extractCurrentMilestone,
  extractNextMilestoneSection,
  extractPhasesFromSection,
} from './roadmap.js';
import { agentSkills } from './skills.js';
import { withProjectRoot } from './init.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Get model alias string from resolveModel result.
 */
async function getModelAlias(agentType: string, projectDir: string): Promise<string> {
  const result = await resolveModel([agentType], projectDir);
  const data = result.data as Record<string, unknown>;
  return typeof data.model === 'string' ? data.model : 'sonnet';
}

/**
 * Check if a file exists at a relative path within projectDir.
 */
function pathExists(base: string, relPath: string): boolean {
  return existsSync(join(base, relPath));
}

/**
 * Bug #3491: detect whether `base` is inside any git worktree, and if so,
 * return the absolute worktree root. Mirrors the CJS `gitWorktreeInfoInternal`
 * in get-shit-done/bin/lib/core.cjs — keep these two implementations behaviour-
 * identical so the SDK and CJS init handlers emit the same has_git semantics.
 *
 * Returns { inside, worktreeRoot } — both fall back to false/null on any error
 * (git unavailable, not a repo, timeout) so callers see the conservative
 * default that preserves pre-fix behaviour for non-git environments.
 */
function gitWorktreeInfo(base: string): { inside: boolean; worktreeRoot: string | null } {
  try {
    const inside = execSync('git rev-parse --is-inside-work-tree', {
      cwd: base,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
      timeout: 5000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
    if (inside !== 'true') return { inside: false, worktreeRoot: null };
    try {
      const root = execSync('git rev-parse --show-toplevel', {
        cwd: base,
        stdio: ['ignore', 'pipe', 'ignore'],
        encoding: 'utf-8',
        timeout: 5000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      }).trim();
      return { inside: true, worktreeRoot: root || null };
    } catch {
      return { inside: true, worktreeRoot: null };
    }
  } catch {
    return { inside: false, worktreeRoot: null };
  }
}


const NEW_PROJECT_REQUIRED_AGENTS = [
  'gsd-project-researcher',
  'gsd-research-synthesizer',
  'gsd-roadmapper',
];

function hasAgentDefinition(agentsDir: string, agent: string): boolean {
  return existsSync(join(agentsDir, `${agent}.md`)) ||
    existsSync(join(agentsDir, `${agent}.agent.md`));
}

async function resolveAgentSkillPayloadAgents(
  requiredAgents: string[],
  projectDir: string,
): Promise<string[]> {
  const available: string[] = [];
  for (const agent of requiredAgents) {
    const result = await agentSkills([agent], projectDir);
    if (typeof result.data === 'string' && result.data.trim() !== '') {
      available.push(agent);
    }
  }
  return available;
}

/**
 * Extract ROADMAP checkbox states: `- [x] Phase N` → true, `- [ ] Phase N` → false.
 * Shared by initProgress and initManager so both treat ROADMAP as the
 * fallback/override source of truth for completion.
 */
function extractCheckboxStates(content: string): Map<string, boolean> {
  const states = new Map<string, boolean>();
  const pattern = /-\s*\[(x| )\]\s*.*Phase\s+(\d+[A-Z]?(?:\.\d+)*)[:\s]/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    states.set(m[2], m[1].toLowerCase() === 'x');
  }
  return states;
}

/**
 * Extract terminal phase markers from ROADMAP phase headings, e.g.
 * `(COMPLETE)`, `(SHIPPED ...)`, `(DEFERRED)`, `(SUPERSEDED ...)`.
 * These labels mean the phase should not be selected as next pending work.
 */
function extractTerminalStatusLabels(content: string): Set<string> {
  const terminal = new Set<string>();
  const headingPattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const terminalRe = /(?:\(|\*\*)\s*(SHIPPED|COMPLETE|DEFERRED|SUPERSEDED|MERGED\s+INTO|FOLDED\s+INTO)\b/i;
  let m: RegExpExecArray | null;
  while ((m = headingPattern.exec(content)) !== null) {
    if (terminalRe.test(m[2])) {
      terminal.add(m[1]);
      terminal.add(m[1].replace(/^0+/, '') || '0');
    }
  }
  return terminal;
}

/**
 * Derive progress-level status from a ROADMAP checkbox when the phase has
 * no on-disk directory. Returns 'complete' for `[x]`, 'not_started' otherwise.
 * Disk status (when present) always wins — it's more recent truth for in-flight work.
 */
function deriveStatusFromCheckbox(
  phaseNum: string,
  checkboxStates: Map<string, boolean>,
): 'complete' | 'not_started' {
  const stripped = phaseNum.replace(/^0+/, '') || '0';
  if (checkboxStates.get(phaseNum) === true) return 'complete';
  if (checkboxStates.get(stripped) === true) return 'complete';
  return 'not_started';
}

function listPhasePlanAndSummaryCounts(phasePath: string): { plans: string[]; summaries: string[] } {
  const phaseFiles = readdirSync(phasePath);
  const rootPlans = phaseFiles.filter(f => f.endsWith('-PLAN.md') || f === 'PLAN.md');
  const rootSummaries = phaseFiles.filter(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');

  const plansDir = join(phasePath, 'plans');
  let nestedPlans: string[] = [];
  let nestedSummaries: string[] = [];
  if (existsSync(plansDir)) {
    const files = readdirSync(plansDir);
    nestedPlans = files.filter(f => /^PLAN-\d+.*\.md$/i.test(f));
    nestedSummaries = files.filter(f => /^SUMMARY-\d+.*\.md$/i.test(f));
  }

  return {
    plans: rootPlans.concat(nestedPlans),
    summaries: rootSummaries.concat(nestedSummaries),
  };
}

// ─── initNewProject ───────────────────────────────────────────────────────

/**
 * Init handler for new-project workflow.
 *
 * Detects brownfield state (existing code, package files, git), checks
 * search API availability, and resolves project researcher models.
 *
 * Port of cmdInitNewProject from init.cjs lines 296-399.
 */
export const initNewProject: QueryHandler = async (_args, projectDir, workstream) => {
  const config = await loadConfig(projectDir, workstream);

  // Detect search API key availability from env vars and ~/.gsd/ files
  const gsdHome = join(homedir(), '.gsd');
  const hasBraveSearch = !!(
    process.env.BRAVE_API_KEY ||
    existsSync(join(gsdHome, 'brave_api_key'))
  );
  const hasFirecrawl = !!(
    process.env.FIRECRAWL_API_KEY ||
    existsSync(join(gsdHome, 'firecrawl_api_key'))
  );
  const hasExaSearch = !!(
    process.env.EXA_API_KEY ||
    existsSync(join(gsdHome, 'exa_api_key'))
  );

  // Detect existing code (depth-limited scan, no external tools)
  const codeExtensions = new Set([
    '.ts', '.js', '.py', '.go', '.rs', '.swift', '.java',
    '.kt', '.kts', '.c', '.cpp', '.h', '.cs', '.rb', '.php',
    '.dart', '.m', '.mm', '.scala', '.groovy', '.lua',
    '.r', '.R', '.zig', '.ex', '.exs', '.clj',
  ]);
  const skipDirs = new Set([
    'node_modules', '.git', '.planning', '.claude', '.codex',
    '__pycache__', 'target', 'dist', 'build',
  ]);

  function findCodeFiles(dir: string, depth: number): boolean {
    if (depth > 3) return false;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isFile()) {
        const ext = entry.name.slice(entry.name.lastIndexOf('.'));
        if (codeExtensions.has(ext)) return true;
      } else if (entry.isDirectory() && !skipDirs.has(entry.name)) {
        if (findCodeFiles(join(dir, entry.name), depth + 1)) return true;
      }
    }
    return false;
  }

  let hasExistingCode = false;
  try {
    hasExistingCode = findCodeFiles(projectDir, 0);
  } catch { /* best-effort */ }

  const hasPackageFile =
    pathExists(projectDir, 'package.json') ||
    pathExists(projectDir, 'requirements.txt') ||
    pathExists(projectDir, 'Cargo.toml') ||
    pathExists(projectDir, 'go.mod') ||
    pathExists(projectDir, 'Package.swift') ||
    pathExists(projectDir, 'build.gradle') ||
    pathExists(projectDir, 'build.gradle.kts') ||
    pathExists(projectDir, 'pom.xml') ||
    pathExists(projectDir, 'Gemfile') ||
    pathExists(projectDir, 'composer.json') ||
    pathExists(projectDir, 'pubspec.yaml') ||
    pathExists(projectDir, 'CMakeLists.txt') ||
    pathExists(projectDir, 'Makefile') ||
    pathExists(projectDir, 'build.zig') ||
    pathExists(projectDir, 'mix.exs') ||
    pathExists(projectDir, 'project.clj');

  const [researcherModel, synthesizerModel, roadmapperModel] = await Promise.all([
    getModelAlias('gsd-project-researcher', projectDir),
    getModelAlias('gsd-research-synthesizer', projectDir),
    getModelAlias('gsd-roadmapper', projectDir),
  ]);
  const runtime = detectRuntime(config as { runtime?: unknown });
  const agentsDir = resolveAgentsDir(runtime);
  const missingRequiredAgents = NEW_PROJECT_REQUIRED_AGENTS.filter(
    agent => !hasAgentDefinition(agentsDir, agent),
  );
  const agentSkillPayloadAgents = await resolveAgentSkillPayloadAgents(
    NEW_PROJECT_REQUIRED_AGENTS,
    projectDir,
  );

  const result: Record<string, unknown> = {
    researcher_model: researcherModel,
    synthesizer_model: synthesizerModel,
    roadmapper_model: roadmapperModel,

    commit_docs: config.commit_docs,

    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    has_codebase_map: pathExists(projectDir, '.planning/codebase'),
    planning_exists: pathExists(projectDir, '.planning'),

    has_existing_code: hasExistingCode,
    has_package_file: hasPackageFile,
    is_brownfield: hasExistingCode || hasPackageFile,
    needs_codebase_map:
      (hasExistingCode || hasPackageFile) && !pathExists(projectDir, '.planning/codebase'),

    // Bug #3491: detect parent worktree to avoid nested .git init.
    has_git: (() => gitWorktreeInfo(projectDir).inside)(),
    git_worktree_root: (() => gitWorktreeInfo(projectDir).worktreeRoot)(),
    in_nested_subdir: (() => {
      const info = gitWorktreeInfo(projectDir);
      return info.inside && info.worktreeRoot !== null && info.worktreeRoot !== projectDir;
    })(),

    brave_search_available: hasBraveSearch,
    firecrawl_available: hasFirecrawl,
    exa_search_available: hasExaSearch,

    project_path: '.planning/PROJECT.md',
    agent_runtime: runtime,
    agents_dir: agentsDir,
    required_agents: NEW_PROJECT_REQUIRED_AGENTS,
    required_agents_installed: missingRequiredAgents.length === 0,
    missing_required_agents: missingRequiredAgents,
    agent_skill_payloads_available: agentSkillPayloadAgents.length === NEW_PROJECT_REQUIRED_AGENTS.length,
    agent_skill_payload_agents: agentSkillPayloadAgents,
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initProgress ─────────────────────────────────────────────────────────

/**
 * Init handler for progress workflow.
 *
 * Builds phase list with plan/summary counts and paused state detection.
 *
 * Port of cmdInitProgress from init.cjs lines 1139-1284.
 */
export const initProgress: QueryHandler = async (_args, projectDir, workstream) => {
  const config = await loadConfig(projectDir, workstream);
  const milestone = await getMilestoneInfo(projectDir, workstream);
  const paths = planningPaths(projectDir, workstream);

  const phases: Record<string, unknown>[] = [];
  let currentPhase: Record<string, unknown> | null = null;
  let nextPhase: Record<string, unknown> | null = null;

  // Build set of phases from ROADMAP for the current milestone
  const roadmapPhaseNames = new Map<string, string>();
  const seenPhaseNums = new Set<string>();
  let checkboxStates = new Map<string, boolean>();
  let terminalLabels = new Set<string>();

  try {
    const rawRoadmap = await readFile(paths.roadmap, 'utf-8');
    const roadmapContent = await extractCurrentMilestone(rawRoadmap, projectDir, workstream);
    const headingPattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
    let hm: RegExpExecArray | null;
    while ((hm = headingPattern.exec(roadmapContent)) !== null) {
      const pNum = hm[1];
      const pName = hm[2].replace(/\(INSERTED\)/i, '').trim();
      roadmapPhaseNames.set(pNum, pName);
    }
    checkboxStates = extractCheckboxStates(roadmapContent);
    terminalLabels = extractTerminalStatusLabels(roadmapContent);
  } catch { /* intentionally empty */ }

  // Scan phase directories
  try {
    const entries = readdirSync(paths.phases, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort((a, b) => {
        const pa = a.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
        const pb = b.match(/^(\d+[A-Z]?(?:\.\d+)*)/i);
        if (!pa || !pb) return a.localeCompare(b);
        return parseInt(pa[1], 10) - parseInt(pb[1], 10);
      });

    for (const dir of dirs) {
      const match = dir.match(/^(\d+[A-Z]?(?:\.\d+)*)-?(.*)/i);
      const phaseNumber = match ? match[1] : dir;
      const phaseName = match && match[2] ? match[2] : null;
      seenPhaseNums.add(phaseNumber.replace(/^0+/, '') || '0');

      const phasePath = join(paths.phases, dir);
      const phaseFiles = readdirSync(phasePath);

      const { plans, summaries } = listPhasePlanAndSummaryCounts(phasePath);
      const hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

      let status =
        summaries.length >= plans.length && plans.length > 0 ? 'complete' :
        plans.length > 0 ? 'in_progress' :
        hasResearch ? 'researched' : 'pending';

      // #2674: align with initManager — a ROADMAP `- [x] Phase N` checkbox
      // wins over disk state. A stub phase dir with no SUMMARY is leftover
      // scaffolding; the user's explicit [x] is the authoritative signal.
      const strippedNum = phaseNumber.replace(/^0+/, '') || '0';
      const roadmapComplete =
        checkboxStates.get(phaseNumber) === true ||
        checkboxStates.get(strippedNum) === true;
      if (roadmapComplete && status !== 'complete') {
        status = 'complete';
      }
      if (terminalLabels.has(phaseNumber) || terminalLabels.has(strippedNum)) {
        status = 'complete';
      }

      const phaseInfo: Record<string, unknown> = {
        number: phaseNumber,
        name: phaseName,
        directory: toPosixPath(relative(projectDir, join(paths.phases, dir))),
        status,
        plan_count: plans.length,
        summary_count: summaries.length,
        has_research: hasResearch,
      };

      phases.push(phaseInfo);

      if (!currentPhase && (status === 'in_progress' || status === 'researched')) {
        currentPhase = phaseInfo;
      }
      if (!nextPhase && status === 'pending') {
        nextPhase = phaseInfo;
      }
    }
  } catch { /* intentionally empty */ }

  // Add ROADMAP-only phases not yet on disk. For phases with a ROADMAP
  // `[x]` checkbox, treat them as complete (#2646).
  for (const [num, name] of roadmapPhaseNames) {
    const stripped = num.replace(/^0+/, '') || '0';
    if (!seenPhaseNums.has(stripped)) {
      const status = deriveStatusFromCheckbox(num, checkboxStates);
      const terminalComplete = terminalLabels.has(num) || terminalLabels.has(stripped);
      const phaseInfo: Record<string, unknown> = {
        number: num,
        name: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
        directory: null,
        status: terminalComplete ? 'complete' : status,
        plan_count: 0,
        summary_count: 0,
        has_research: false,
      };
      phases.push(phaseInfo);
      if (!nextPhase && !currentPhase && phaseInfo.status !== 'complete') {
        nextPhase = phaseInfo;
      }
    }
  }

  phases.sort((a, b) => parseInt(a.number as string, 10) - parseInt(b.number as string, 10));

  // Check paused state in STATE.md
  let pausedAt: string | null = null;
  try {
    const stateContent = await readFile(paths.state, 'utf-8');
    const pauseMatch = stateContent.match(/\*\*Paused At:\*\*\s*(.+)/);
    if (pauseMatch) pausedAt = pauseMatch[1].trim();
  } catch { /* intentionally empty */ }

  const result: Record<string, unknown> = {
    executor_model: await getModelAlias('gsd-executor', projectDir),
    planner_model: await getModelAlias('gsd-planner', projectDir),

    commit_docs: config.commit_docs,

    milestone_version: milestone.version,
    milestone_name: milestone.name,

    phases,
    phase_count: phases.length,
    completed_count: phases.filter(p => p.status === 'complete').length,
    in_progress_count: phases.filter(p => p.status === 'in_progress').length,

    current_phase: currentPhase,
    next_phase: nextPhase,
    paused_at: pausedAt,
    has_work_in_progress: !!currentPhase,

    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    roadmap_exists: existsSync(paths.roadmap),
    state_exists: existsSync(paths.state),
    state_path: toPosixPath(relative(projectDir, paths.state)),
    roadmap_path: toPosixPath(relative(projectDir, paths.roadmap)),
    project_path: '.planning/PROJECT.md',
    config_path: toPosixPath(relative(projectDir, paths.config)),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initManager ─────────────────────────────────────────────────────────

/**
 * Init handler for manager workflow.
 *
 * Parses ROADMAP.md for all phases, computes disk status, dependency
 * graph, and recommended actions per phase.
 *
 * Port of cmdInitManager from init.cjs lines 854-1137.
 */
export const initManager: QueryHandler = async (_args, projectDir, workstream) => {
  const config = await loadConfig(projectDir, workstream);
  const milestone = await getMilestoneInfo(projectDir, workstream);
  const paths = planningPaths(projectDir, workstream);

  let rawContent: string;
  try {
    rawContent = await readFile(paths.roadmap, 'utf-8');
  } catch {
    return { data: { error: 'No ROADMAP.md found. Run /gsd-new-milestone first.' } };
  }

  const content = await extractCurrentMilestone(rawContent, projectDir, workstream);

  // Pre-compute directory listing once
  let phaseDirEntries: string[] = [];
  try {
    phaseDirEntries = readdirSync(paths.phases, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { /* intentionally empty */ }

  // Pre-extract checkbox states in a single pass (shared helper — #2646)
  const checkboxStates = extractCheckboxStates(content);

  const phasePattern = /#{2,4}\s*Phase\s+(\d+[A-Z]?(?:\.\d+)*)\s*:\s*([^\n]+)/gi;
  const phases: Record<string, unknown>[] = [];
  let pMatch: RegExpExecArray | null;

  while ((pMatch = phasePattern.exec(content)) !== null) {
    const phaseNum = pMatch[1];
    const phaseName = pMatch[2].replace(/\(INSERTED\)/i, '').trim();

    const sectionStart = pMatch.index;
    const restOfContent = content.slice(sectionStart);
    const nextHeader = restOfContent.match(/\n#{2,4}\s+Phase\s+\d/i);
    const sectionEnd = nextHeader ? sectionStart + (nextHeader.index ?? 0) : content.length;
    const section = content.slice(sectionStart, sectionEnd);

    const goalMatch = section.match(/\*\*Goal(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const goal = goalMatch ? goalMatch[1].trim() : null;

    const dependsMatch = section.match(/\*\*Depends on(?::\*\*|\*\*:)\s*([^\n]+)/i);
    const dependsOn = dependsMatch ? dependsMatch[1].trim() : null;

    const normalized = normalizePhaseName(phaseNum);
    let diskStatus = 'no_directory';
    let planCount = 0;
    let summaryCount = 0;
    let hasContext = false;
    let hasResearch = false;
    let lastActivity: string | null = null;
    let isActive = false;

    try {
      const dirMatch = phaseDirEntries.find(d => phaseTokenMatches(d, normalized));
      if (dirMatch) {
        const fullDir = join(paths.phases, dirMatch);
        const phaseFiles = readdirSync(fullDir);
        const counts = listPhasePlanAndSummaryCounts(fullDir);
        planCount = counts.plans.length;
        summaryCount = counts.summaries.length;
        hasContext = phaseFiles.some(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
        hasResearch = phaseFiles.some(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');

        if (summaryCount >= planCount && planCount > 0) diskStatus = 'complete';
        else if (summaryCount > 0) diskStatus = 'partial';
        else if (planCount > 0) diskStatus = 'planned';
        else if (hasResearch) diskStatus = 'researched';
        else if (hasContext) diskStatus = 'discussed';
        else diskStatus = 'empty';

        const now = Date.now();
        let newestMtime = 0;
        for (const f of phaseFiles) {
          try {
            const st = statSync(join(fullDir, f));
            if (st.mtimeMs > newestMtime) newestMtime = st.mtimeMs;
          } catch { /* intentionally empty */ }
        }
        if (newestMtime > 0) {
          lastActivity = new Date(newestMtime).toISOString();
          isActive = (now - newestMtime) < 300000; // 5 minutes
        }
      }
    } catch { /* intentionally empty */ }

    const roadmapComplete = checkboxStates.get(phaseNum) || false;
    if (roadmapComplete && diskStatus !== 'complete') {
      diskStatus = 'complete';
    }

    const MAX_NAME_WIDTH = 20;
    const displayName = phaseName.length > MAX_NAME_WIDTH
      ? phaseName.slice(0, MAX_NAME_WIDTH - 1) + '…'
      : phaseName;

    phases.push({
      number: phaseNum,
      name: phaseName,
      display_name: displayName,
      goal,
      depends_on: dependsOn,
      disk_status: diskStatus,
      has_context: hasContext,
      has_research: hasResearch,
      plan_count: planCount,
      summary_count: summaryCount,
      roadmap_complete: roadmapComplete,
      last_activity: lastActivity,
      is_active: isActive,
    });
  }

  // Dependency satisfaction
  const completedNums = new Set(
    phases.filter(p => p.disk_status === 'complete').map(p => p.number as string),
  );
  for (const phase of phases) {
    const dependsOnStr = phase.depends_on as string | null;
    if (!dependsOnStr || /^none$/i.test(dependsOnStr.trim())) {
      phase.deps_satisfied = true;
      phase.dep_phases = [];
      phase.deps_display = '—';
    } else {
      const depNums = dependsOnStr.match(/\d+(?:\.\d+)*/g) || [];
      phase.deps_satisfied = depNums.every(n => completedNums.has(n));
      phase.dep_phases = depNums;
      phase.deps_display = depNums.length > 0 ? depNums.join(',') : '—';
    }
  }

  // Bug #2268: mark EVERY undiscussed phase as is_next_to_discuss, not just
  // the first one.  Multiple independent phases can be discussed in parallel
  // — the sliding-window pattern made the manager only recommend one
  // discuss action even when callers had free capacity to discuss several.
  for (const phase of phases) {
    const status = phase.disk_status as string;
    phase.is_next_to_discuss = (status === 'empty' || status === 'no_directory');
  }

  // Check WAITING.json signal
  let waitingSignal: unknown = null;
  try {
    const waitingPath = join(projectDir, '.planning', 'WAITING.json');
    if (existsSync(waitingPath)) {
      const { readFileSync } = await import('node:fs');
      waitingSignal = JSON.parse(readFileSync(waitingPath, 'utf-8'));
    }
  } catch { /* intentionally empty */ }

  // Compute recommended actions
  const phaseMap = new Map(phases.map(p => [p.number as string, p]));

  function reaches(from: string, to: string, visited = new Set<string>()): boolean {
    if (visited.has(from)) return false;
    visited.add(from);
    const p = phaseMap.get(from);
    const depPhases = p?.dep_phases as string[] | undefined;
    if (!depPhases || depPhases.length === 0) return false;
    if (depPhases.includes(to)) return true;
    return depPhases.some(dep => reaches(dep, to, visited));
  }

  const activeExecuting = phases.filter(p => {
    const status = p.disk_status as string;
    return status === 'partial' || (status === 'planned' && p.is_active);
  });
  const activePlanning = phases.filter(p => {
    const status = p.disk_status as string;
    return p.is_active && (status === 'discussed' || status === 'researched');
  });

  const recommendedActions: Record<string, unknown>[] = [];
  for (const phase of phases) {
    const status = phase.disk_status as string;
    if (status === 'complete') continue;
    if (/^999(?:\.|$)/.test(phase.number as string)) continue;

    if (status === 'planned' && phase.deps_satisfied) {
      const action = {
        phase: phase.number,
        phase_name: phase.name,
        action: 'execute',
        reason: `${phase.plan_count} plans ready, dependencies met`,
        command: `/gsd-execute-phase ${phase.number}`,
      };
      const isAllowed = activeExecuting.length === 0 ||
        activeExecuting.every(a => !reaches(phase.number as string, a.number as string) && !reaches(a.number as string, phase.number as string));
      if (isAllowed) recommendedActions.push(action);
    } else if (status === 'discussed' || status === 'researched') {
      const action = {
        phase: phase.number,
        phase_name: phase.name,
        action: 'plan',
        reason: 'Context gathered, ready for planning',
        command: `/gsd-plan-phase ${phase.number}`,
      };
      const isAllowed = activePlanning.length === 0 ||
        activePlanning.every(a => !reaches(phase.number as string, a.number as string) && !reaches(a.number as string, phase.number as string));
      if (isAllowed) recommendedActions.push(action);
    } else if ((status === 'empty' || status === 'no_directory') && phase.is_next_to_discuss) {
      recommendedActions.push({
        phase: phase.number,
        phase_name: phase.name,
        action: 'discuss',
        reason: 'Unblocked, ready to gather context',
        command: `/gsd-discuss-phase ${phase.number}`,
      });
    }
  }

  const completedCount = phases.filter(p => p.disk_status === 'complete').length;

  // ── Next-milestone surface (issue #2497) ───────────────────────────────
  // Populate queued_phases + metadata with the milestone immediately after
  // the active one, so the /gsd-manager dashboard can preview what's coming
  // next without mixing it into the active phases grid. Empty/null when the
  // active milestone is the last one in ROADMAP.
  let queuedPhases: Record<string, unknown>[] = [];
  let queuedMilestoneVersion: string | null = null;
  let queuedMilestoneName: string | null = null;
  try {
    const next = await extractNextMilestoneSection(rawContent, projectDir);
    if (next) {
      queuedMilestoneVersion = next.version;
      queuedMilestoneName = next.name;
      queuedPhases = extractPhasesFromSection(next.section).map(p => {
        const MAX_NAME_WIDTH = 20;
        const display_name = p.name.length > MAX_NAME_WIDTH
          ? p.name.slice(0, MAX_NAME_WIDTH - 1) + '…'
          : p.name;
        const depNums = p.depends_on && !/^none$/i.test(p.depends_on.trim())
          ? (p.depends_on.match(/\d+(?:\.\d+)*/g) || [])
          : [];
        return {
          number: p.number,
          name: p.name,
          display_name,
          goal: p.goal,
          depends_on: p.depends_on,
          dep_phases: depNums,
          deps_display: depNums.length > 0 ? depNums.join(',') : '—',
        };
      });
    }
  } catch { /* queued_phases is a non-critical enhancement */ }

  // Read manager flags from config
  const managerConfig = (config as Record<string, unknown>).manager as Record<string, Record<string, string>> | undefined;
  const sanitizeFlags = (raw: unknown): string => {
    const val = typeof raw === 'string' ? raw : '';
    if (!val) return '';
    const tokens = val.split(/\s+/).filter(Boolean);
    const safe = tokens.every(t => /^--[a-zA-Z0-9][-a-zA-Z0-9]*$/.test(t) || /^[a-zA-Z0-9][-a-zA-Z0-9_.]*$/.test(t));
    return safe ? val : '';
  };
  const managerFlags = {
    discuss: sanitizeFlags(managerConfig?.flags?.discuss),
    plan: sanitizeFlags(managerConfig?.flags?.plan),
    execute: sanitizeFlags(managerConfig?.flags?.execute),
  };

  const result: Record<string, unknown> = {
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    phases,
    phase_count: phases.length,
    completed_count: completedCount,
    in_progress_count: phases.filter(p => ['partial', 'planned', 'discussed', 'researched'].includes(p.disk_status as string)).length,
    recommended_actions: recommendedActions,
    waiting_signal: waitingSignal,
    all_complete: completedCount === phases.length && phases.length > 0,
    queued_phases: queuedPhases,
    queued_milestone_version: queuedMilestoneVersion,
    queued_milestone_name: queuedMilestoneName,
    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    roadmap_exists: true,
    state_exists: true,
    manager_flags: managerFlags,
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};
