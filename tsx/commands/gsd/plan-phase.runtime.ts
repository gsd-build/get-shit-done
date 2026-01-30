/**
 * plan-phase.runtime.ts - Runtime functions for plan-phase command
 *
 * These functions handle file I/O, context assembly, prompt building,
 * and summary generation. Uses shared TS helpers from tsx/helpers/.
 *
 * Design: Maximize runtime logic (TypeScript over Markdown)
 * - File I/O, parsing → runtime
 * - Path resolution, context assembly → runtime
 * - Model lookup, summary generation → runtime
 * - Agent prompts, banners → TSX (markdown)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Import shared GSD helpers
import {
  // Config
  readConfig,
  getModelProfile,
  getWorkflowSettings,
  type GsdConfig,
  // Environment
  planningExists,
  // Phase operations
  normalizePhaseNumber,
  buildPhaseSlug,
  // File discovery
  findPhaseDirectory,
  listPlanFiles,
  findResearchFile,
  findContextFile,
  readFileContent,
  readStateFile,
  readRoadmapFile,
  // Frontmatter
  parsePlanFrontmatter,
} from '../../helpers/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PlanPhaseFlags {
  research: boolean;      // --research: force re-research
  skipResearch: boolean;  // --skip-research: skip research entirely
  gaps: boolean;          // --gaps: gap closure mode
  skipVerify: boolean;    // --skip-verify: skip verification loop
}

export interface ModelConfig {
  researcher: 'opus' | 'sonnet' | 'haiku';
  planner: 'opus' | 'sonnet' | 'haiku';
  checker: 'opus' | 'sonnet' | 'haiku';
}

export interface PlanPhaseContext {
  error?: string;
  phaseId: string;           // Normalized phase (e.g., "08", "02.1")
  phaseName: string;         // Phase name from roadmap
  phaseDescription: string;  // Full description
  phaseDir: string;          // Path to phase directory
  hasResearch: boolean;      // RESEARCH.md exists
  hasPlans: boolean;         // PLAN.md files exist
  planCount: number;         // Number of existing plans
  planFiles: string[];       // List of plan file paths
  needsResearch: boolean;    // Should spawn researcher
  flags: PlanPhaseFlags;
  models: ModelConfig;
  modelProfile: string;      // 'quality' | 'balanced' | 'budget'
  config: {
    workflowResearch: boolean;
    workflowPlanCheck: boolean;
  };
  agentPaths: {
    researcher: string;
    planner: string;
    checker: string;
  };
}

export interface PromptResult {
  prompt: string;
  agentPath: string;
}

export interface PlanSummary {
  phaseId: string;
  phaseName: string;
  planCount: number;
  waveCount: number;
  waves: { wave: number; plans: string[]; objective: string }[];
  research: 'completed' | 'existing' | 'skipped';
  verification: 'passed' | 'override' | 'skipped';
}

export interface AgentStatus {
  status: 'COMPLETE' | 'BLOCKED' | 'INCONCLUSIVE' | 'CHECKPOINT' | 'PASSED' | 'ISSUES_FOUND';
  message: string;
  issues: string[];
}

export interface ExistingPlansResult {
  hasPlans: boolean;
  planCount: number;
  planFiles: string[];
  planSummary: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseFlags(args: string): PlanPhaseFlags {
  return {
    research: args.includes('--research'),
    skipResearch: args.includes('--skip-research'),
    gaps: args.includes('--gaps'),
    skipVerify: args.includes('--skip-verify'),
  };
}

function resolveModels(profile: string): ModelConfig {
  const profiles: Record<string, ModelConfig> = {
    quality: { researcher: 'opus', planner: 'opus', checker: 'sonnet' },
    balanced: { researcher: 'sonnet', planner: 'opus', checker: 'sonnet' },
    budget: { researcher: 'haiku', planner: 'sonnet', checker: 'haiku' },
  };
  return profiles[profile] || profiles.balanced;
}

// Default agent paths
const DEFAULT_AGENT_PATHS = {
  researcher: '~/.claude/agents/gsd-phase-researcher.md',
  planner: '~/.claude/agents/gsd-planner.md',
  checker: '~/.claude/agents/gsd-plan-checker.md',
};

/**
 * Extract phase number from argument string
 */
