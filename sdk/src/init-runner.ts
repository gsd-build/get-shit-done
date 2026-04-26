/**
 * InitRunner — orchestrates the GSD new-project init workflow.
 *
 * Workflow: setup → config → PROJECT.md → parallel research (4 sessions)
 *         → synthesis → requirements → roadmap
 *
 * Each step calls Agent SDK `query()` via `runPhaseStepSession()` with
 * prompts derived from GSD-1 workflow/agent/template files on disk.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';

import type {
  InitConfig,
  InitResult,
  InitStepResult,
  InitStepName,
  InitNewProjectInfo,
  GSDInitStartEvent,
  GSDInitStepStartEvent,
  GSDInitStepCompleteEvent,
  GSDInitCompleteEvent,
  GSDInitResearchSpawnEvent,
  PlanResult,
} from './types.js';
import { GSDEventType, PhaseStepType } from './types.js';
import type { GSDTools } from './gsd-tools.js';
import type { GSDEventStream } from './event-stream.js';
import { loadConfig } from './config.js';
import { runPhaseStepSession } from './session-runner.js';
import { sanitizePrompt } from './prompt-sanitizer.js';
import { resolveAgentsDir } from './query/helpers.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const GSD_TEMPLATES_DIR = join(homedir(), '.claude', 'get-shit-done', 'templates');
const GSD_AGENTS_DIR = resolveAgentsDir();

const RESEARCH_TYPES = ['STACK', 'FEATURES', 'ARCHITECTURE', 'PITFALLS'] as const;
type ResearchType = (typeof RESEARCH_TYPES)[number];

const RESEARCH_STEP_MAP: Record<ResearchType, InitStepName> = {
  STACK: 'research-stack',
  FEATURES: 'research-features',
  ARCHITECTURE: 'research-architecture',
  PITFALLS: 'research-pitfalls',
};

/** Default config.json written during init for auto-mode projects. */
const AUTO_MODE_CONFIG = {
  mode: 'yolo',
  parallelization: true,
  depth: 'quick',
  workflow: {
    research: true,
    plan_checker: true,
    verifier: true,
    auto_advance: true,
    skip_discuss: false,
  },
};

// ─── InitRunner ──────────────────────────────────────────────────────────────

export interface InitRunnerDeps {
  projectDir: string;
  tools: GSDTools;
  eventStream: GSDEventStream;
  config?: Partial<InitConfig>;
  /** Override for SDK prompts directory. Defaults to package-relative sdk/prompts/. */
  sdkPromptsDir?: string;
}

export class InitRunner {
  private readonly projectDir: string;
  private readonly tools: GSDTools;
  private readonly eventStream: GSDEventStream;
  private readonly config: InitConfig;
  private readonly sessionId: string;
  private readonly sdkPromptsDir: string;

  constructor(deps: InitRunnerDeps) {
    this.projectDir = deps.projectDir;
    this.tools = deps.tools;
    this.eventStream = deps.eventStream;
    this.config = {
      maxBudgetPerSession: deps.config?.maxBudgetPerSession ?? 3.0,
      maxTurnsPerSession: deps.config?.maxTurnsPerSession ?? 30,
      researchModel: deps.config?.researchModel,
      orchestratorModel: deps.config?.orchestratorModel,
    };
    this.sessionId = `init-${Date.now()}`;
    // SDK prompts dir: explicit override → package-relative default via import.meta.url
    this.sdkPromptsDir =
      deps.sdkPromptsDir ??
      join(fileURLToPath(new URL('.', import.meta.url)), '..', 'prompts');
  }

