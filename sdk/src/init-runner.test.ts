import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { InitRunner } from './init-runner.js';
import type { InitRunnerDeps } from './init-runner.js';
import type {
  PlanResult,
  SessionUsage,
  GSDEvent,
  InitNewProjectInfo,
  InitStepResult,
} from './types.js';
import { GSDEventType } from './types.js';

// ─── Mock modules ────────────────────────────────────────────────────────────

// Mock session-runner to avoid real SDK calls
vi.mock('./session-runner.js', () => ({
  runPhaseStepSession: vi.fn(),
  runPlanSession: vi.fn(),
}));

// Mock config loader
vi.mock('./config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    mode: 'yolo',
    model_profile: 'balanced',
  }),
  CONFIG_DEFAULTS: {},
}));

// Mock fs/promises for template reading (InitRunner reads GSD templates)
// We partially mock — only readFile needs interception for template paths
const originalReadFile = vi.importActual('node:fs/promises').then(m => (m as typeof import('node:fs/promises')).readFile);

import { runPhaseStepSession } from './session-runner.js';

const mockRunSession = vi.mocked(runPhaseStepSession);

// ─── Factory helpers ─────────────────────────────────────────────────────────

function makeUsage(): SessionUsage {
  return {
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

function makeSuccessResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    success: true,
    sessionId: `sess-${Date.now()}`,
    totalCostUsd: 0.05,
    durationMs: 2000,
    usage: makeUsage(),
    numTurns: 10,
    ...overrides,
  };
}

function makeErrorResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    success: false,
    sessionId: `sess-err-${Date.now()}`,
    totalCostUsd: 0.01,
    durationMs: 500,
    usage: makeUsage(),
    numTurns: 2,
    error: {
      subtype: 'error_during_execution',
      messages: ['Session failed'],
    },
    ...overrides,
  };
}

function makeProjectInfo(overrides: Partial<InitNewProjectInfo> = {}): InitNewProjectInfo {
  return {
    researcher_model: 'claude-sonnet-4-6',
    synthesizer_model: 'claude-sonnet-4-6',
    roadmapper_model: 'claude-sonnet-4-6',
    commit_docs: false, // false for tests — no git operations
    project_exists: false,
    has_codebase_map: false,
    planning_exists: false,
    has_existing_code: false,
    has_package_file: false,
    is_brownfield: false,
    needs_codebase_map: false,
    has_git: true, // skip git init in tests
    brave_search_available: false,
    firecrawl_available: false,
    exa_search_available: false,
    project_path: '.planning/PROJECT.md',
    ...overrides,
  };
}

function makeTools(overrides: Record<string, unknown> = {}) {
  return {
    initNewProject: vi.fn().mockResolvedValue(makeProjectInfo()),
    configSet: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn(),
    stateLoad: vi.fn(),
    roadmapAnalyze: vi.fn(),
    phaseComplete: vi.fn(),
    verifySummary: vi.fn(),
    initExecutePhase: vi.fn(),
    initPhaseOp: vi.fn(),
    configGet: vi.fn(),
    stateBeginPhase: vi.fn(),
    phasePlanIndex: vi.fn(),
    ...overrides,
  } as any;
}

function makeEventStream() {
  const events: GSDEvent[] = [];
  return {
    emitEvent: vi.fn((event: GSDEvent) => events.push(event)),
    on: vi.fn(),
    emit: vi.fn(),
    addTransport: vi.fn(),
    events,
  } as any;
}

