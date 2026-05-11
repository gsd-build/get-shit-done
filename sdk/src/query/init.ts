/**
 * Init composition handlers — compound init commands for workflow bootstrapping.
 *
 * Composes existing atomic SDK queries into the same flat JSON bundles
 * that CJS init.cjs produces, enabling workflow migration. Each handler
 * follows the QueryHandler signature and returns { data: <flat JSON> }.
 *
 * Port of get-shit-done/bin/lib/init.cjs (13 of 16 handlers).
 * The 3 complex handlers (new-project, progress, manager) are in init-complex.ts.
 *
 * @example
 * ```typescript
 * import { initExecutePhase, withProjectRoot } from './init.js';
 *
 * const result = await initExecutePhase(['9'], '/project');
 * // { data: { executor_model: 'opus', phase_found: true, ... } }
 * ```
 */

import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, basename } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

import { loadConfig, type GSDConfig } from '../config.js';
import { resolveModel, MODEL_PROFILES } from './config-query.js';
import { maskIfSecret } from './secrets.js';
import { findPhase } from './phase.js';
import { roadmapGetPhase, getMilestoneInfo, extractCurrentMilestone, extractPhasesFromSection } from './roadmap.js';
import { planningPaths, normalizePhaseName, toPosixPath, resolveAgentsDir, detectRuntime } from './helpers.js';
import { generatePhaseSlug, assertSafeProjectCode } from './phase-lifecycle-policy.js';
import type { QueryHandler } from './utils.js';

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * Extract model alias string from a resolveModel result.
 */
async function getModelAlias(agentType: string, projectDir: string): Promise<string> {
  const result = await resolveModel([agentType], projectDir);
  const data = result.data as Record<string, unknown>;
  return (data.model as string) || 'sonnet';
}

/**
 * Generate a slug from text (inline, matches CJS generateSlugInternal).
 */
function generateSlugInternal(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/**
 * Check if a path exists on disk.
 */
function pathExists(base: string, relPath: string): boolean {
  return existsSync(join(base, relPath));
}

/**
 * Compute the canonical phase directory name for a known phase entry from the
 * roadmap when no directory exists yet.  Applies the project_code prefix so
 * the first-touch creation path used by /gsd-discuss-phase and /gsd-plan-phase
 * stays consistent with the prefix produced by `phase.add` / `phase.insert`.
 *
 * Returns null when phaseNumber or phaseName cannot be determined.
 */
function computeExpectedPhaseDirName(
  phaseNumber: string | null,
  phaseName: string | null,
  projectCode: string,
): string | null {
  if (!phaseNumber || !phaseName) return null;
  const paddedNum = normalizePhaseName(phaseNumber);
  const slug = generatePhaseSlug(phaseName);
  if (!slug) return null;
  const prefix = projectCode ? `${projectCode}-` : '';
  return `${prefix}${paddedNum}-${slug}`;
}

/**
 * Get the latest completed milestone from MILESTONES.md.
 * Port of getLatestCompletedMilestone from init.cjs lines 10-25.
 */
function getLatestCompletedMilestone(projectDir: string): { version: string; name: string } | null {
  const milestonesPath = join(projectDir, '.planning', 'MILESTONES.md');
  if (!existsSync(milestonesPath)) return null;

  try {
    const content = readFileSync(milestonesPath, 'utf-8');
    const match = content.match(/^##\s+(v[\d.]+)\s+(.+?)\s+\(Shipped:/m);
    if (!match) return null;
    return { version: match[1], name: match[2].trim() };
  } catch {
    return null;
  }
}

/**
 * Check which GSD agents are installed on disk.
 *
 * Runtime-aware per issue #2402: detects the invoking runtime
 * (`GSD_RUNTIME` → `config.runtime` → 'claude') and probes that runtime's
 * canonical `agents/` directory. `GSD_AGENTS_DIR` still short-circuits.
 *
 * Port of checkAgentsInstalled from core.cjs lines 1274-1306.
 */
function checkAgentsInstalled(config?: { runtime?: unknown }): { agents_installed: boolean; missing_agents: string[] } {
  const runtime = detectRuntime(config);
  const agentsDir = resolveAgentsDir(runtime);
  const expectedAgents = Object.keys(MODEL_PROFILES);

  if (!existsSync(agentsDir)) {
    return { agents_installed: false, missing_agents: expectedAgents };
  }

  const missing: string[] = [];
  for (const agent of expectedAgents) {
    const agentFile = join(agentsDir, `${agent}.md`);
    const agentFileCopilot = join(agentsDir, `${agent}.agent.md`);
    if (!existsSync(agentFile) && !existsSync(agentFileCopilot)) {
      missing.push(agent);
    }
  }

  return {
    agents_installed: missing.length === 0,
    missing_agents: missing,
  };
}

/**
 * Extract phase info from findPhase result, or build fallback from roadmap.
 */
async function getPhaseInfoWithFallback(
  phase: string,
  projectDir: string,
  workstream?: string,
): Promise<{ phaseInfo: Record<string, unknown> | null; roadmapPhase: Record<string, unknown> | null }> {
  const phaseResult = await findPhase([phase], projectDir, workstream);
  let phaseInfo = phaseResult.data as Record<string, unknown> | null;
  // findPhase returns { found: false } when missing; findPhaseInternal returns null — align for init parity.
  if (phaseInfo && phaseInfo.found === false) {
    phaseInfo = null;
  }

  const roadmapResult = await roadmapGetPhase([phase], projectDir, workstream);
  const roadmapPhase = roadmapResult.data as Record<string, unknown> | null;

  // Match init.cjs: drop archived disk match when the phase is listed in the current ROADMAP
  if (phaseInfo?.archived && roadmapPhase?.found) {
    phaseInfo = null;
  }

  // Fallback to ROADMAP.md if no phase directory exists yet
  if ((!phaseInfo || !phaseInfo.found) && roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name as string;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? generateSlugInternal(phaseName) : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
      has_reviews: false,
    };
  }

  return { phaseInfo, roadmapPhase };
}

/**
 * Phase resolution for `init verify-work` — matches init.cjs cmdInitVerifyWork (archived + fallback).
 */
async function getPhaseInfoForVerifyWork(
  phase: string,
  projectDir: string,
  workstream?: string,
): Promise<{ phaseInfo: Record<string, unknown> | null }> {
  const phaseResult = await findPhase([phase], projectDir, workstream);
  let phaseInfo = phaseResult.data as Record<string, unknown> | null;
  if (phaseInfo && phaseInfo.found === false) {
    phaseInfo = null;
  }

  const roadmapResult = await roadmapGetPhase([phase], projectDir, workstream);
  const roadmapPhase = roadmapResult.data as Record<string, unknown> | null;

  if (phaseInfo?.archived && roadmapPhase?.found) {
    phaseInfo = null;
  }

  if (!phaseInfo && roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name as string;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? generateSlugInternal(phaseName) : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
    };
  }

  return { phaseInfo };
}