  /**
   * Run the full init workflow.
   *
   * @param input - User input: PRD content, project description, etc.
   * @returns InitResult with per-step results, artifacts, and totals.
   */
  async run(input: string): Promise<InitResult> {
    const startTime = Date.now();
    const steps: InitStepResult[] = [];
    const artifacts: string[] = [];

    this.emitEvent<GSDInitStartEvent>({
      type: GSDEventType.InitStart,
      input: input.slice(0, 200),
      projectDir: this.projectDir,
    });

    try {
      // ── Step 1: Setup — get project metadata ──────────────────────────
      const setupResult = await this.runStep('setup', async () => {
        const info = await this.tools.initNewProject();
        if (info.project_exists) {
          throw new Error('Project already exists (.planning/PROJECT.md found). Use a fresh directory or delete .planning/ first.');
        }
        return info;
      });
      steps.push(setupResult.stepResult);
      if (!setupResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }
      const projectInfo = setupResult.value as InitNewProjectInfo;

      // ── Step 2: Config — write config.json and init git ───────────────
      const configResult = await this.runStep('config', async () => {
        // Ensure git is initialized
        if (!projectInfo.has_git) {
          await this.execGit(['init']);
        }

        // Ensure .planning/ directory exists
        const planningDir = join(this.projectDir, '.planning');
        await mkdir(planningDir, { recursive: true });

        // Write config.json
        const configPath = join(planningDir, 'config.json');
        await writeFile(configPath, JSON.stringify(AUTO_MODE_CONFIG, null, 2) + '\n', 'utf-8');
        artifacts.push('.planning/config.json');

        // Persist auto_advance via gsd-tools (validates & updates state)
        await this.tools.configSet('workflow.auto_advance', 'true');

        // Commit config
        if (projectInfo.commit_docs) {
          await this.tools.commit('chore: add project config', ['.planning/config.json']);
        }
      });
      steps.push(configResult.stepResult);
      if (!configResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }

      // ── Step 3: PROJECT.md — synthesize from input ────────────────────
      const projectResult = await this.runStep('project', async () => {
        const prompt = await this.buildProjectPrompt(input);
        const result = await this.runSession(prompt, projectInfo.researcher_model);
        if (!result.success) {
          throw new Error(`PROJECT.md synthesis failed: ${result.error?.messages.join(', ') ?? 'unknown error'}`);
        }
        artifacts.push('.planning/PROJECT.md');
        if (projectInfo.commit_docs) {
          await this.tools.commit('docs: add PROJECT.md', ['.planning/PROJECT.md']);
        }
        return result;
      });
      steps.push(projectResult.stepResult);
      if (!projectResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }

      // ── Step 4: Parallel research (4 sessions) ───────────────────────
      const researchSteps = await this.runParallelResearch(input, projectInfo);
      steps.push(...researchSteps);
      const researchFailed = researchSteps.some(s => !s.success);

      // Add artifacts for successful research files
      for (const rs of researchSteps) {
        if (rs.success && rs.artifacts) {
          artifacts.push(...rs.artifacts);
        }
      }

      if (researchFailed) {
        // Continue with partial results — synthesis will work with what's available
        // but flag the overall result as partial
      }

      // ── Step 5: Synthesis — combine research into SUMMARY.md ──────────
      const synthResult = await this.runStep('synthesis', async () => {
        const prompt = await this.buildSynthesisPrompt();
        const result = await this.runSession(prompt, projectInfo.synthesizer_model);
        if (!result.success) {
          throw new Error(`Research synthesis failed: ${result.error?.messages.join(', ') ?? 'unknown error'}`);
        }
        artifacts.push('.planning/research/SUMMARY.md');
        if (projectInfo.commit_docs) {
          await this.tools.commit('docs: add research files', ['.planning/research/']);
        }
        return result;
      });
      steps.push(synthResult.stepResult);
      if (!synthResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }

      // ── Step 6: Requirements — derive from PROJECT + research ─────────
      const reqResult = await this.runStep('requirements', async () => {
        const prompt = await this.buildRequirementsPrompt();
        const result = await this.runSession(prompt, projectInfo.synthesizer_model);
        if (!result.success) {
          throw new Error(`Requirements generation failed: ${result.error?.messages.join(', ') ?? 'unknown error'}`);
        }
        artifacts.push('.planning/REQUIREMENTS.md');
        if (projectInfo.commit_docs) {
          await this.tools.commit('docs: add REQUIREMENTS.md', ['.planning/REQUIREMENTS.md']);
        }
        return result;
      });
      steps.push(reqResult.stepResult);
      if (!reqResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }

      // ── Step 7: Roadmap — create phases + STATE.md ────────────────────
      const roadmapResult = await this.runStep('roadmap', async () => {
        const prompt = await this.buildRoadmapPrompt();
        const result = await this.runSession(prompt, projectInfo.roadmapper_model);
        if (!result.success) {
          throw new Error(`Roadmap generation failed: ${result.error?.messages.join(', ') ?? 'unknown error'}`);
        }
        artifacts.push('.planning/ROADMAP.md', '.planning/STATE.md');
        if (projectInfo.commit_docs) {
          await this.tools.commit('docs: add ROADMAP.md and STATE.md', [
            '.planning/ROADMAP.md',
            '.planning/STATE.md',
          ]);
        }
        return result;
      });
      steps.push(roadmapResult.stepResult);
      if (!roadmapResult.stepResult.success) {
        return this.buildResult(false, steps, artifacts, startTime);
      }

      const success = !researchFailed;
      return this.buildResult(success, steps, artifacts, startTime);
    } catch (err) {
      // Unexpected top-level error
      steps.push({
        step: 'setup',
        success: false,
        durationMs: 0,
        costUsd: 0,
        error: err instanceof Error ? err.message : String(err),
      });
      return this.buildResult(false, steps, artifacts, startTime);
    }
  }