function extractPhaseNumber(args: string): string | null {
  // Remove flags first
  const cleaned = args
    .replace(/--research/g, '')
    .replace(/--skip-research/g, '')
    .replace(/--gaps/g, '')
    .replace(/--skip-verify/g, '')
    .trim();

  // Match phase number (integer or decimal)
  const match = cleaned.match(/\b(\d+(?:\.\d+)?)\b/);
  return match ? match[1] : null;
}

/**
 * Extract phase info from roadmap content
 */
function extractPhaseFromRoadmap(
  roadmap: string,
  phaseId: string
): { name: string; description: string } | null {
  // Match "Phase XX: Name" pattern
  const phaseRegex = new RegExp(
    `Phase\\s+${phaseId.replace('.', '\\.')}:\\s*([^\\n]+)`,
    'i'
  );
  const nameMatch = roadmap.match(phaseRegex);

  if (!nameMatch) return null;

  const name = nameMatch[1].trim();

  // Extract description (lines following phase header until next phase or section)
  const descRegex = new RegExp(
    `Phase\\s+${phaseId.replace('.', '\\.')}:[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|\\nPhase\\s+\\d|$)`,
    'i'
  );
  const descMatch = roadmap.match(descRegex);
  const description = descMatch ? descMatch[1].trim() : '';

  return { name, description };
}

/**
 * Find next unplanned phase from roadmap
 */
async function findNextUnplannedPhase(roadmap: string): Promise<string | null> {
  // Extract all phase numbers from roadmap
  const phaseMatches = roadmap.matchAll(/Phase\s+(\d+(?:\.\d+)?):/gi);

  for (const match of phaseMatches) {
    const phaseNum = match[1];
    const normalized = normalizePhaseNumber(phaseNum);

    // Check if phase directory exists
    const phaseInfo = await findPhaseDirectory(normalized);
    if (!phaseInfo) {
      return normalized;
    }

    // Check if phase has plans
    const plans = await listPlanFiles(phaseInfo.directory);
    if (plans.length === 0) {
      return normalized;
    }
  }

  return null;
}

// ============================================================================
// Main Runtime Functions
// ============================================================================

/**
 * Initialize plan-phase context from arguments
 * Handles: environment validation, argument parsing, model resolution, directory creation
 */