/**
 * Extract requirement IDs from roadmap section text.
 */
function extractReqIds(roadmapPhase: Record<string, unknown> | null): string | null {
  const section = roadmapPhase?.section as string | undefined;
  // Accept all bold/colon variants of the Requirements header. The forms
  //   **Requirements:**  (colon inside bold)
  //   **Requirements**:  (colon outside bold)
  //   **Requirements** : (space before outside colon)
  // render identically in markdown but differ textually. Issue #2769.
  const reqMatch = section?.match(/^\*\*Requirements:?\*\*[^\S\n]*:?[^\S\n]*([^\n]*)$/m);
  const reqExtracted = reqMatch
    ? reqMatch[1].replace(/[\[\]]/g, '').split(',').map((s: string) => s.trim()).filter(Boolean).join(', ')
    : null;
  return (reqExtracted && reqExtracted !== 'TBD') ? reqExtracted : null;
}

// ─── withProjectRoot ─────────────────────────────────────────────────────

/**
 * Inject project_root, agents_installed, missing_agents, and response_language
 * into an init result object.
 *
 * Port of withProjectRoot from init.cjs lines 32-63.
 *
 * @param projectDir - Absolute project root path
 * @param result - The result object to augment
 * @param config - Optional loaded config (avoids re-reading config.json)
 * @returns The augmented result object
 */