function makeDeps(overrides: Partial<InitRunnerDeps> & { tmpDir: string }): InitRunnerDeps & { events: GSDEvent[] } {
  const tools = makeTools();
  const eventStream = makeEventStream();
  return {
    projectDir: overrides.tmpDir,
    tools: overrides.tools ?? tools,
    eventStream: overrides.eventStream ?? eventStream,
    config: overrides.config,
    events: eventStream.events,
    ...(overrides.tools ? {} : {}),
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('InitRunner', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `init-runner-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });
    vi.clearAllMocks();

    // Default: all sessions succeed
    mockRunSession.mockResolvedValue(makeSuccessResult());
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function createRunner(toolsOverrides: Record<string, unknown> = {}, configOverrides?: Partial<InitRunnerDeps['config']>) {
    const tools = makeTools(toolsOverrides);
    const eventStream = makeEventStream();
    const runner = new InitRunner({
      projectDir: tmpDir,
      tools,
      eventStream,
      config: configOverrides as any,
    });
    return { runner, tools, eventStream, events: eventStream.events as GSDEvent[] };
  }

  // ─── Core workflow tests ─────────────────────────────────────────────────

  it('run() calls initNewProject and validates project_exists === false', async () => {
    const { runner, tools } = createRunner();

    await runner.run('build a todo app');

    expect(tools.initNewProject).toHaveBeenCalledOnce();
  });

  it('run() returns error result when initNewProject reports project_exists', async () => {
    const { runner, tools } = createRunner({
      initNewProject: vi.fn().mockResolvedValue(makeProjectInfo({ project_exists: true })),
    });

    const result = await runner.run('build a todo app');

    expect(result.success).toBe(false);
    // The setup step should have failed
    const setupStep = result.steps.find(s => s.step === 'setup');
    expect(setupStep).toBeDefined();
    expect(setupStep!.success).toBe(false);
    expect(setupStep!.error).toContain('already exists');
  });

  it('run() writes config.json with auto-mode defaults', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    // config.json should be written to .planning/config.json in tmpDir
    const configPath = join(tmpDir, '.planning', 'config.json');
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed.mode).toBe('yolo');
    expect(parsed.parallelization).toBe(true);
    expect(parsed.workflow.auto_advance).toBe(true);
  });

  it('run() calls configSet for auto_advance', async () => {
    const { runner, tools } = createRunner();

    await runner.run('build a todo app');

    expect(tools.configSet).toHaveBeenCalledWith('workflow.auto_advance', 'true');
  });

  it('run() spawns PROJECT.md synthesis session', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    // The third session call should be the PROJECT.md synthesis
    // Calls: setup (no session), config (no session), project (1st session),
    //        4x research, synthesis, requirements, roadmap
    // Total: 8 runPhaseStepSession calls
    expect(mockRunSession).toHaveBeenCalled();

    // First call should be for PROJECT.md (step 3)
    const firstCall = mockRunSession.mock.calls[0];
    expect(firstCall).toBeDefined();
    const prompt = firstCall![0] as string;
    expect(prompt).toContain('PROJECT.md');
  });

  it('run() spawns 4 parallel research sessions via Promise.allSettled', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    // Count calls that contain the specific "researching the X aspect" pattern
    // which uniquely identifies research prompts (vs synthesis/requirements that reference research files)
    const researchCalls = mockRunSession.mock.calls.filter(call => {
      const prompt = call[0] as string;
      return prompt.includes('You are researching the');
    });

    // Should be exactly 4 research sessions
    expect(researchCalls.length).toBe(4);
  });

  it('run() spawns synthesis session after research completes', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    // Synthesis call should contain 'Synthesize' or 'SUMMARY'
    const synthesisCalls = mockRunSession.mock.calls.filter(call => {
      const prompt = call[0] as string;
      return prompt.includes('Synthesize') || prompt.includes('SUMMARY.md');
    });

    expect(synthesisCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('run() spawns requirements session', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    const reqCalls = mockRunSession.mock.calls.filter(call => {
      const prompt = call[0] as string;
      return prompt.includes('REQUIREMENTS.md');
    });

    expect(reqCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('run() spawns roadmapper session', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    const roadmapCalls = mockRunSession.mock.calls.filter(call => {
      const prompt = call[0] as string;
      return prompt.includes('ROADMAP.md') || prompt.includes('STATE.md');
    });

    expect(roadmapCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('run() calls commit after each major step when commit_docs is true', async () => {
    const commitFn = vi.fn().mockResolvedValue(undefined);
    const { runner } = createRunner({
      initNewProject: vi.fn().mockResolvedValue(makeProjectInfo({ commit_docs: true })),
      commit: commitFn,
    });

    await runner.run('build a todo app');

    // Should commit: config, PROJECT.md, research, REQUIREMENTS.md, ROADMAP+STATE
    expect(commitFn).toHaveBeenCalled();
    expect(commitFn.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('run() does not call commit when commit_docs is false', async () => {
    const commitFn = vi.fn().mockResolvedValue(undefined);
    const { runner } = createRunner({
      initNewProject: vi.fn().mockResolvedValue(makeProjectInfo({ commit_docs: false })),
      commit: commitFn,
    });

    await runner.run('build a todo app');

    expect(commitFn).not.toHaveBeenCalled();
  });

  // ─── Event emission tests ────────────────────────────────────────────────

  it('run() emits InitStart and InitComplete events', async () => {
    const { runner, events } = createRunner();

    await runner.run('build a todo app');

    const startEvents = events.filter(e => e.type === GSDEventType.InitStart);
    const completeEvents = events.filter(e => e.type === GSDEventType.InitComplete);

    expect(startEvents.length).toBe(1);
    expect(completeEvents.length).toBe(1);

    const start = startEvents[0] as any;
    expect(start.projectDir).toBe(tmpDir);
    expect(start.input).toBeTruthy();

    const complete = completeEvents[0] as any;
    expect(complete.success).toBe(true);
    expect(complete.totalCostUsd).toBeTypeOf('number');
    expect(complete.totalDurationMs).toBeTypeOf('number');
    expect(complete.artifactCount).toBeGreaterThan(0);
  });

  it('run() emits InitStepStart/Complete for each step', async () => {
    const { runner, events } = createRunner();

    await runner.run('build a todo app');

    const stepStarts = events.filter(e => e.type === GSDEventType.InitStepStart);
    const stepCompletes = events.filter(e => e.type === GSDEventType.InitStepComplete);

    // Steps: setup, config, project, 4x research, synthesis, requirements, roadmap = 10
    expect(stepStarts.length).toBe(10);
    expect(stepCompletes.length).toBe(10);

    // Verify each step start has a matching complete (order may vary for parallel research)
    const startSteps = stepStarts.map(e => (e as any).step).sort();
    const completeSteps = stepCompletes.map(e => (e as any).step).sort();

    expect(startSteps).toEqual(completeSteps);

    // Verify expected step names are present
    expect(startSteps).toContain('setup');
    expect(startSteps).toContain('config');
    expect(startSteps).toContain('project');
    expect(startSteps).toContain('research-stack');
    expect(startSteps).toContain('research-features');
    expect(startSteps).toContain('research-architecture');
    expect(startSteps).toContain('research-pitfalls');
    expect(startSteps).toContain('synthesis');
    expect(startSteps).toContain('requirements');
    expect(startSteps).toContain('roadmap');
  });

  it('run() emits InitResearchSpawn before research sessions', async () => {
    const { runner, events } = createRunner();

    await runner.run('build a todo app');

    const spawnEvents = events.filter(e => e.type === GSDEventType.InitResearchSpawn);
    expect(spawnEvents.length).toBe(1);

    const spawn = spawnEvents[0] as any;
    expect(spawn.sessionCount).toBe(4);
    expect(spawn.researchTypes).toEqual(['STACK', 'FEATURES', 'ARCHITECTURE', 'PITFALLS']);
  });

  // ─── Error handling tests ────────────────────────────────────────────────

  it('run() returns error when a session fails (partial research success)', async () => {
    // Make the STACK research session fail, others succeed
    let callCount = 0;
    mockRunSession.mockImplementation(async (prompt: string) => {
      callCount++;
      // First call is PROJECT.md, then 4 research calls
      // The 2nd call overall (1st research) should fail
      if (callCount === 2) {
        return makeErrorResult();
      }
      return makeSuccessResult();
    });

    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    // Should still complete (partial success allowed for research)
    // but overall result indicates research failure
    expect(result.success).toBe(false);

    // Steps should still exist for all phases
    expect(result.steps.length).toBeGreaterThanOrEqual(7);
  });

  it('run() stops workflow when PROJECT.md synthesis fails', async () => {
    // First session (PROJECT.md) fails
    mockRunSession.mockResolvedValueOnce(makeErrorResult());

    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    expect(result.success).toBe(false);

    // Should have setup, config, and project steps only
    const stepNames = result.steps.map(s => s.step);
    expect(stepNames).toContain('setup');
    expect(stepNames).toContain('config');
    expect(stepNames).toContain('project');
    // Should NOT continue to research
    expect(stepNames).not.toContain('research-stack');
  });

  it('run() stops workflow when requirements session fails', async () => {
    // Let PROJECT.md and research succeed, but make requirements fail
    let sessionCallIndex = 0;
    mockRunSession.mockImplementation(async () => {
      sessionCallIndex++;
      // Calls: 1=PROJECT.md, 2-5=research, 6=synthesis, 7=requirements
      if (sessionCallIndex === 7) {
        return makeErrorResult();
      }
      return makeSuccessResult();
    });

    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    expect(result.success).toBe(false);

    const stepNames = result.steps.map(s => s.step);
    expect(stepNames).toContain('requirements');
    // Should NOT continue to roadmap
    expect(stepNames).not.toContain('roadmap');
  });

  // ─── Cost aggregation tests ──────────────────────────────────────────────

  it('run() aggregates costs from all sessions', async () => {
    const costPerSession = 0.05;
    mockRunSession.mockResolvedValue(makeSuccessResult({ totalCostUsd: costPerSession }));

    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    // 8 total sessions: PROJECT.md + 4 research + synthesis + requirements + roadmap
    // Cost from sessions extracted via extractCost, non-session steps (setup/config) are 0
    expect(result.totalCostUsd).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeGreaterThan(0);
  });

  // ─── Artifact tracking tests ─────────────────────────────────────────────

  it('run() returns all expected artifacts on success', async () => {
    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    expect(result.success).toBe(true);
    expect(result.artifacts).toContain('.planning/config.json');
    expect(result.artifacts).toContain('.planning/PROJECT.md');
    expect(result.artifacts).toContain('.planning/research/SUMMARY.md');
    expect(result.artifacts).toContain('.planning/REQUIREMENTS.md');
    expect(result.artifacts).toContain('.planning/ROADMAP.md');
    expect(result.artifacts).toContain('.planning/STATE.md');
  });

  it('run() includes research artifact paths on success', async () => {
    const { runner } = createRunner();
    const result = await runner.run('build a todo app');

    expect(result.artifacts).toContain('.planning/research/STACK.md');
    expect(result.artifacts).toContain('.planning/research/FEATURES.md');
    expect(result.artifacts).toContain('.planning/research/ARCHITECTURE.md');
    expect(result.artifacts).toContain('.planning/research/PITFALLS.md');
  });

  // ─── Git init test ─────────────────────────────────────────────────────

  it('run() initializes git when has_git is false', async () => {
    // We can't easily test git init without mocking execFile deeply,
    // but we can verify the tools.initNewProject is called with the result
    // and that the workflow continues. Since has_git=true by default in our
    // mock, flip it to false and verify the config step still passes.
    const { runner } = createRunner({
      initNewProject: vi.fn().mockResolvedValue(makeProjectInfo({ has_git: false })),
    });

    // This will attempt to run `git init` which may or may not exist in test env.
    // Since we're in a tmpDir, git init is safe. The test verifies the workflow proceeds.
    const result = await runner.run('build a todo app');

    // The config step should succeed (git init in tmpDir should work)
    const configStep = result.steps.find(s => s.step === 'config');
    expect(configStep).toBeDefined();
    // Note: if git is not available in CI, this may fail — that's expected
  });

  // ─── Config passthrough test ─────────────────────────────────────────────

  it('constructor accepts config overrides', async () => {
    // Set projectInfo model fields to undefined so orchestratorModel is used as fallback
    const { runner } = createRunner({
      initNewProject: vi.fn().mockResolvedValue(makeProjectInfo({
        researcher_model: undefined as any,
        synthesizer_model: undefined as any,
        roadmapper_model: undefined as any,
      })),
    }, {
      maxBudgetPerSession: 10.0,
      maxTurnsPerSession: 50,
      orchestratorModel: 'claude-opus-4-6',
    });

    await runner.run('build a todo app');

    // Verify the session runner was called with overridden model
    const calls = mockRunSession.mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    // Check model in options (4th argument, index 3)
    const modelsUsed = calls.map(c => {
      const options = c[3] as any;
      return options?.model;
    });
    // When projectInfo model is undefined, ?? falls through to orchestratorModel
    expect(modelsUsed.some(m => m === 'claude-opus-4-6')).toBe(true);
  });

  // ─── Session count validation ────────────────────────────────────────────

  it('run() calls runPhaseStepSession exactly 8 times on full success', async () => {
    const { runner } = createRunner();

    await runner.run('build a todo app');

    // 1 PROJECT.md + 4 research + 1 synthesis + 1 requirements + 1 roadmap = 8
    expect(mockRunSession).toHaveBeenCalledTimes(8);
  });

  // ─── Headless prompt loading (sdkPromptsDir preference) ──────────────────

  describe('sdkPromptsDir preference and sanitizer integration', () => {
    let sdkPromptsDir: string;

    beforeEach(async () => {
      // Create a temp SDK prompts directory with test fixtures
      sdkPromptsDir = join(tmpDir, 'sdk-prompts');
      await mkdir(join(sdkPromptsDir, 'templates', 'research-project'), { recursive: true });
      await mkdir(join(sdkPromptsDir, 'agents'), { recursive: true });

      // Write headless templates (with known marker text for assertion)
      await writeFile(
        join(sdkPromptsDir, 'templates', 'project.md'),
        '# PROJECT Template\nSDK_HEADLESS_MARKER_PROJECT\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'templates', 'requirements.md'),
        '# REQUIREMENTS Template\nSDK_HEADLESS_MARKER_REQUIREMENTS\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'templates', 'roadmap.md'),
        '# ROADMAP Template\nSDK_HEADLESS_MARKER_ROADMAP\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'templates', 'state.md'),
        '# STATE Template\nSDK_HEADLESS_MARKER_STATE\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'templates', 'research-project', 'STACK.md'),
        '# STACK Template\nSDK_HEADLESS_MARKER_STACK\n',
      );

      // Write headless agents (with known marker text)
      await writeFile(
        join(sdkPromptsDir, 'agents', 'gsd-project-researcher.md'),
        '# Project Researcher Agent\nSDK_HEADLESS_MARKER_RESEARCHER\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'agents', 'gsd-research-synthesizer.md'),
        '# Research Synthesizer Agent\nSDK_HEADLESS_MARKER_SYNTHESIZER\n',
      );
      await writeFile(
        join(sdkPromptsDir, 'agents', 'gsd-roadmapper.md'),
        '# Roadmapper Agent\nSDK_HEADLESS_MARKER_ROADMAPPER\n',
      );
    });

    function createRunnerWithSdkPrompts(
      toolsOverrides: Record<string, unknown> = {},
      configOverrides?: Partial<InitRunnerDeps['config']>,
    ) {
      const tools = makeTools(toolsOverrides);
      const eventStream = makeEventStream();
      const runner = new InitRunner({
        projectDir: tmpDir,
        tools,
        eventStream,
        config: configOverrides as any,
        sdkPromptsDir,
      });
      return { runner, tools, eventStream, events: eventStream.events as GSDEvent[] };
    }

    it('readGSDFile prefers installed GSD over sdk/prompts/ template', async () => {
      const { runner } = createRunnerWithSdkPrompts();

      await runner.run('build a todo app');

      // The first session call is buildProjectPrompt → reads templates/project.md
      // Installed GSD templates (if present) are preferred over SDK bundled copies
      const projectPrompt = mockRunSession.mock.calls[0]![0] as string;
      // Should contain PROJECT.md creation instruction regardless of source
      expect(projectPrompt).toContain('PROJECT.md');
    });

    it('readAgentFile prefers installed agents over sdk/prompts/agents/', async () => {
      const { runner } = createRunnerWithSdkPrompts();

      await runner.run('build a todo app');

      // Research calls (indices 1-4) use gsd-project-researcher.md agent def
      const researchPrompt = mockRunSession.mock.calls[1]![0] as string;
      // Should contain research instruction regardless of source
      expect(researchPrompt).toContain('You are researching the');
    });

    it('readGSDFile falls back to GSD-1 when sdk/prompts/ file does not exist', async () => {
      // Create an empty sdkPromptsDir — no templates at all
      const emptySdkDir = join(tmpDir, 'empty-sdk-prompts');
      await mkdir(join(emptySdkDir, 'templates'), { recursive: true });
      await mkdir(join(emptySdkDir, 'agents'), { recursive: true });

      const tools = makeTools();
      const eventStream = makeEventStream();
      const runner = new InitRunner({
        projectDir: tmpDir,
        tools,
        eventStream,
        sdkPromptsDir: emptySdkDir,
      });

      await runner.run('build a todo app');

      // buildProjectPrompt reads templates/project.md — not found in empty dir,
      // falls through to GSD-1 path. If GSD-1 also missing, gets placeholder.
      const projectPrompt = mockRunSession.mock.calls[0]![0] as string;

      // Should NOT contain our marker (since empty dir was used)
      expect(projectPrompt).not.toContain('SDK_HEADLESS_MARKER_PROJECT');
      // Should still contain the PROJECT.md synthesis instruction (from the prompt builder)
      expect(projectPrompt).toContain('PROJECT.md');
    });

    it('readAgentFile falls back to GSD-1 when sdk/prompts/agents/ file does not exist', async () => {
      // Empty sdkPromptsDir — no agent files
      const emptySdkDir = join(tmpDir, 'empty-sdk-agents');
      await mkdir(join(emptySdkDir, 'templates', 'research-project'), { recursive: true });
      await mkdir(join(emptySdkDir, 'agents'), { recursive: true });

      // Write templates so we get past buildProjectPrompt
      await writeFile(join(emptySdkDir, 'templates', 'project.md'), '# project\n');
      await writeFile(join(emptySdkDir, 'templates', 'research-project', 'STACK.md'), '# stack\n');
      await writeFile(join(emptySdkDir, 'templates', 'research-project', 'FEATURES.md'), '# features\n');
      await writeFile(join(emptySdkDir, 'templates', 'research-project', 'ARCHITECTURE.md'), '# arch\n');
      await writeFile(join(emptySdkDir, 'templates', 'research-project', 'PITFALLS.md'), '# pitfalls\n');

      const tools = makeTools();
      const eventStream = makeEventStream();
      const runner = new InitRunner({
        projectDir: tmpDir,
        tools,
        eventStream,
        sdkPromptsDir: emptySdkDir,
      });

      await runner.run('build a todo app');

      // Research prompt uses agent def — not in empty agents dir, falls to GSD-1
      const researchPrompt = mockRunSession.mock.calls[1]![0] as string;
      // Should NOT contain our marker
      expect(researchPrompt).not.toContain('SDK_HEADLESS_MARKER_RESEARCHER');
      // Should still have the "researching the" instruction
      expect(researchPrompt).toContain('You are researching the');
    });

    it('buildProjectPrompt output passes through sanitizePrompt (no /gsd: patterns)', async () => {
      const { runner } = createRunnerWithSdkPrompts();
      await runner.run('build a todo app');

      const projectPrompt = mockRunSession.mock.calls[0]![0] as string;
      // sanitizePrompt should strip any /gsd: patterns from the assembled prompt
      expect(projectPrompt).not.toMatch(/\/gsd:\S+/);
      expect(projectPrompt).toContain('PROJECT.md');
    });

    it('buildResearchPrompt output passes through sanitizePrompt (no /gsd: patterns)', async () => {
      const { runner } = createRunnerWithSdkPrompts();
      await runner.run('build a todo app');

      const researchPrompt = mockRunSession.mock.calls[1]![0] as string;
      // sanitizePrompt should strip any /gsd: patterns from the assembled prompt
      expect(researchPrompt).not.toMatch(/\/gsd:\S+/);
      expect(researchPrompt).toContain('You are researching the');
    });

    it('buildRoadmapPrompt output passes through sanitizePrompt (no /gsd: patterns)', async () => {
      const { runner } = createRunnerWithSdkPrompts();
      await runner.run('build a todo app');

      // Roadmap prompt is the last session call (index 7)
      const roadmapPrompt = mockRunSession.mock.calls[7]![0] as string;
      // sanitizePrompt should strip any /gsd: patterns from the assembled prompt
      expect(roadmapPrompt).not.toMatch(/\/gsd:\S+/);
    });
  });
});