export async function init(args: { arguments: string }): Promise<PlanPhaseContext> {
  const errorCtx = (error: string): PlanPhaseContext => ({
    error,
    phaseId: '',
    phaseName: '',
    phaseDescription: '',
    phaseDir: '',
    hasResearch: false,
    hasPlans: false,
    planCount: 0,
    planFiles: [],
    needsResearch: false,
    flags: { research: false, skipResearch: false, gaps: false, skipVerify: false },
    models: { researcher: 'sonnet', planner: 'opus', checker: 'sonnet' },
    modelProfile: 'balanced',
    config: { workflowResearch: true, workflowPlanCheck: true },
    agentPaths: DEFAULT_AGENT_PATHS,
  });

  // Step 1: Validate .planning directory exists
  if (!await planningExists()) {
    return errorCtx('.planning/ directory not found. Run /gsd:new-project first.');
  }

  // Step 2: Parse flags
  const flags = parseFlags(args.arguments);

  // Step 3: Read roadmap
  const roadmap = await readRoadmapFile();
  if (!roadmap) {
    return errorCtx('ROADMAP.md not found or empty.');
  }

  // Step 4: Extract or auto-detect phase number
  let phaseId = extractPhaseNumber(args.arguments);

  if (!phaseId) {
    phaseId = await findNextUnplannedPhase(roadmap);
    if (!phaseId) {
      return errorCtx('Could not determine phase number. Specify phase or check roadmap.');
    }
  }

  // Normalize phase number
  phaseId = normalizePhaseNumber(phaseId);

  // Step 5: Extract phase info from roadmap
  const phaseInfo = extractPhaseFromRoadmap(roadmap, phaseId);
  if (!phaseInfo) {
    // List available phases for error message
    const availablePhases = Array.from(roadmap.matchAll(/Phase\s+(\d+(?:\.\d+)?)/gi))
      .map(m => m[1])
      .join(', ');
    return errorCtx(`Phase ${phaseId} not found in roadmap. Available: ${availablePhases}`);
  }

  // Step 6: Find or create phase directory
  let phaseDir = '';
  const existingPhase = await findPhaseDirectory(phaseId);

  if (existingPhase) {
    phaseDir = existingPhase.directory;
  } else {
    // Create new phase directory
    const slug = buildPhaseSlug(phaseInfo.name);
    phaseDir = `.planning/phases/${phaseId}-${slug}`;
    await fs.mkdir(phaseDir, { recursive: true });
  }

  // Step 7: Check for existing research and plans
  const researchFile = await findResearchFile(phaseDir);
  const planFiles = await listPlanFiles(phaseDir);

  // Step 8: Read config
  const config = await readConfig();
  const workflowSettings = getWorkflowSettings(config);
  const modelProfile = getModelProfile(config);

  // Step 9: Determine if research is needed
  const hasResearch = researchFile !== null;
  let needsResearch = false;

  if (!flags.gaps && !flags.skipResearch) {
    if (workflowSettings.research) {
      if (flags.research || !hasResearch) {
        needsResearch = true;
      }
    }
  }

  return {
    phaseId,
    phaseName: phaseInfo.name,
    phaseDescription: phaseInfo.description,
    phaseDir,
    hasResearch,
    hasPlans: planFiles.length > 0,
    planCount: planFiles.length,
    planFiles,
    needsResearch,
    flags,
    models: resolveModels(modelProfile),
    modelProfile,
    config: {
      workflowResearch: workflowSettings.research,
      workflowPlanCheck: workflowSettings.plan_check,
    },
    agentPaths: DEFAULT_AGENT_PATHS,
  };
}

/**
 * Check existing plans and return details
 */