export function withProjectRoot(
  projectDir: string,
  result: Record<string, unknown>,
  config?: Record<string, unknown>,
): Record<string, unknown> {
  result.project_root = projectDir;

  const agentStatus = checkAgentsInstalled(config);
  result.agents_installed = agentStatus.agents_installed;
  result.missing_agents = agentStatus.missing_agents;

  const responseLang = config?.response_language;
  if (responseLang) {
    result.response_language = responseLang;
  }

  const projectCode = config?.project_code;
  if (projectCode) {
    result.project_code = projectCode;
  }

  const projectMdPath = join(projectDir, '.planning', 'PROJECT.md');
  try {
    if (existsSync(projectMdPath)) {
      const content = readFileSync(projectMdPath, 'utf-8');
      const h1Match = content.match(/^#\s+(.+)$/m);
      if (h1Match) {
        result.project_title = h1Match[1].trim();
      }
    }
  } catch {
    /* intentionally empty */
  }

  return result;
}

// ─── initExecutePhase ─────────────────────────────────────────────────────

/**
 * Init handler for execute-phase workflow.
 * Port of cmdInitExecutePhase from init.cjs lines 50-171.
 */
export const initExecutePhase: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    return { data: { error: 'phase required for init execute-phase' } };
  }

  const config = await loadConfig(projectDir);
  const paths = planningPaths(projectDir, workstream);
  const planningDir = paths.planning;

  const { phaseInfo, roadmapPhase } = await getPhaseInfoWithFallback(phase, projectDir, workstream);
  const phase_req_ids = extractReqIds(roadmapPhase);

  const configExists = existsSync(join(planningDir, 'config.json'));
  const [executorModel, verifierModel] = configExists
    ? await Promise.all([
        getModelAlias('gsd-executor', projectDir),
        getModelAlias('gsd-verifier', projectDir),
      ])
    : ['', ''];

  const milestone = await getMilestoneInfo(projectDir, workstream);

  const phaseNumber = (phaseInfo?.phase_number as string) || null;
  const phaseSlug = (phaseInfo?.phase_slug as string) || null;
  const plans = (phaseInfo?.plans || []) as string[];
  const summaries = (phaseInfo?.summaries || []) as string[];
  const incompletePlans = (phaseInfo?.incomplete_plans || []) as string[];
  const projectCode = (config as Record<string, unknown>).project_code as string || '';

  const result: Record<string, unknown> = {
    executor_model: executorModel,
    verifier_model: verifierModel,
    tdd_mode: config.workflow.tdd_mode ?? false,
    commit_docs: config.commit_docs,
    sub_repos: (config as Record<string, unknown>).sub_repos ?? [],
    parallelization: config.parallelization,
    context_window: (config as Record<string, unknown>).context_window ?? 200000,
    branching_strategy: config.git.branching_strategy,
    phase_branch_template: config.git.phase_branch_template,
    milestone_branch_template: config.git.milestone_branch_template,
    verifier_enabled: config.workflow.verifier,
    phase_found: !!phaseInfo,
    phase_dir: (phaseInfo?.directory as string) ?? null,
    phase_number: phaseNumber,
    phase_name: (phaseInfo?.phase_name as string) ?? null,
    phase_slug: phaseSlug,
    phase_req_ids,
    plans,
    summaries,
    incomplete_plans: incompletePlans,
    plan_count: plans.length,
    incomplete_count: incompletePlans.length,
    branch_name: config.git.branching_strategy === 'phase' && phaseInfo
      ? config.git.phase_branch_template
          .replace('{project}', projectCode)
          .replace('{phase}', phaseNumber || '')
          .replace('{slug}', phaseSlug || 'phase')
      : config.git.branching_strategy === 'milestone'
        ? config.git.milestone_branch_template
            .replace('{milestone}', milestone.version)
            .replace('{slug}', generateSlugInternal(milestone.name) || 'milestone')
        : null,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    state_exists: existsSync(join(planningDir, 'STATE.md')),
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    config_exists: configExists,
    state_path: toPosixPath(relative(projectDir, join(planningDir, 'STATE.md'))),
    roadmap_path: toPosixPath(relative(projectDir, join(planningDir, 'ROADMAP.md'))),
    config_path: toPosixPath(relative(projectDir, join(planningDir, 'config.json'))),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initPlanPhase ────────────────────────────────────────────────────────

/**
 * Init handler for plan-phase workflow.
 * Port of cmdInitPlanPhase from init.cjs lines 173-293.
 */
export const initPlanPhase: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    return { data: { error: 'phase required for init plan-phase' } };
  }

  const config = await loadConfig(projectDir);
  const paths = planningPaths(projectDir, workstream);
  const planningDir = paths.planning;

  const { phaseInfo, roadmapPhase } = await getPhaseInfoWithFallback(phase, projectDir, workstream);
  const phase_req_ids = extractReqIds(roadmapPhase);

  const configExists = existsSync(join(planningDir, 'config.json'));
  const [researcherModel, plannerModel, checkerModel] = configExists
    ? await Promise.all([
        getModelAlias('gsd-phase-researcher', projectDir),
        getModelAlias('gsd-planner', projectDir),
        getModelAlias('gsd-plan-checker', projectDir),
      ])
    : ['', '', ''];

  const phaseNumber = (phaseInfo?.phase_number as string) || null;
  const phaseName = (phaseInfo?.phase_name as string) ?? null;
  const phaseDir = (phaseInfo?.directory as string) ?? null;
  const plans = (phaseInfo?.plans || []) as string[];

  // #3287: compute the canonical directory name with project_code prefix so
  // the first-touch mkdir in /gsd-plan-phase stays consistent with phase.add.
  const rawProjectCode = (config as Record<string, unknown>).project_code as string || '';
  assertSafeProjectCode(rawProjectCode);
  const expectedPhaseDirName = phaseDir
    ? null // directory already exists — no need to create
    : computeExpectedPhaseDirName(phaseNumber, phaseName, rawProjectCode);
  const expectedPhaseDir = expectedPhaseDirName
    ? toPosixPath(relative(projectDir, join(paths.phases, expectedPhaseDirName)))
    : null;

  const cfg = config as GSDConfig;
  const result: Record<string, unknown> = {
    researcher_model: researcherModel,
    planner_model: plannerModel,
    checker_model: checkerModel,
    tdd_mode: config.workflow.tdd_mode ?? false,
    research_enabled: config.workflow.research,
    plan_checker_enabled: config.workflow.plan_check,
    nyquist_validation_enabled: config.workflow.nyquist_validation,
    commit_docs: config.commit_docs,
    text_mode: config.workflow.text_mode,
    auto_advance: !!config.workflow.auto_advance,
    auto_chain_active: !!config.workflow._auto_chain_active,
    mode: cfg.mode ?? 'interactive',
    phase_found: !!phaseInfo,
    phase_dir: phaseDir,
    expected_phase_dir: expectedPhaseDir,
    phase_number: phaseNumber,
    phase_name: phaseName,
    phase_slug: (phaseInfo?.phase_slug as string) ?? null,
    padded_phase: phaseNumber ? normalizePhaseName(phaseNumber) : null,
    phase_req_ids,
    has_research: (phaseInfo?.has_research as boolean) || false,
    has_context: (phaseInfo?.has_context as boolean) || false,
    has_reviews: (phaseInfo?.has_reviews as boolean) || false,
    has_plans: plans.length > 0,
    plan_count: plans.length,
    planning_exists: existsSync(planningDir),
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    state_path: toPosixPath(relative(projectDir, join(planningDir, 'STATE.md'))),
    roadmap_path: toPosixPath(relative(projectDir, join(planningDir, 'ROADMAP.md'))),
    requirements_path: toPosixPath(relative(projectDir, join(planningDir, 'REQUIREMENTS.md'))),
    patterns_path: null,
  };

  // Add artifact paths if phase directory exists
  if (phaseDir) {
    const phaseDirFull = join(projectDir, phaseDir);
    try {
      const files = readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) result.context_path = toPosixPath(join(phaseDir, contextFile));
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) result.research_path = toPosixPath(join(phaseDir, researchFile));
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) result.verification_path = toPosixPath(join(phaseDir, verificationFile));
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) result.uat_path = toPosixPath(join(phaseDir, uatFile));
      const reviewsFile = files.find(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md');
      if (reviewsFile) result.reviews_path = toPosixPath(join(phaseDir, reviewsFile));
      const patternsFile = files.find(f => f.endsWith('-PATTERNS.md') || f === 'PATTERNS.md');
      if (patternsFile) result.patterns_path = toPosixPath(join(phaseDir, patternsFile));
    } catch { /* intentionally empty */ }
  }

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initNewMilestone ─────────────────────────────────────────────────────