  // ─── Step execution wrapper ────────────────────────────────────────────────

  private async runStep<T>(
    step: InitStepName,
    fn: () => Promise<T>,
  ): Promise<{ stepResult: InitStepResult; value?: T }> {
    const stepStart = Date.now();

    this.emitEvent<GSDInitStepStartEvent>({
      type: GSDEventType.InitStepStart,
      step,
    });

    try {
      const value = await fn();
      const durationMs = Date.now() - stepStart;
      const costUsd = this.extractCost(value);

      const stepResult: InitStepResult = {
        step,
        success: true,
        durationMs,
        costUsd,
      };

      this.emitEvent<GSDInitStepCompleteEvent>({
        type: GSDEventType.InitStepComplete,
        step,
        success: true,
        durationMs,
        costUsd,
      });

      return { stepResult, value };
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      const stepResult: InitStepResult = {
        step,
        success: false,
        durationMs,
        costUsd: 0,
        error: errorMsg,
      };

      this.emitEvent<GSDInitStepCompleteEvent>({
        type: GSDEventType.InitStepComplete,
        step,
        success: false,
        durationMs,
        costUsd: 0,
        error: errorMsg,
      });

      return { stepResult };
    }
  }

  // ─── Parallel research ─────────────────────────────────────────────────────

  private async runParallelResearch(
    input: string,
    projectInfo: InitNewProjectInfo,
  ): Promise<InitStepResult[]> {
    this.emitEvent<GSDInitResearchSpawnEvent>({
      type: GSDEventType.InitResearchSpawn,
      sessionCount: RESEARCH_TYPES.length,
      researchTypes: [...RESEARCH_TYPES],
    });

    const promises = RESEARCH_TYPES.map(async (researchType) => {
      const step = RESEARCH_STEP_MAP[researchType];
      const result = await this.runStep(step, async () => {
        const prompt = await this.buildResearchPrompt(researchType, input);
        const sessionResult = await this.runSession(prompt, projectInfo.researcher_model);
        if (!sessionResult.success) {
          throw new Error(
            `Research (${researchType}) failed: ${sessionResult.error?.messages.join(', ') ?? 'unknown error'}`,
          );
        }
        return sessionResult;
      });
      // Attach artifact path on success
      if (result.stepResult.success) {
        result.stepResult.artifacts = [`.planning/research/${researchType}.md`];
      }
      return result.stepResult;
    });

    const results = await Promise.allSettled(promises);

    return results.map((r, i) => {
      if (r.status === 'fulfilled') {
        return r.value;
      }
      // Promise.allSettled rejection — should not happen since runStep catches,
      // but handle defensively
      return {
        step: RESEARCH_STEP_MAP[RESEARCH_TYPES[i]!]!,
        success: false,
        durationMs: 0,
        costUsd: 0,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      } satisfies InitStepResult;
    });
  }

  // ─── Prompt builders ───────────────────────────────────────────────────────

  /**
   * Build the PROJECT.md synthesis prompt.
   * Reads the project template and combines with user input.
   */
  private async buildProjectPrompt(input: string): Promise<string> {
    const template = await this.readGSDFile('templates/project.md');

    return sanitizePrompt([
      'You are creating the PROJECT.md for a new software project.',
      'Write .planning/PROJECT.md based on the template structure below and the user\'s project description.',
      '',
      '<project_template>',
      template,
      '</project_template>',
      '',
      '<user_input>',
      input,
      '</user_input>',
      '',
      'Write the file to .planning/PROJECT.md. Follow the template structure but fill in with real content derived from the user input.',
      'Be specific and opinionated — make decisions, don\'t list options.',
    ].join('\n'), this.projectDir);
  }