export async function checkExistingPlans(args: { phaseDir: string }): Promise<ExistingPlansResult> {
  const planFiles = await listPlanFiles(args.phaseDir);

  if (planFiles.length === 0) {
    return {
      hasPlans: false,
      planCount: 0,
      planFiles: [],
      planSummary: '',
    };
  }

  // Build summary of existing plans
  const summaryLines: string[] = [];

  for (const file of planFiles) {
    const content = await readFileContent(file);
    if (!content) continue;

    const basename = path.basename(file, '.md');
    const frontmatter = parsePlanFrontmatter(content);

    // Extract wave from frontmatter
    const wave = frontmatter?.wave ?? 1;

    // Extract first objective if available
    const objMatch = content.match(/##.*(?:objective|goal)[^\n]*\n([^\n]+)/i);
    const objective = objMatch ? objMatch[1].trim().slice(0, 50) + '...' : '-';

    summaryLines.push(`- ${basename} (wave ${wave}): ${objective}`);
  }

  return {
    hasPlans: true,
    planCount: planFiles.length,
    planFiles,
    planSummary: summaryLines.join('\n'),
  };
}

/**
 * Build prompt for researcher agent with inlined context
 */
export async function buildResearcherPrompt(args: {
  phaseId: string;
  phaseName: string;
  phaseDir: string;
  phaseDescription: string;
  agentPath: string;
}): Promise<PromptResult> {
  // Gather context files
  const roadmap = await readRoadmapFile() ?? '';
  const requirements = await readFileContent('.planning/REQUIREMENTS.md') ?? '';
  const state = await readStateFile() ?? '';

  // Get phase context if exists
  const contextFile = await findContextFile(args.phaseDir);
  const phaseContext = contextFile ? await readFileContent(contextFile) ?? '' : '';

  // Extract prior decisions from STATE.md
  const decisionsMatch = state.match(/### Decisions Made[\s\S]*?(?=###|$)/);
  const decisions = decisionsMatch ? decisionsMatch[0] : '';

  const prompt = `<objective>
Research how to implement Phase ${args.phaseId}: ${args.phaseName}

Answer: "What do I need to know to PLAN this phase well?"
</objective>

<context>
**Phase description:**
${args.phaseDescription}

**Requirements (if any):**
${requirements.slice(0, 3000)}

**Prior decisions:**
${decisions}

**Phase context (if any):**
${phaseContext}
</context>

<output>
Write research findings to: ${args.phaseDir}/${args.phaseId}-RESEARCH.md
</output>`;

  return {
    prompt,
    agentPath: args.agentPath,
  };
}

/**
 * Build prompt for planner agent with inlined context
 */
export async function buildPlannerPrompt(args: {
  phaseId: string;
  phaseName: string;
  phaseDir: string;
  agentPath: string;
  mode: 'standard' | 'gap_closure' | 'revision';
  issues?: string[];
}): Promise<PromptResult> {
  // Read all context files
  const state = await readStateFile() ?? '';
  const roadmap = await readRoadmapFile() ?? '';
  const requirements = await readFileContent('.planning/REQUIREMENTS.md') ?? '';

  // Get phase-specific files
  const contextFile = await findContextFile(args.phaseDir);
  const context = contextFile ? await readFileContent(contextFile) ?? '' : '';

  const researchFile = await findResearchFile(args.phaseDir);
  const research = researchFile ? await readFileContent(researchFile) ?? '' : '';

  // Gap closure mode files
  let verification = '';
  let uat = '';
  if (args.mode === 'gap_closure') {
    verification = await readFileContent(`${args.phaseDir}/${args.phaseId}-VERIFICATION.md`) ?? '';
    uat = await readFileContent(`${args.phaseDir}/${args.phaseId}-UAT.md`) ?? '';
  }

  // Revision mode: read current plans
  let currentPlans = '';
  if (args.mode === 'revision') {
    const planFiles = await listPlanFiles(args.phaseDir);
    const plans = await Promise.all(planFiles.map(f => readFileContent(f)));
    currentPlans = plans.filter(Boolean).join('\n\n---\n\n');
  }

  let prompt: string;

  if (args.mode === 'revision') {
    prompt = `<revision_context>

**Phase:** ${args.phaseId}
**Mode:** revision

**Existing plans:**
${currentPlans}

**Checker issues:**
${args.issues?.map((issue, i) => `${i + 1}. ${issue}`).join('\n') || 'None specified'}

</revision_context>

<instructions>
Make targeted updates to address checker issues.
Do NOT replan from scratch unless issues are fundamental.
Return what changed.
</instructions>`;
  } else {
    prompt = `<planning_context>

**Phase:** ${args.phaseId} - ${args.phaseName}
**Mode:** ${args.mode}

**Project State:**
${state}

**Roadmap:**
${roadmap}

**Requirements (if exists):**
${requirements}

**Phase Context (if exists):**
${context}

**Research (if exists):**
${research}

${args.mode === 'gap_closure' ? `**Gap Closure:**
VERIFICATION.md:
${verification}

UAT.md:
${uat}
` : ''}
</planning_context>

<downstream_consumer>
Output consumed by /gsd:execute-phase
Plans must be executable prompts with:

- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<quality_gate>
Before returning PLANNING COMPLETE:

- [ ] PLAN.md files created in phase directory
- [ ] Each plan has valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>`;
  }

  return {
    prompt,
    agentPath: args.agentPath,
  };
}

/**
 * Build prompt for checker agent
 */
export async function buildCheckerPrompt(args: {
  phaseId: string;
  phaseDir: string;
}): Promise<{ prompt: string; phaseGoal: string }> {
  // Read plans
  const planFiles = await listPlanFiles(args.phaseDir);
  const plans = await Promise.all(planFiles.map(f => readFileContent(f)));
  const plansContent = plans.filter(Boolean).join('\n\n---\n\n');

  // Read requirements
  const requirements = await readFileContent('.planning/REQUIREMENTS.md') ?? '';

  // Extract phase goal from roadmap
  const roadmap = await readRoadmapFile() ?? '';
  const goalRegex = new RegExp(`Phase\\s+${args.phaseId.replace('.', '\\.')}:[^\\n]*`, 'i');
  const goalMatch = roadmap.match(goalRegex);
  const phaseGoal = goalMatch ? goalMatch[0] : `Phase ${args.phaseId}`;

  const prompt = `<verification_context>

**Phase:** ${args.phaseId}
**Phase Goal:** ${phaseGoal}

**Plans to verify:**
${plansContent}

**Requirements (if exists):**
${requirements}

</verification_context>

<expected_output>
Return one of:
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>`;

  return {
    prompt,
    phaseGoal,
  };
}

/**
 * Parse agent output to extract status
 */
export async function parseAgentStatus(args: { output: string }): Promise<AgentStatus> {
  const output = args.output;

  // Check for various status markers
  if (output.includes('## RESEARCH COMPLETE') || output.includes('## PLANNING COMPLETE')) {
    return { status: 'COMPLETE', message: 'Agent completed successfully', issues: [] };
  }

  if (output.includes('## RESEARCH BLOCKED') || output.includes('## PLANNING BLOCKED')) {
    const blockerMatch = output.match(/## (?:RESEARCH|PLANNING) BLOCKED[:\s]*([^\n]+)?/);
    return {
      status: 'BLOCKED',
      message: blockerMatch?.[1] || 'Agent encountered a blocker',
      issues: [],
    };
  }

  if (output.includes('## CHECKPOINT REACHED')) {
    const checkpointMatch = output.match(/## CHECKPOINT REACHED[:\s]*([^\n]+)?/);
    return {
      status: 'CHECKPOINT',
      message: checkpointMatch?.[1] || 'Checkpoint reached',
      issues: [],
    };
  }

  if (output.includes('## PLANNING INCONCLUSIVE')) {
    return { status: 'INCONCLUSIVE', message: 'Planning was inconclusive', issues: [] };
  }

  if (output.includes('## VERIFICATION PASSED')) {
    return { status: 'PASSED', message: 'Verification passed', issues: [] };
  }

  if (output.includes('## ISSUES FOUND')) {
    // Extract issues list
    const issuesSection = output.split('## ISSUES FOUND')[1] || '';
    const issueMatches = issuesSection.match(/[-*]\s+(.+)/g) || [];
    const issues = issueMatches.map(m => m.replace(/^[-*]\s+/, '').trim());

    return {
      status: 'ISSUES_FOUND',
      message: `Found ${issues.length} issue(s)`,
      issues,
    };
  }

  // Default: assume complete if no explicit status
  return { status: 'COMPLETE', message: 'Agent completed (no explicit status)', issues: [] };
}

/**
 * Read and display existing plans
 */
export async function readAndDisplayPlans(args: { phaseDir: string }): Promise<string> {
  const planFiles = await listPlanFiles(args.phaseDir);
  const plans = await Promise.all(planFiles.map(async f => {
    const content = await readFileContent(f);
    return `### ${path.basename(f)}\n\n${content || '(empty)'}`;
  }));
  return plans.join('\n\n---\n\n');
}

/**
 * Archive existing plans before replanning
 */
export async function archiveExistingPlans(args: { phaseDir: string }): Promise<void> {
  const planFiles = await listPlanFiles(args.phaseDir);
  const archiveDir = `${args.phaseDir}/archive`;
  await fs.mkdir(archiveDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  for (const file of planFiles) {
    const basename = path.basename(file);
    await fs.rename(file, `${archiveDir}/${timestamp}-${basename}`);
  }
}

/**
 * Generate summary of planning session
 */
export async function generateSummary(args: {
  phaseId: string;
  phaseName: string;
  phaseDir: string;
  checkerPassed: boolean;
  skipVerify: boolean;
  hasResearch: boolean;
  forcedResearch: boolean;
  skippedResearch: boolean;
}): Promise<PlanSummary> {
  const planFiles = await listPlanFiles(args.phaseDir);

  // Parse waves from plans
  const waves: { wave: number; plans: string[]; objective: string }[] = [];

  for (const file of planFiles) {
    const content = await readFileContent(file);
    if (!content) continue;

    const frontmatter = parsePlanFrontmatter(content);
    const wave = typeof frontmatter?.wave === 'number' ? frontmatter.wave : 1;

    // Extract objective
    const objMatch = content.match(/##.*(?:objective|goal)[^\n]*\n([^\n]+)/i);
    const objective = objMatch ? objMatch[1].trim() : '';

    const existing = waves.find(w => w.wave === wave);
    const planName = path.basename(file, '.md');

    if (existing) {
      existing.plans.push(planName);
      if (!existing.objective && objective) {
        existing.objective = objective;
      }
    } else {
      waves.push({ wave, plans: [planName], objective });
    }
  }
  waves.sort((a, b) => a.wave - b.wave);

  // Determine research status
  let research: 'completed' | 'existing' | 'skipped';
  if (args.skippedResearch) {
    research = 'skipped';
  } else if (args.forcedResearch || !args.hasResearch) {
    research = 'completed';
  } else {
    research = 'existing';
  }

  // Determine verification status
  let verification: 'passed' | 'override' | 'skipped';
  if (args.skipVerify) {
    verification = 'skipped';
  } else if (args.checkerPassed) {
    verification = 'passed';
  } else {
    verification = 'override';
  }

  return {
    phaseId: args.phaseId,
    phaseName: args.phaseName,
    planCount: planFiles.length,
    waveCount: waves.length,
    waves,
    research,
    verification,
  };
}

/**
 * Format summary as markdown
 */
export async function formatSummaryMarkdown(args: { summary: PlanSummary }): Promise<string> {
  const { summary } = args;

  const waveTable = summary.waves.map(w =>
    `| ${w.wave} | ${w.plans.join(', ')} | ${w.objective || '-'} |`
  ).join('\n');

  const researchStatus = {
    completed: 'Completed',
    existing: 'Used existing',
    skipped: 'Skipped',
  }[summary.research];

  const verificationStatus = {
    passed: 'Passed',
    override: 'Passed with override',
    skipped: 'Skipped',
  }[summary.verification];

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 GSD ► PHASE ${summary.phaseId} PLANNED ✓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Phase ${summary.phaseId}: ${summary.phaseName}** — ${summary.planCount} plan(s) in ${summary.waveCount} wave(s)

| Wave | Plans | What it builds |
|------|-------|----------------|
${waveTable}

Research: ${researchStatus}
Verification: ${verificationStatus}

───────────────────────────────────────────────────────────────

## ▶ Next Up

**Execute Phase ${summary.phaseId}** — run all ${summary.planCount} plans

\`/gsd:execute-phase ${summary.phaseId}\`

<sub>/clear first → fresh context window</sub>

───────────────────────────────────────────────────────────────

**Also available:**
- cat .planning/phases/${summary.phaseId}-*/*-PLAN.md — review plans
- /gsd:plan-phase ${summary.phaseId} --research — re-research first

───────────────────────────────────────────────────────────────
`;
}