/**
 * Init handler for new-milestone workflow.
 * Port of cmdInitNewMilestone from init.cjs lines 401-446.
 */
export const initNewMilestone: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const planningDir = join(projectDir, '.planning');
  const milestone = await getMilestoneInfo(projectDir);
  const latestCompleted = getLatestCompletedMilestone(projectDir);

  const phasesDir = join(planningDir, 'phases');
  let phaseDirCount = 0;
  try {
    if (existsSync(phasesDir)) {
      phaseDirCount = readdirSync(phasesDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .length;
    }
  } catch { /* intentionally empty */ }

  const [researcherModel, synthesizerModel, roadmapperModel] = await Promise.all([
    getModelAlias('gsd-project-researcher', projectDir),
    getModelAlias('gsd-research-synthesizer', projectDir),
    getModelAlias('gsd-roadmapper', projectDir),
  ]);

  const result: Record<string, unknown> = {
    researcher_model: researcherModel,
    synthesizer_model: synthesizerModel,
    roadmapper_model: roadmapperModel,
    commit_docs: config.commit_docs,
    research_enabled: config.workflow.research,
    current_milestone: milestone.version,
    current_milestone_name: milestone.name,
    latest_completed_milestone: latestCompleted?.version || null,
    latest_completed_milestone_name: latestCompleted?.name || null,
    phase_dir_count: phaseDirCount,
    phase_archive_path: latestCompleted
      ? toPosixPath(relative(projectDir, join(projectDir, '.planning', 'milestones', `${latestCompleted.version}-phases`)))
      : null,
    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    state_exists: existsSync(join(planningDir, 'STATE.md')),
    project_path: '.planning/PROJECT.md',
    roadmap_path: toPosixPath(relative(projectDir, join(planningDir, 'ROADMAP.md'))),
    state_path: toPosixPath(relative(projectDir, join(planningDir, 'STATE.md'))),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initQuick ────────────────────────────────────────────────────────────

/**
 * Init handler for quick workflow.
 * Port of cmdInitQuick from init.cjs lines 448-504.
 */
export const initQuick: QueryHandler = async (args, projectDir) => {
  const description = args[0] || null;
  const config = await loadConfig(projectDir);
  const planningDir = join(projectDir, '.planning');
  const now = new Date();
  const slug = description ? generateSlugInternal(description).substring(0, 40) : null;

  // Generate collision-resistant quick task ID: YYMMDD-xxx
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = yy + mm + dd;
  const secondsSinceMidnight = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const timeBlocks = Math.floor(secondsSinceMidnight / 2);
  const timeEncoded = timeBlocks.toString(36).padStart(3, '0');
  const quickId = dateStr + '-' + timeEncoded;
  const branchSlug = slug || 'quick';
  const quickBranchName = config.git.quick_branch_template
    ? config.git.quick_branch_template
        .replace('{num}', quickId)
        .replace('{quick}', quickId)
        .replace('{slug}', branchSlug)
    : null;

  const configExists = existsSync(join(planningDir, 'config.json'));
  const [plannerModel, executorModel, checkerModel, verifierModel] = configExists
    ? await Promise.all([
        getModelAlias('gsd-planner', projectDir),
        getModelAlias('gsd-executor', projectDir),
        getModelAlias('gsd-plan-checker', projectDir),
        getModelAlias('gsd-verifier', projectDir),
      ])
    : ['', '', '', ''];

  const result: Record<string, unknown> = {
    planner_model: plannerModel,
    executor_model: executorModel,
    checker_model: checkerModel,
    verifier_model: verifierModel,
    commit_docs: config.commit_docs,
    branch_name: quickBranchName,
    quick_id: quickId,
    slug,
    description,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    quick_dir: '.planning/quick',
    task_dir: slug ? `.planning/quick/${quickId}-${slug}` : null,
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    planning_exists: existsSync(join(projectDir, '.planning')),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initResume ───────────────────────────────────────────────────────────

/**
 * Init handler for resume-project workflow.
 * Port of cmdInitResume from init.cjs lines 506-536.
 */
export const initResume: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const planningDir = join(projectDir, '.planning');

  let interruptedAgentId: string | null = null;
  try {
    interruptedAgentId = readFileSync(join(projectDir, '.planning', 'current-agent-id.txt'), 'utf-8').trim();
  } catch { /* intentionally empty */ }

  const result: Record<string, unknown> = {
    state_exists: existsSync(join(planningDir, 'STATE.md')),
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    planning_exists: existsSync(join(projectDir, '.planning')),
    state_path: toPosixPath(relative(projectDir, join(planningDir, 'STATE.md'))),
    roadmap_path: toPosixPath(relative(projectDir, join(planningDir, 'ROADMAP.md'))),
    project_path: '.planning/PROJECT.md',
    has_interrupted_agent: !!interruptedAgentId,
    interrupted_agent_id: interruptedAgentId,
    commit_docs: config.commit_docs,
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initVerifyWork ───────────────────────────────────────────────────────

/**
 * Init handler for verify-work workflow.
 * Port of cmdInitVerifyWork from init.cjs lines 538-586.
 */
export const initVerifyWork: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    return { data: { error: 'phase required for init verify-work' } };
  }

  const config = await loadConfig(projectDir, workstream);
  const { phaseInfo } = await getPhaseInfoForVerifyWork(phase, projectDir, workstream);

  const configExists = existsSync(join(projectDir, '.planning', 'config.json'));
  const [plannerModel, checkerModel] = configExists
    ? await Promise.all([
        getModelAlias('gsd-planner', projectDir),
        getModelAlias('gsd-plan-checker', projectDir),
      ])
    : ['', ''];

  const result: Record<string, unknown> = {
    planner_model: plannerModel,
    checker_model: checkerModel,
    commit_docs: config.commit_docs,
    phase_found: !!phaseInfo,
    phase_dir: (phaseInfo?.directory as string) ?? null,
    phase_number: (phaseInfo?.phase_number as string) ?? null,
    phase_name: (phaseInfo?.phase_name as string) ?? null,
    has_verification: (phaseInfo?.has_verification as boolean) || false,
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initPhaseOp ──────────────────────────────────────────────────────────

/**
 * Init handler for discuss-phase and similar phase operations.
 * Port of cmdInitPhaseOp from init.cjs lines 588-697.
 */
export const initPhaseOp: QueryHandler = async (args, projectDir, workstream) => {
  const phase = args[0];
  if (!phase) {
    return { data: { error: 'phase required for init phase-op' } };
  }

  const config = await loadConfig(projectDir);
  const paths = planningPaths(projectDir, workstream);
  const planningDir = paths.planning;

  // findPhase with archived override: if only match is archived, prefer ROADMAP
  const phaseResult = await findPhase([phase], projectDir, workstream);
  let phaseInfo = phaseResult.data as Record<string, unknown> | null;

  const roadmapResult = await roadmapGetPhase([phase], projectDir, workstream);
  const roadmapPhase = roadmapResult.data as Record<string, unknown> | null;

  // If the only match comes from an archived milestone, prefer current ROADMAP
  if (phaseInfo?.archived && roadmapPhase?.found) {
    const phaseName = roadmapPhase.phase_name as string;
    phaseInfo = {
      found: true,
      directory: null,
      phase_number: roadmapPhase.phase_number,
      phase_name: phaseName,
      phase_slug: phaseName ? generateSlugInternal(phaseName) : null,
      plans: [],
      summaries: [],
      incomplete_plans: [],
      has_research: false,
      has_context: false,
      has_verification: false,
    };
  }

  // Fallback to ROADMAP.md if no directory exists
  if (!phaseInfo || !phaseInfo.found) {
    if (roadmapPhase?.found) {
      const phaseName = roadmapPhase.phase_name as string;
      phaseInfo = {
        found: true,
        directory: null,
        phase_number: roadmapPhase.phase_number,
        phase_name: phaseName,
        phase_slug: phaseName ? generateSlugInternal(phaseName) : null,
        plans: [],
        summaries: [],
        incomplete_plans: [],
        has_research: false,
        has_context: false,
        has_verification: false,
      };
    }
  }

  const phaseFound = !!(phaseInfo && phaseInfo.found);
  const phaseNumber = (phaseInfo?.phase_number as string) || null;
  const phaseName = (phaseInfo?.phase_name as string) ?? null;
  const phaseDir = (phaseInfo?.directory as string) ?? null;
  const plans = (phaseInfo?.plans || []) as string[];

  // #3287: compute the canonical directory name with project_code prefix so
  // the first-touch mkdir in /gsd-discuss-phase stays consistent with phase.add.
  const rawProjectCode = (config as Record<string, unknown>).project_code as string || '';
  assertSafeProjectCode(rawProjectCode);
  const expectedPhaseDirName = phaseDir
    ? null // directory already exists — no need to create
    : computeExpectedPhaseDirName(phaseNumber, phaseName, rawProjectCode);
  const expectedPhaseDir = expectedPhaseDirName
    ? toPosixPath(relative(projectDir, join(paths.phases, expectedPhaseDirName)))
    : null;

  const result: Record<string, unknown> = {
    commit_docs: config.commit_docs,
    // #2997: secret config keys (brave_search, firecrawl, exa_search) may be
    // either boolean availability flags OR string API keys depending on how the
    // user configured them. Pass booleans through; mask string values so the
    // init bundle never echoes plaintext credentials. Mirrors the masking added
    // to config-get/config-set in the same fix.
    brave_search: typeof config.brave_search === 'string' ? maskIfSecret('brave_search', config.brave_search) : config.brave_search,
    firecrawl: typeof config.firecrawl === 'string' ? maskIfSecret('firecrawl', config.firecrawl) : config.firecrawl,
    exa_search: typeof config.exa_search === 'string' ? maskIfSecret('exa_search', config.exa_search) : config.exa_search,
    phase_found: phaseFound,
    phase_dir: phaseDir,
    expected_phase_dir: expectedPhaseDir,
    phase_number: phaseNumber,
    phase_name: phaseName,
    phase_slug: (phaseInfo?.phase_slug as string) ?? null,
    padded_phase: phaseNumber ? normalizePhaseName(phaseNumber) : null,
    has_research: (phaseInfo?.has_research as boolean) || false,
    has_context: (phaseInfo?.has_context as boolean) || false,
    has_plans: plans.length > 0,
    has_verification: (phaseInfo?.has_verification as boolean) || false,
    has_reviews: (phaseInfo?.has_reviews as boolean) || false,
    plan_count: plans.length,
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    planning_exists: existsSync(planningDir),
    state_path: toPosixPath(relative(projectDir, join(planningDir, 'STATE.md'))),
    roadmap_path: toPosixPath(relative(projectDir, join(planningDir, 'ROADMAP.md'))),
    requirements_path: toPosixPath(relative(projectDir, join(planningDir, 'REQUIREMENTS.md'))),
  };

  // Add artifact paths if phase directory exists
  if (phaseDir) {
    const phaseDirFull = join(projectDir, phaseDir);
    try {
      const files = readdirSync(phaseDirFull);
      const contextFile = files.find(f => f.endsWith('-CONTEXT.md') || f === 'CONTEXT.md');
      if (contextFile) result.context_path = toPosixPath(join(phaseDir, contextFile));
      const researchFile = files.find(f => f.endsWith('-RESEARCH.md') || f === 'RESEARCH.md');
      if (researchFile) result.research_path = toPosixPath(join(phaseDir, researchFile));
      const verificationFile = files.find(f => f.endsWith('-VERIFICATION.md') || f === 'VERIFICATION.md');
      if (verificationFile) result.verification_path = toPosixPath(join(phaseDir, verificationFile));
      const uatFile = files.find(f => f.endsWith('-UAT.md') || f === 'UAT.md');
      if (uatFile) result.uat_path = toPosixPath(join(phaseDir, uatFile));
      const reviewsFile = files.find(f => f.endsWith('-REVIEWS.md') || f === 'REVIEWS.md');
      if (reviewsFile) result.reviews_path = toPosixPath(join(phaseDir, reviewsFile));
    } catch { /* intentionally empty */ }
  }

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initTodos ────────────────────────────────────────────────────────────

/**
 * Init handler for check-todos and add-todo workflows.
 * Port of cmdInitTodos from init.cjs lines 699-756.
 */
export const initTodos: QueryHandler = async (args, projectDir) => {
  const area = args[0] || null;
  const config = await loadConfig(projectDir);
  const planningDir = join(projectDir, '.planning');
  const now = new Date();

  const pendingDir = join(planningDir, 'todos', 'pending');
  let count = 0;
  const todos: Array<Record<string, unknown>> = [];

  try {
    const files = readdirSync(pendingDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      try {
        const content = readFileSync(join(pendingDir, file), 'utf-8');
        const createdMatch = content.match(/^created:\s*(.+)$/m);
        const titleMatch = content.match(/^title:\s*(.+)$/m);
        const areaMatch = content.match(/^area:\s*(.+)$/m);
        const todoArea = areaMatch ? areaMatch[1].trim() : 'general';

        if (area && todoArea !== area) continue;

        count++;
        todos.push({
          file,
          created: createdMatch ? createdMatch[1].trim() : 'unknown',
          title: titleMatch ? titleMatch[1].trim() : 'Untitled',
          area: todoArea,
          path: toPosixPath(relative(projectDir, join(pendingDir, file))),
        });
      } catch { /* intentionally empty */ }
    }
  } catch { /* intentionally empty */ }

  const result: Record<string, unknown> = {
    commit_docs: config.commit_docs,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    todo_count: count,
    todos,
    area_filter: area,
    pending_dir: toPosixPath(relative(projectDir, join(planningDir, 'todos', 'pending'))),
    completed_dir: toPosixPath(relative(projectDir, join(planningDir, 'todos', 'completed'))),
    planning_exists: existsSync(planningDir),
    todos_dir_exists: existsSync(join(planningDir, 'todos')),
    pending_dir_exists: existsSync(pendingDir),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initMilestoneOp ─────────────────────────────────────────────────────

/**
 * Init handler for complete-milestone and audit-milestone workflows.
 * Port of cmdInitMilestoneOp from init.cjs lines 758-817.
 */
export const initMilestoneOp: QueryHandler = async (_args, projectDir, workstream) => {
  const config = await loadConfig(projectDir);
  const paths = planningPaths(projectDir, workstream);
  const planningDir = paths.planning;
  const milestone = await getMilestoneInfo(projectDir, workstream);

  const phasesDir = join(planningDir, 'phases');
  let phaseCount = 0;
  let completedPhases = 0;

  // Bug #2633 — ROADMAP.md (current milestone section) is the authority for
  // phase counts, NOT the on-disk `.planning/phases/` directory. After
  // `phases clear` between milestones, on-disk dirs will be a subset of the
  // roadmap until each phase is materialized, and reading from disk causes
  // `all_phases_complete: true` to fire as soon as the materialized subset
  // gets summaries — even though the roadmap has phases still to do.
  let roadmapPhaseNumbers: string[] = [];
  try {
    const { readFile } = await import('node:fs/promises');
    const roadmapRaw = await readFile(join(planningDir, 'ROADMAP.md'), 'utf-8');
    const currentSection = await extractCurrentMilestone(roadmapRaw, projectDir, workstream);
    roadmapPhaseNumbers = extractPhasesFromSection(currentSection).map(p => p.number);
  } catch { /* intentionally empty */ }

  // Build the on-disk index keyed by the canonical full phase token (e.g.
  // "3", "3A", "3.1") so distinct tokens with the same integer prefix never
  // collide. Roadmap writes "Phase 3", "Phase 3A", and "Phase 3.1" as
  // distinct phases and disk dirs preserve those tokens.
  // Canonicalize a phase token by stripping leading zeros from the integer
  // head while preserving any [A-Z]? suffix and dotted segments. So "03" →
  // "3", "03A" → "3A", "03.1" → "3.1", "3A" → "3A". This lets disk dirs that
  // pad ("03-alpha") match roadmap tokens ("Phase 3") without ever collapsing
  // distinct tokens like "3" / "3A" / "3.1" into the same bucket.
  const canonicalizePhase = (tok: string): string => {
    const m = tok.match(/^(\d+)([A-Z]?(?:\.\d+)*)$/);
    return m ? String(parseInt(m[1], 10)) + m[2] : tok;
  };
  const diskPhaseDirs: Map<string, string> = new Map();
  try {
    const entries = readdirSync(phasesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const m = e.name.match(/^(\d+[A-Z]?(?:\.\d+)*)/);
      if (!m) continue;
      diskPhaseDirs.set(canonicalizePhase(m[1]), e.name);
    }
  } catch { /* intentionally empty */ }

  if (roadmapPhaseNumbers.length > 0) {
    phaseCount = roadmapPhaseNumbers.length;
    for (const num of roadmapPhaseNumbers) {
      const dirName = diskPhaseDirs.get(canonicalizePhase(num));
      if (!dirName) continue;
      try {
        const phaseFiles = readdirSync(join(phasesDir, dirName));
        const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
        if (hasSummary) completedPhases++;
      } catch { /* intentionally empty */ }
    }
  } else {
    // Fallback: no parseable ROADMAP (e.g. brand-new project). Preserve the
    // legacy on-disk-count behavior so existing no-roadmap tests still pass.
    try {
      const entries = readdirSync(phasesDir, { withFileTypes: true });
      const dirs = entries.filter(e => e.isDirectory()).map(e => e.name);
      phaseCount = dirs.length;
      for (const dir of dirs) {
        try {
          const phaseFiles = readdirSync(join(phasesDir, dir));
          const hasSummary = phaseFiles.some(f => f.endsWith('-SUMMARY.md') || f === 'SUMMARY.md');
          if (hasSummary) completedPhases++;
        } catch { /* intentionally empty */ }
      }
    } catch { /* intentionally empty */ }
  }

  const archiveDir = join(planningDir, 'archive');
  let archivedMilestones: string[] = [];
  try {
    archivedMilestones = readdirSync(archiveDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { /* intentionally empty */ }

  const result: Record<string, unknown> = {
    commit_docs: config.commit_docs,
    milestone_version: milestone.version,
    milestone_name: milestone.name,
    milestone_slug: generateSlugInternal(milestone.name),
    phase_count: phaseCount,
    completed_phases: completedPhases,
    all_phases_complete: phaseCount > 0 && phaseCount === completedPhases,
    archived_milestones: archivedMilestones,
    archive_count: archivedMilestones.length,
    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    roadmap_exists: existsSync(join(planningDir, 'ROADMAP.md')),
    state_exists: existsSync(join(planningDir, 'STATE.md')),
    archive_exists: existsSync(archiveDir),
    phases_dir_exists: existsSync(phasesDir),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initMapCodebase ──────────────────────────────────────────────────────

/**
 * Init handler for map-codebase workflow.
 * Port of cmdInitMapCodebase from init.cjs lines 819-852.
 */
export const initMapCodebase: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const now = new Date();
  const codebaseDir = join(projectDir, '.planning', 'codebase');
  let existingMaps: string[] = [];
  try {
    existingMaps = readdirSync(codebaseDir).filter(f => f.endsWith('.md'));
  } catch { /* intentionally empty */ }

  const mapperModel = await getModelAlias('gsd-codebase-mapper', projectDir);

  const result: Record<string, unknown> = {
    mapper_model: mapperModel,
    commit_docs: config.commit_docs,
    search_gitignored: config.search_gitignored,
    parallelization: config.parallelization,
    subagent_timeout: (config as Record<string, unknown>).subagent_timeout ?? undefined,
    date: now.toISOString().split('T')[0],
    timestamp: now.toISOString(),
    codebase_dir: '.planning/codebase',
    existing_maps: existingMaps,
    has_maps: existingMaps.length > 0,
    planning_exists: pathExists(projectDir, '.planning'),
    codebase_dir_exists: pathExists(projectDir, '.planning/codebase'),
  };

  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};

// ─── initNewWorkspace ─────────────────────────────────────────────────────

/**
 * Init handler for new-workspace workflow.
 * Port of cmdInitNewWorkspace from init.cjs lines 1311-1335.
 * T-14-01: Validates workspace name rejects path separators.
 */
export const initNewWorkspace: QueryHandler = async (_args, projectDir) => {
  const home = process.env.HOME || homedir();
  const defaultBase = join(home, 'gsd-workspaces');

  // Detect child git repos (one level deep)
  const childRepos: Array<{ name: string; path: string; has_uncommitted: boolean }> = [];
  try {
    const entries = readdirSync(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const fullPath = join(projectDir, entry.name);
      if (existsSync(join(fullPath, '.git'))) {
        let hasUncommitted = false;
        try {
          const status = execSync('git status --porcelain', { cwd: fullPath, encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
          hasUncommitted = status.trim().length > 0;
        } catch { /* best-effort */ }
        childRepos.push({ name: entry.name, path: fullPath, has_uncommitted: hasUncommitted });
      }
    }
  } catch { /* intentionally empty */ }

  let worktreeAvailable = false;
  try {
    execSync('git --version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
    worktreeAvailable = true;
  } catch { /* no git */ }

  const result: Record<string, unknown> = {
    default_workspace_base: defaultBase,
    child_repos: childRepos,
    child_repo_count: childRepos.length,
    worktree_available: worktreeAvailable,
    is_git_repo: pathExists(projectDir, '.git'),
    cwd_repo_name: basename(projectDir),
  };

  return { data: withProjectRoot(projectDir, result) };
};

// ─── initListWorkspaces ───────────────────────────────────────────────────

/**
 * Init handler for list-workspaces workflow.
 * Port of cmdInitListWorkspaces from init.cjs lines 1337-1381.
 */
export const initListWorkspaces: QueryHandler = async (_args, _projectDir) => {
  const home = process.env.HOME || homedir();
  const defaultBase = join(home, 'gsd-workspaces');

  const workspaces: Array<Record<string, unknown>> = [];
  if (existsSync(defaultBase)) {
    let entries: Dirent[] = [];
    try {
      entries = readdirSync(defaultBase, { withFileTypes: true });
    } catch { entries = []; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const wsPath = join(defaultBase, String(entry.name));
      const manifestPath = join(wsPath, 'WORKSPACE.md');
      if (!existsSync(manifestPath)) continue;

      let repoCount = 0;
      let strategy = 'unknown';
      try {
        const manifest = readFileSync(manifestPath, 'utf8');
        const strategyMatch = manifest.match(/^Strategy:\s*(.+)$/m);
        if (strategyMatch) strategy = strategyMatch[1].trim();
        const tableRows = manifest.split('\n').filter(l => l.match(/^\|\s*\w/) && !l.includes('Repo') && !l.includes('---'));
        repoCount = tableRows.length;
      } catch { /* best-effort */ }
      const hasProject = existsSync(join(wsPath, '.planning', 'PROJECT.md'));

      workspaces.push({
        name: entry.name,
        path: wsPath,
        repo_count: repoCount,
        strategy,
        has_project: hasProject,
      });
    }
  }

  const result: Record<string, unknown> = {
    workspace_base: defaultBase,
    workspaces,
    workspace_count: workspaces.length,
  };

  return { data: result };
};

// ─── initRemoveWorkspace ──────────────────────────────────────────────────

/**
 * Init handler for remove-workspace workflow.
 * Port of cmdInitRemoveWorkspace from init.cjs lines 1383-1443.
 * T-14-01: Validates workspace name rejects path separators and '..' sequences.
 */
export const initRemoveWorkspace: QueryHandler = async (args, _projectDir) => {
  const name = args[0];
  if (!name) {
    return { data: { error: 'workspace name required for init remove-workspace' } };
  }

  // T-14-01: Reject path traversal attempts
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { data: { error: `Invalid workspace name: ${name} (path separators not allowed)` } };
  }

  const home = process.env.HOME || homedir();
  const defaultBase = join(home, 'gsd-workspaces');
  const wsPath = join(defaultBase, name);
  const manifestPath = join(wsPath, 'WORKSPACE.md');

  if (!existsSync(wsPath)) {
    return { data: { error: `Workspace not found: ${wsPath}` } };
  }

  const repos: Array<Record<string, unknown>> = [];
  let strategy = 'unknown';
  if (existsSync(manifestPath)) {
    try {
      const manifest = readFileSync(manifestPath, 'utf8');
      const strategyMatch = manifest.match(/^Strategy:\s*(.+)$/m);
      if (strategyMatch) strategy = strategyMatch[1].trim();

      const lines = manifest.split('\n');
      for (const line of lines) {
        const match = line.match(/^\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|\s*(\S+)\s*\|$/);
        if (match && match[1] !== 'Repo' && !match[1].includes('---')) {
          repos.push({ name: match[1], source: match[2], branch: match[3], strategy: match[4] });
        }
      }
    } catch { /* best-effort */ }
  }

  // Check for uncommitted changes in workspace repos
  const dirtyRepos: string[] = [];
  for (const repo of repos) {
    const repoPath = join(wsPath, repo.name as string);
    if (!existsSync(repoPath)) continue;
    try {
      const status = execSync('git status --porcelain', { cwd: repoPath, encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
      if (status.trim().length > 0) {
        dirtyRepos.push(repo.name as string);
      }
    } catch { /* best-effort */ }
  }

  const result: Record<string, unknown> = {
    workspace_name: name,
    workspace_path: wsPath,
    has_manifest: existsSync(manifestPath),
    strategy,
    repos,
    repo_count: repos.length,
    dirty_repos: dirtyRepos,
    has_dirty_repos: dirtyRepos.length > 0,
  };

  return { data: result };
};
// ─── initIngestDocs ───────────────────────────────────────────────────────

/**
 * Init handler for ingest-docs workflow.
 * Mirrors `initResume` shape but without current-agent-id lookup — the
 * ingest-docs workflow reads `project_exists`, `planning_exists`, `has_git`,
 * and `project_path` to branch between new-project vs merge-milestone modes.
 */
export const initIngestDocs: QueryHandler = async (_args, projectDir) => {
  const config = await loadConfig(projectDir);
  const result: Record<string, unknown> = {
    project_exists: pathExists(projectDir, '.planning/PROJECT.md'),
    planning_exists: pathExists(projectDir, '.planning'),
    has_git: pathExists(projectDir, '.git'),
    project_path: '.planning/PROJECT.md',
    commit_docs: config.commit_docs,
  };
  return { data: withProjectRoot(projectDir, result, config as Record<string, unknown>) };
};