  /**
   * Build a research prompt for a specific research type.
   * Reads the agent definition and research template.
   */
  private async buildResearchPrompt(
    researchType: ResearchType,
    input: string,
  ): Promise<string> {
    const agentDef = await this.readAgentFile('gsd-project-researcher.md');
    const template = await this.readGSDFile(`templates/research-project/${researchType}.md`);

    // Read PROJECT.md if it exists (it should by now)
    let projectContent = '';
    try {
      projectContent = await readFile(
        join(this.projectDir, '.planning', 'PROJECT.md'),
        'utf-8',
      );
    } catch {
      // Fall back to raw input if PROJECT.md not yet written
      projectContent = input;
    }

    return sanitizePrompt([
      '<agent_definition>',
      agentDef,
      '</agent_definition>',
      '',
      `You are researching the ${researchType} aspect of this project.`,
      `Write your findings to .planning/research/${researchType}.md`,
      '',
      '<files_to_read>',
      '.planning/PROJECT.md',
      '</files_to_read>',
      '',
      '<project_context>',
      projectContent,
      '</project_context>',
      '',
      '<research_template>',
      template,
      '</research_template>',
      '',
      `Write .planning/research/${researchType}.md following the template structure.`,
      'Be comprehensive but opinionated. "Use X because Y" not "Options are X, Y, Z."',
    ].join('\n'), this.projectDir);
  }

  /**
   * Build the synthesis prompt.
   * Reads synthesizer agent def and all 4 research outputs.
   */
  private async buildSynthesisPrompt(): Promise<string> {
    const agentDef = await this.readAgentFile('gsd-research-synthesizer.md');
    const summaryTemplate = await this.readGSDFile('templates/research-project/SUMMARY.md');
    const researchDir = join(this.projectDir, '.planning', 'research');

    // Read whatever research files exist
    const researchContent: string[] = [];
    for (const rt of RESEARCH_TYPES) {
      try {
        const content = await readFile(join(researchDir, `${rt}.md`), 'utf-8');
        researchContent.push(`<research_${rt.toLowerCase()}>\n${content}\n</research_${rt.toLowerCase()}>`);
      } catch {
        researchContent.push(`<research_${rt.toLowerCase()}>\n(Not available)\n</research_${rt.toLowerCase()}>`);
      }
    }

    return sanitizePrompt([
      '<agent_definition>',
      agentDef,
      '</agent_definition>',
      '',
      '<files_to_read>',
      '.planning/research/STACK.md',
      '.planning/research/FEATURES.md',
      '.planning/research/ARCHITECTURE.md',
      '.planning/research/PITFALLS.md',
      '</files_to_read>',
      '',
      'Synthesize the research files below into .planning/research/SUMMARY.md',
      '',
      ...researchContent,
      '',
      '<summary_template>',
      summaryTemplate,
      '</summary_template>',
      '',
      'Write .planning/research/SUMMARY.md synthesizing all research findings.',
      'Also commit all research files: git add .planning/research/ && git commit.',
    ].join('\n'), this.projectDir);
  }

  /**
   * Build the requirements prompt.
   * Reads PROJECT.md + FEATURES.md for requirement derivation.
   */
  private async buildRequirementsPrompt(): Promise<string> {
    const reqTemplate = await this.readGSDFile('templates/requirements.md');

    let projectContent = '';
    let featuresContent = '';
    try {
      projectContent = await readFile(
        join(this.projectDir, '.planning', 'PROJECT.md'),
        'utf-8',
      );
    } catch {
      // Should not happen at this point
    }
    try {
      featuresContent = await readFile(
        join(this.projectDir, '.planning', 'research', 'FEATURES.md'),
        'utf-8',
      );
    } catch {
      // Research may have partially failed
    }

    return sanitizePrompt([
      'You are generating REQUIREMENTS.md for this project.',
      'Derive requirements from the PROJECT.md and research outputs.',
      'Auto-include all table-stakes requirements (auth, error handling, logging, etc.).',
      '',
      '<project_context>',
      projectContent,
      '</project_context>',
      '',
      '<features_research>',
      featuresContent || '(Not available)',
      '</features_research>',
      '',
      '<requirements_template>',
      reqTemplate,
      '</requirements_template>',
      '',
      'Write .planning/REQUIREMENTS.md following the template structure.',
      'Every requirement must be testable and specific. No vague aspirations.',
    ].join('\n'), this.projectDir);
  }

  /**
   * Build the roadmap prompt.
   * Reads PROJECT.md + REQUIREMENTS.md + research/SUMMARY.md + config.json.
   */
  private async buildRoadmapPrompt(): Promise<string> {
    const agentDef = await this.readAgentFile('gsd-roadmapper.md');
    const roadmapTemplate = await this.readGSDFile('templates/roadmap.md');
    const stateTemplate = await this.readGSDFile('templates/state.md');

    const filesToRead = [
      '.planning/PROJECT.md',
      '.planning/REQUIREMENTS.md',
      '.planning/research/SUMMARY.md',
      '.planning/config.json',
    ];

    const fileContents: string[] = [];
    for (const fp of filesToRead) {
      try {
        const content = await readFile(join(this.projectDir, fp), 'utf-8');
        fileContents.push(`<file path="${fp}">\n${content}\n</file>`);
      } catch {
        fileContents.push(`<file path="${fp}">\n(Not available)\n</file>`);
      }
    }

    return sanitizePrompt([
      '<agent_definition>',
      agentDef,
      '</agent_definition>',
      '',
      '<files_to_read>',
      ...filesToRead,
      '</files_to_read>',
      '',
      ...fileContents,
      '',
      '<roadmap_template>',
      roadmapTemplate,
      '</roadmap_template>',
      '',
      '<state_template>',
      stateTemplate,
      '</state_template>',
      '',
      'Create .planning/ROADMAP.md and .planning/STATE.md.',
      'ROADMAP.md: Transform requirements into phases. Every v1 requirement maps to exactly one phase.',
      'STATE.md: Initialize project state tracking.',
    ].join('\n'), this.projectDir);
  }

  // ─── Session execution ─────────────────────────────────────────────────────

  /**
   * Run a single Agent SDK session via runPhaseStepSession.
   */
  private async runSession(prompt: string, modelOverride?: string): Promise<PlanResult> {
    const config = await loadConfig(this.projectDir);

    return runPhaseStepSession(
      prompt,
      PhaseStepType.Research, // Research phase gives broadest tool access
      config,
      {
        maxTurns: this.config.maxTurnsPerSession,
        maxBudgetUsd: this.config.maxBudgetPerSession,
        model: modelOverride ?? this.config.orchestratorModel,
        cwd: this.projectDir,
      },
      this.eventStream,
      { phase: undefined, planName: undefined },
    );
  }

  // ─── File reading helpers ──────────────────────────────────────────────────

  /**
   * Read a file from the GSD templates directory.
   * Tries sdk/prompts/{relativePath} first (headless versions), then
   * falls back to GSD-1 originals (~/.claude/get-shit-done/).
   */
  private async readGSDFile(relativePath: string): Promise<string> {
    // Try installed GSD first (complete, up-to-date versions)
    const fullPath = join(GSD_TEMPLATES_DIR, '..', relativePath);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      // Not installed, fall through to SDK bundled copies
    }

    // Fall back to SDK bundled copies
    const sdkPath = join(this.sdkPromptsDir, relativePath);
    try {
      return await readFile(sdkPath, 'utf-8');
    } catch {
      return `(Template not found: ${relativePath})`;
    }
  }

  /**
   * Read an agent definition.
   * Tries installed agents first (complete, up-to-date versions), then
   * falls back to SDK bundled copies.
   */
  private async readAgentFile(filename: string): Promise<string> {
    // Try installed agents first (complete, up-to-date versions)
    const fullPath = join(GSD_AGENTS_DIR, filename);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      // Not installed, fall through to SDK bundled copies
    }

    // Fall back to SDK bundled copies
    const sdkPath = join(this.sdkPromptsDir, 'agents', filename);
    try {
      return await readFile(sdkPath, 'utf-8');
    } catch {
      return `(Agent definition not found: ${filename})`;
    }
  }

  // ─── Git helper ────────────────────────────────────────────────────────────

  /**
   * Execute a git command in the project directory.
   */
  private execGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd: this.projectDir }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git ${args.join(' ')} failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout.toString());
      });
    });
  }

  // ─── Event helpers ─────────────────────────────────────────────────────────

  private emitEvent<T extends { type: GSDEventType }>(
    partial: Omit<T, 'timestamp' | 'sessionId'> & { type: GSDEventType },
  ): void {
    this.eventStream.emitEvent({
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      ...partial,
    } as unknown as import('./types.js').GSDEvent);
  }

  // ─── Result helpers ────────────────────────────────────────────────────────

  private buildResult(
    success: boolean,
    steps: InitStepResult[],
    artifacts: string[],
    startTime: number,
  ): InitResult {
    const totalCostUsd = steps.reduce((sum, s) => sum + s.costUsd, 0);
    const totalDurationMs = Date.now() - startTime;

    this.emitEvent<GSDInitCompleteEvent>({
      type: GSDEventType.InitComplete,
      success,
      totalCostUsd,
      totalDurationMs,
      artifactCount: artifacts.length,
    });

    return {
      success,
      steps,
      totalCostUsd,
      totalDurationMs,
      artifacts,
    };
  }

  /**
   * Extract cost from a step return value if it's a PlanResult.
   */
  private extractCost(value: unknown): number {
    if (value && typeof value === 'object' && 'totalCostUsd' in value) {
      return (value as PlanResult).totalCostUsd;
    }
    return 0;
  }
}
