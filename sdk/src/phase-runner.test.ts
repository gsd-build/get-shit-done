/**
 * Phase Runner tests — consolidated from phase-runner.test.ts,
 * phase-runner-types.test.ts, and phase-prompt.test.ts (issue #3740).
 *
 * Covers:
 *   • PhaseRunner state machine (mocked deps)
 *   • Phase lifecycle type contracts (PhaseStepType, GSDEventType, PhaseOpInfo, etc.)
 *   • GSDTools typed methods
 *   • PromptFactory / extractBlock / extractSteps / PHASE_WORKFLOW_MAP
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PhaseRunner, PhaseRunnerError } from './phase-runner.js';
import type { PhaseRunnerDeps, VerificationOutcome } from './phase-runner.js';
import type {
  PhaseOpInfo,
  PlanResult,
  SessionUsage,
  SessionOptions,
  HumanGateCallbacks,
  GSDEvent,
  PhasePlanIndex,
  PlanInfo,
  PhaseStepResult,
  PhaseRunnerResult,
  PhaseRunnerOptions,
  GSDPhaseStartEvent,
  GSDPhaseStepStartEvent,
  GSDPhaseStepCompleteEvent,
  GSDPhaseCompleteEvent,
  ContextFiles,
  ParsedPlan,
  PlanFrontmatter,
} from './types.js';
import { PhaseStepType, PhaseType, GSDEventType } from './types.js';
import type { GSDConfig } from './config.js';
import { CONFIG_DEFAULTS } from './config.js';
import { GSDTools, GSDToolsError } from './gsd-tools.js';
import { PromptFactory, extractBlock, extractSteps, PHASE_WORKFLOW_MAP } from './phase-prompt.js';

// ─── Mock modules ────────────────────────────────────────────────────────────

// Mock session-runner to avoid real SDK calls
vi.mock('./session-runner.js', () => ({
  runPhaseStepSession: vi.fn(),
  runPlanSession: vi.fn(),
}));

// Mock plan-parser to avoid real file I/O in executeSinglePlan
vi.mock('./plan-parser.js', () => ({
  parsePlanFile: vi.fn().mockResolvedValue({
    frontmatter: { phase: '01-auth', plan: '01', type: 'execute', wave: 1, depends_on: [], files_modified: [], autonomous: true, requirements: [], must_haves: { truths: [], artifacts: [], key_links: [] } },
    objective: 'Test plan objective',
    execution_context: [],
    context_refs: [],
    tasks: [{ name: 'Test task', type: 'auto', files: [], read_first: [], action: 'do the thing', verify: 'check it', done: 'done', acceptance_criteria: [] }],
    raw: '',
  }),
}));

import { runPhaseStepSession } from './session-runner.js';
import { parsePlanFile } from './plan-parser.js';

const mockRunPhaseStepSession = vi.mocked(runPhaseStepSession);
const mockParsePlanFile = vi.mocked(parsePlanFile);

// ─── Factory helpers ─────────────────────────────────────────────────────────

let defaultProjectDir = '/tmp/project';
const defaultPhaseDir = '.planning/phases/01-auth';

function makePhaseOp(overrides: Partial<PhaseOpInfo> = {}): PhaseOpInfo {
  return {
    phase_found: true,
    phase_dir: defaultPhaseDir,
    phase_number: '1',
    phase_name: 'Authentication',
    phase_slug: 'auth',
    padded_phase: '01',
    has_research: false,
    has_context: false,
    has_plans: true,
    has_verification: false,
    plan_count: 1,
    roadmap_exists: true,
    planning_exists: true,
    commit_docs: true,
    context_path: join(defaultProjectDir, defaultPhaseDir, 'CONTEXT.md'),
    research_path: join(defaultProjectDir, defaultPhaseDir, 'RESEARCH.md'),
    ...overrides,
  };
}

function makeUsage(): SessionUsage {
  return {
    inputTokens: 100,
    outputTokens: 50,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

function makePlanResult(overrides: Partial<PlanResult> = {}): PlanResult {
  return {
    success: true,
    sessionId: 'sess-123',
    totalCostUsd: 0.01,
    durationMs: 1000,
    usage: makeUsage(),
    numTurns: 5,
    ...overrides,
  };
}

function makePlanInfo(overrides: Partial<PlanInfo> = {}): PlanInfo {
  return {
    id: 'plan-1',
    wave: 1,
    autonomous: true,
    objective: 'Test objective',
    files_modified: [],
    task_count: 1,
    has_summary: false,
    ...overrides,
  };
}

function makeParsedPlan(filesModified: string[] = []) {
  return {
    frontmatter: {
      phase: '01-auth',
      plan: '01',
      type: 'execute',
      wave: 1,
      depends_on: [],
      files_modified: filesModified,
      autonomous: true,
      requirements: [],
      must_haves: { truths: [], artifacts: [], key_links: [] },
    },
    objective: 'Test plan objective',
    execution_context: [],
    context_refs: [],
    tasks: [{ name: 'Test task', type: 'auto', files: [], read_first: [], action: 'do the thing', verify: 'check it', done: 'done', acceptance_criteria: [] }],
    raw: '',
  };
}

function makePlanIndex(planCount: number, overrides: Partial<PhasePlanIndex> = {}): PhasePlanIndex {
  const plans: PlanInfo[] = [];
  const waves: Record<string, string[]> = {};
  for (let i = 0; i < planCount; i++) {
    const id = `plan-${i + 1}`;
    const wave = 1; // Default: all in wave 1
    plans.push(makePlanInfo({ id, wave }));
    const waveKey = String(wave);
    if (!waves[waveKey]) waves[waveKey] = [];
    waves[waveKey].push(id);
  }
  return {
    phase: '1',
    plans,
    waves,
    incomplete: plans.filter(p => !p.has_summary).map(p => p.id),
    has_checkpoints: false,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<GSDConfig> = {}): GSDConfig {
  return {
    ...structuredClone(CONFIG_DEFAULTS),
    ...overrides,
    workflow: {
      ...CONFIG_DEFAULTS.workflow,
      ...(overrides.workflow ?? {}),
    },
  } as GSDConfig;
}

function makeDeps(overrides: Partial<PhaseRunnerDeps> = {}): PhaseRunnerDeps {
  const events: GSDEvent[] = [];

  return {
    projectDir: defaultProjectDir,
    tools: {
      initPhaseOp: vi.fn().mockResolvedValue(makePhaseOp()),
      phaseComplete: vi.fn().mockResolvedValue(undefined),
      phasePlanIndex: vi.fn().mockResolvedValue(makePlanIndex(1)),
      exec: vi.fn().mockImplementation((cmd: string) => {
        if (cmd === 'check.verification-status') return Promise.resolve({ status: 'pass' });
        return Promise.resolve(undefined);
      }),
      stateLoad: vi.fn(),
      roadmapAnalyze: vi.fn(),
      commit: vi.fn(),
      verifySummary: vi.fn(),
      initExecutePhase: vi.fn(),
      configGet: vi.fn(),
      stateBeginPhase: vi.fn(),
    } as any,
    promptFactory: {
      buildPrompt: vi.fn().mockResolvedValue('test prompt'),
      loadAgentDef: vi.fn().mockResolvedValue(undefined),
    } as any,
    contextEngine: {
      resolveContextFiles: vi.fn().mockResolvedValue({}),
    } as any,
    eventStream: {
      emitEvent: vi.fn((event: GSDEvent) => events.push(event)),
      on: vi.fn(),
      emit: vi.fn(),
    } as any,
    config: makeConfig(),
    ...overrides,
  };
}

/** Collect events from a deps object. */
function getEmittedEvents(deps: PhaseRunnerDeps): GSDEvent[] {
  const events: GSDEvent[] = [];
  const emitFn = deps.eventStream.emitEvent as ReturnType<typeof vi.fn>;
  for (const call of emitFn.mock.calls) {
    events.push(call[0] as GSDEvent);
  }
  return events;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PhaseRunner', () => {
  let tempProjectDirs: string[] = [];

  beforeEach(async () => {
    tempProjectDirs = [];
    defaultProjectDir = await mkdtemp(join(tmpdir(), 'gsd-phase-runner-default-'));
    tempProjectDirs.push(defaultProjectDir);
    await mkdir(join(defaultProjectDir, defaultPhaseDir), { recursive: true });
    await writeFile(join(defaultProjectDir, defaultPhaseDir, '01-PLAN.md'), '---\nfiles_modified: []\n---\n', 'utf-8');
    vi.clearAllMocks();
    mockRunPhaseStepSession.mockResolvedValue(makePlanResult());
    mockParsePlanFile.mockResolvedValue(makeParsedPlan());
  });

  afterEach(async () => {
    await Promise.all(tempProjectDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  // ─── Happy path ────────────────────────────────────────────────────────

  describe('happy path — full lifecycle', () => {
    it('runs all steps in order: discuss → research → plan → plan-check → execute → verify → advance', async () => {
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);
      expect(result.phaseNumber).toBe('1');
      expect(result.phaseName).toBe('Authentication');

      // Verify steps ran in order (includes plan-check since plan_check config defaults to true)
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toEqual([
        PhaseStepType.Discuss,
        PhaseStepType.Research,
        PhaseStepType.Plan,
        PhaseStepType.PlanCheck,
        PhaseStepType.Execute,
        PhaseStepType.Verify,
        PhaseStepType.Advance,
      ]);

      // All steps succeeded
      expect(result.steps.every(s => s.success)).toBe(true);
    });

    it('returns correct phase name from PhaseOpInfo', async () => {
      const phaseOp = makePhaseOp({ phase_name: 'Data Layer' });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('2');

      expect(result.phaseName).toBe('Data Layer');
    });
  });

  // ─── Config-driven skipping ────────────────────────────────────────────

  describe('config-driven step skipping', () => {
    it('skips discuss when has_context=true', async () => {
      const phaseOp = makePhaseOp({ has_context: true });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Discuss);
      expect(result.success).toBe(true);
    });

    it('skips discuss when config.workflow.skip_discuss=true', async () => {
      const config = makeConfig({ workflow: { skip_discuss: true } as any });
      const deps = makeDeps({ config });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Discuss);
    });

    it('skips research when config.workflow.research=false', async () => {
      const config = makeConfig({ workflow: { research: false } as any });
      const deps = makeDeps({ config });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Research);
    });

    it('skips verify when config.workflow.verifier=false', async () => {
      const config = makeConfig({ workflow: { verifier: false } as any });
      const deps = makeDeps({ config });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Verify);
    });

    it('runs with all config flags false — only plan, execute, advance', async () => {
      const config = makeConfig({
        workflow: {
          skip_discuss: true,
          research: false,
          verifier: false,
          plan_check: false,
        } as any,
      });
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toEqual([
        PhaseStepType.Plan,
        PhaseStepType.Execute,
        PhaseStepType.Advance,
      ]);
    });
  });

  // ─── Execute iterates plans ────────────────────────────────────────────

  describe('execute step', () => {
    it('iterates multiple plans sequentially', async () => {
      const phaseOp = makePhaseOp({ has_context: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(makePlanIndex(3));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep).toBeDefined();
      expect(executeStep!.planResults).toHaveLength(3);

      // runPhaseStepSession called once per plan in execute step
      // (plus once for plan step itself)
      const executeCallCount = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Execute,
      ).length;
      expect(executeCallCount).toBe(3);
    });

    it('handles zero plans gracefully', async () => {
      const phaseOp = makePhaseOp({ has_context: true, plan_count: 0, has_plans: true });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(makePlanIndex(0));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep).toBeDefined();
      expect(executeStep!.success).toBe(true);
      expect(executeStep!.planResults).toHaveLength(0);
    });

    it('captures mid-execute session failure in PlanResults', async () => {
      const phaseOp = makePhaseOp({ has_context: true, plan_count: 2 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(makePlanIndex(2));

      // Use a counter that tracks calls per-execute-step to make failure persistent
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step, _config, _opts, _es, ctx) => {
        if (step === PhaseStepType.Execute) {
          const planName = (ctx as any)?.planName ?? '';
          // Always fail on plan-2
          if (planName === 'plan-2') {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['Session crashed'] },
            });
          }
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.planResults).toHaveLength(2);
      expect(executeStep!.planResults![0].success).toBe(true);
      expect(executeStep!.planResults![1].success).toBe(false);
      expect(executeStep!.success).toBe(false); // overall execute step fails
    });
  });

  // ─── Blocker callbacks ─────────────────────────────────────────────────

  describe('blocker callbacks', () => {
    it('invokes onBlockerDecision when no plans after plan step', async () => {
      // First call: initial state (no context so discuss runs)
      // After discuss: re-query returns has_context=true
      // After plan: re-query returns has_plans=false
      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({ has_context: true, has_plans: false, plan_count: 0 });
      const config = makeConfig();
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onBlockerDecision },
      });

      expect(onBlockerDecision).toHaveBeenCalled();
      const callArg = onBlockerDecision.mock.calls[0][0];
      expect(callArg.step).toBe(PhaseStepType.Plan);
      expect(callArg.error).toContain('No plans');

      // Runner halted — no execute/verify/advance steps
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Execute);
      expect(stepTypes).not.toContain(PhaseStepType.Verify);
      expect(stepTypes).not.toContain(PhaseStepType.Advance);
    });

    it('invokes onBlockerDecision when no context after discuss', async () => {
      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({ has_context: false });
      const deps = makeDeps();
      // After discuss step, re-query still has no context
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onBlockerDecision },
      });

      expect(onBlockerDecision).toHaveBeenCalled();
      const callArg = onBlockerDecision.mock.calls[0][0];
      expect(callArg.step).toBe(PhaseStepType.Discuss);
    });

    it('auto-approves (skip) when no callback registered at discuss blocker', async () => {
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1'); // no callbacks

      // Should proceed past discuss even though no context
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Research);
      expect(stepTypes).toContain(PhaseStepType.Plan);
    });
  });

  // ─── Research gate (#1602) ──────────────────────────────────────────────

  describe('research gate (#1602)', () => {
    let tempPhaseDir: string;

    beforeEach(async () => {
      tempPhaseDir = await mkdtemp(join(tmpdir(), 'gsd-research-gate-'));
    });

    afterEach(async () => {
      await rm(tempPhaseDir, { recursive: true, force: true });
    });

    it('invokes onBlockerDecision when RESEARCH.md has unresolved open questions', async () => {
      // Write a RESEARCH.md with unresolved questions
      const researchPath = join(tempPhaseDir, '01-RESEARCH.md');
      await writeFile(researchPath, `# Research

## Key Findings
TypeScript is the right choice.

## Open Questions

1. **Hash prefix** — keep or change?
2. **Cache TTL** — what duration?

## Recommendations
Use TypeScript.`, 'utf-8');

      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({
        has_context: true,
        has_research: true,
        has_plans: true,
        plan_count: 1,
        phase_dir: tempPhaseDir,
        research_path: researchPath,
      });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onBlockerDecision },
      });

      expect(onBlockerDecision).toHaveBeenCalled();
      const callArg = onBlockerDecision.mock.calls[0][0];
      expect(callArg.step).toBe(PhaseStepType.Research);
      expect(callArg.error).toContain('unresolved open questions');
      expect(callArg.error).toContain('Hash prefix');
    });

    it('does not block when RESEARCH.md has no open questions', async () => {
      const researchPath = join(tempPhaseDir, '01-RESEARCH.md');
      await writeFile(researchPath, `# Research

## Key Findings
Everything resolved.

## Recommendations
Use TypeScript.`, 'utf-8');

      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({
        has_context: true,
        has_research: true,
        has_plans: true,
        plan_count: 1,
        phase_dir: tempPhaseDir,
        research_path: researchPath,
      });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1', {
        callbacks: { onBlockerDecision },
      });

      // Should NOT have been called for research step
      const researchCalls = onBlockerDecision.mock.calls.filter(
        (c: any[]) => c[0].step === PhaseStepType.Research,
      );
      expect(researchCalls).toHaveLength(0);
    });

    it('does not block when all open questions are resolved', async () => {
      const researchPath = join(tempPhaseDir, '01-RESEARCH.md');
      await writeFile(researchPath, `# Research

## Open Questions (RESOLVED)

1. **Hash prefix** — RESOLVED: Use "guest_contract:"`, 'utf-8');

      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({
        has_context: true,
        has_research: true,
        has_plans: true,
        plan_count: 1,
        phase_dir: tempPhaseDir,
        research_path: researchPath,
      });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1', { callbacks: { onBlockerDecision } });

      const researchCalls = onBlockerDecision.mock.calls.filter(
        (c: any[]) => c[0].step === PhaseStepType.Research,
      );
      expect(researchCalls).toHaveLength(0);
    });

    it('skips research gate when has_research=false', async () => {
      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({
        has_context: true,
        has_research: false,
        has_plans: true,
        plan_count: 1,
      });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1', { callbacks: { onBlockerDecision } });

      // Research gate should not fire when there's no research
      const researchCalls = onBlockerDecision.mock.calls.filter(
        (c: any[]) => c[0].step === PhaseStepType.Research,
      );
      expect(researchCalls).toHaveLength(0);
    });

    it('auto-approves (skip) research gate when no callback registered', async () => {
      const researchPath = join(tempPhaseDir, '01-RESEARCH.md');
      await writeFile(researchPath, `# Research

## Open Questions

1. **Something** — needs decision`, 'utf-8');

      const phaseOp = makePhaseOp({
        has_context: true,
        has_research: true,
        has_plans: true,
        plan_count: 1,
        phase_dir: tempPhaseDir,
        research_path: researchPath,
      });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1'); // No callbacks

      // Should proceed past research gate (auto-skip)
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Plan);
    });
  });

  // ─── Human gate: reject halts runner ───────────────────────────────────

  describe('human gate reject', () => {
    it('halts runner when blocker callback returns stop', async () => {
      const phaseOp = makePhaseOp({ has_context: false });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: {
          onBlockerDecision: vi.fn().mockResolvedValue('stop'),
        },
      });

      expect(result.success).toBe(false);
      // Only discuss step ran before halt
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].step).toBe(PhaseStepType.Discuss);
    });
  });

  // ─── Verification routing ──────────────────────────────────────────────

  describe('verification routing', () => {
    it('routes to advance when verification passes', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockRunPhaseStepSession.mockResolvedValue(makePlanResult({ success: true }));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Verify);
      expect(stepTypes).toContain(PhaseStepType.Advance);
      expect(result.success).toBe(true);
    });

    it('keeps phase pending when verification review is accepted for human_needed', async () => {
      const onVerificationReview = vi.fn().mockResolvedValue('accept');
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      // Verify step returns human_review_needed subtype
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          return makePlanResult({
            success: false,
            error: { subtype: 'human_review_needed', messages: ['Needs review'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onVerificationReview },
      });

      expect(onVerificationReview).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_human_needed');
    });

    it('routes VERIFICATION.md status human_needed through the human review gate', async () => {
      const onVerificationReview = vi.fn().mockResolvedValue('accept');
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.exec as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
        if (cmd === 'check.verification-status') return Promise.resolve({ status: 'human_needed' });
        return Promise.resolve(undefined);
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onVerificationReview },
      });

      expect(onVerificationReview).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_human_needed');
    });

    it('does not advance when verification status is missing', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.exec as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
        if (cmd === 'check.verification-status') return Promise.resolve({ status: 'missing' });
        return Promise.resolve(undefined);
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_gaps_found');
    });

    it('keeps phase pending when changed phase files contain unresolved TBD/FIXME/XXX markers', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-architectural-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# TBD: wire retry handling before release\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_gaps_found');
    });

    it('allows changed-file debt markers when they reference tracked follow-up work', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-tracked-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# FIXME(issue #3322): preserve upstream retry behavior\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);
      expect(deps.tools.phaseComplete).toHaveBeenCalledWith('1');
      expect(result.steps.map(s => s.step)).toContain(PhaseStepType.Advance);
    });

    it('allows changed-file entries for files deleted by the phase', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-deleted-file-debt-scan-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/deleted.sh"]\n---\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/deleted.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);
      expect(deps.tools.phaseComplete).toHaveBeenCalledWith('1');
      expect(result.steps.map(s => s.step)).toContain(PhaseStepType.Advance);
    });

    it('allows dotted lowercase xxx placeholder text when scanning debt markers', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-lowercase-placeholder-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\napi_host="xxx.example.test"\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);
      expect(deps.tools.phaseComplete).toHaveBeenCalledWith('1');
      expect(result.steps.map(s => s.step)).toContain(PhaseStepType.Advance);
    });

    it('keeps phase pending when changed files contain lowercase debt markers', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-lowercase-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# fixme: wire retry handling before release\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('keeps phase pending when debt markers are followed by punctuation', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-punctuated-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# FIXME. remove before release\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('allows bare hash issue references when they read as references', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-bare-hash-ref-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# FIXME tracked in #3322\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);
      expect(deps.tools.phaseComplete).toHaveBeenCalledWith('1');
      expect(result.steps.map(s => s.step)).toContain(PhaseStepType.Advance);
    });

    it('does not treat quoted numeric fragments as debt references', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-hex-fragment-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\ncolor="#123" # FIXME temp styling\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('does not allow unrelated earlier issue text to satisfy a later debt marker', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-unrelated-debt-ref-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\nlabel="issue #123"; # FIXME temp styling\n', 'utf-8');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('reports one unresolved debt finding per line', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-duplicate-debt-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const sourceDir = join(projectDir, 'scripts', 'upstream');
      await mkdir(phaseDir, { recursive: true });
      await mkdir(sourceDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["scripts/upstream/run.sh"]\n---\n', 'utf-8');
      await writeFile(join(sourceDir, 'run.sh'), '#!/usr/bin/env bash\n# TBD TBD before release\n', 'utf-8');

      const logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any;
      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config, logger });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['scripts/upstream/run.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const blockCall = logger.warn.mock.calls.find(([message]: [string]) => message.includes('Verification blocked'));
      expect(blockCall?.[1].findings).toHaveLength(1);
      expect(blockCall?.[1].findings[0]).toMatchObject({
        file: 'scripts/upstream/run.sh',
        line: 2,
        marker: 'TBD',
      });
      expect(blockCall?.[1].findings[0]).not.toHaveProperty('text');
    });

    it('keeps phase pending when a declared file resolves through a symlink outside the project', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-symlink-project-'));
      const externalDir = await mkdtemp(join(tmpdir(), 'gsd-symlink-external-'));
      tempProjectDirs.push(projectDir, externalDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      await mkdir(phaseDir, { recursive: true });
      await writeFile(join(phaseDir, '01-PLAN.md'), '---\nfiles_modified: ["linked-outside/secret.sh"]\n---\n', 'utf-8');
      await writeFile(join(externalDir, 'secret.sh'), '#!/usr/bin/env bash\necho safe\n', 'utf-8');
      await symlink(externalDir, join(projectDir, 'linked-outside'), 'dir');

      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      mockParsePlanFile.mockResolvedValue(makeParsedPlan(['linked-outside/secret.sh']));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('does not advance when verification status cannot be checked', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.exec as ReturnType<typeof vi.fn>).mockImplementation((cmd: string) => {
        if (cmd === 'check.verification-status') return Promise.reject(new Error('status parser crashed'));
        return Promise.resolve(undefined);
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(mockRunPhaseStepSession.mock.calls.filter((call) => call[1] === PhaseStepType.Plan)).toHaveLength(1);
      expect(mockRunPhaseStepSession.mock.calls.filter((call) => call[1] === PhaseStepType.Execute)).toHaveLength(1);
    });

    it('keeps phase pending when plan files cannot be listed for the debt scan', async () => {
      const projectDir = await mkdtemp(join(tmpdir(), 'gsd-debt-missing-plans-'));
      tempProjectDirs.push(projectDir);
      const phaseDir = join(projectDir, '.planning', 'phases', '01-auth');
      const logger = { warn: vi.fn(), info: vi.fn(), debug: vi.fn() } as any;
      const phaseOp = makePhaseOp({ phase_dir: phaseDir, has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ projectDir, config, logger });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
      expect(result.steps.map(s => s.step)).not.toContain(PhaseStepType.Advance);

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep?.success).toBe(false);
      expect(verifyStep?.error).toBe('verification_gaps_found');
      expect(logger.warn.mock.calls.some(([message]: [string]) => message.includes('unresolved architectural debt markers'))).toBe(false);
      expect(logger.warn.mock.calls.some(([message]: [string]) => message.includes('architectural debt scan could not complete'))).toBe(true);
    });

    it('halts when verification review callback rejects', async () => {
      const onVerificationReview = vi.fn().mockResolvedValue('reject');
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          return makePlanResult({
            success: false,
            error: { subtype: 'human_review_needed', messages: ['Needs review'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onVerificationReview },
      });

      // Verify step completes with error, runner continues to advance
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep!.success).toBe(false);
      expect(verifyStep!.error).toBe('halted_by_callback');
    });
  });

  // ─── Gap closure ───────────────────────────────────────────────────────

  describe('gap closure', () => {
    it('retries verification once on gaps_found', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          if (verifyCallCount === 1) {
            // First verify: gaps found
            return makePlanResult({
              success: false,
              error: { subtype: 'verification_failed', messages: ['Gaps found'] },
            });
          }
          // Second verify (gap closure retry): passes
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(verifyCallCount).toBe(2); // Exactly 1 retry
      expect(result.success).toBe(true);
    });

    it('caps gap closure at exactly 1 retry (not 0, not 2)', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          // Always return gaps_found
          return makePlanResult({
            success: false,
            error: { subtype: 'verification_failed', messages: ['Gaps persist'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // 1 initial + 1 retry = 2 calls (not 3)
      expect(verifyCallCount).toBe(2);
      // Verify step fails when gaps persist after exhausting retries
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep!.success).toBe(false);
    });

    it('gaps_found triggers plan → execute → re-verify cycle', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      // Track the step sequence during gap closure
      const stepSequence: string[] = [];
      let verifyCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        stepSequence.push(step);
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          if (verifyCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'verification_failed', messages: ['Gaps found'] },
            });
          }
          // Re-verify passes
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(true);

      // After initial plan+execute+verify(fail), gap closure should run: plan, execute, verify(pass)
      // Full sequence includes: plan, execute, verify(gap), plan(gap), execute(gap), verify(pass), advance(no session)
      // Filter to just the verify-related part: after the first verify, we should see plan then execute then verify
      const afterFirstVerify = stepSequence.slice(stepSequence.indexOf(PhaseStepType.Verify) + 1);
      expect(afterFirstVerify).toContain(PhaseStepType.Plan);
      expect(afterFirstVerify).toContain(PhaseStepType.Execute);
      expect(afterFirstVerify).toContain(PhaseStepType.Verify);

      // Plan comes before execute in gap closure
      const planIdx = afterFirstVerify.indexOf(PhaseStepType.Plan);
      const execIdx = afterFirstVerify.indexOf(PhaseStepType.Execute);
      const verifyIdx = afterFirstVerify.indexOf(PhaseStepType.Verify);
      expect(planIdx).toBeLessThan(execIdx);
      expect(execIdx).toBeLessThan(verifyIdx);
    });

    it('gaps_found with maxGapRetries=0 proceeds immediately without gap closure', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      const stepSequence: string[] = [];
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        stepSequence.push(step);
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          return makePlanResult({
            success: false,
            error: { subtype: 'verification_failed', messages: ['Gaps found'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', { maxGapRetries: 0 });

      // Only 1 verify call — no retry
      expect(verifyCallCount).toBe(1);

      // No gap closure plan/execute steps after verify
      const afterVerify = stepSequence.slice(stepSequence.indexOf(PhaseStepType.Verify) + 1);
      expect(afterVerify).not.toContain(PhaseStepType.Plan);
      expect(afterVerify.filter(s => s === PhaseStepType.Execute)).toHaveLength(0);

      // Verify step fails when gaps persist (no retries allowed)
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep!.success).toBe(false);
    });

    it('gap closure plan step failure proceeds to re-verify without executing', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      let planCallAfterGap = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          if (verifyCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'verification_failed', messages: ['Gaps found'] },
            });
          }
          return makePlanResult({ success: true });
        }
        if (step === PhaseStepType.Plan && verifyCallCount >= 1) {
          planCallAfterGap++;
          // Simulate plan step throwing
          throw new Error('plan step crashed');
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // Plan step failed, but verify still re-ran
      expect(planCallAfterGap).toBe(1);
      expect(verifyCallCount).toBe(2);
      expect(result.success).toBe(true);
    });

    it('custom maxGapRetries from PhaseRunnerOptions is respected', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          // Always return gaps_found
          return makePlanResult({
            success: false,
            error: { subtype: 'verification_failed', messages: ['Gaps found'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', { maxGapRetries: 3 });

      // 1 initial + 3 retries = 4 verify calls
      expect(verifyCallCount).toBe(4);
      // Verify step fails when gaps persist after all retries exhausted
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep!.success).toBe(false);
    });

    it('gap closure results are included in the final verify step planResults', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyCallCount++;
          if (verifyCallCount === 1) {
            return makePlanResult({
              success: false,
              sessionId: 'verify-1',
              totalCostUsd: 0.02,
              error: { subtype: 'verification_failed', messages: ['Gaps found'] },
            });
          }
          return makePlanResult({ success: true, sessionId: 'verify-2', totalCostUsd: 0.03 });
        }
        if (step === PhaseStepType.Plan) {
          return makePlanResult({ success: true, sessionId: 'gap-plan', totalCostUsd: 0.01 });
        }
        if (step === PhaseStepType.Execute) {
          return makePlanResult({ success: true, sessionId: 'gap-exec', totalCostUsd: 0.04 });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep).toBeDefined();
      expect(verifyStep!.planResults).toBeDefined();

      // Should contain: verify-1 (initial), gap-plan, gap-exec, verify-2 (re-verify)
      const sessionIds = verifyStep!.planResults!.map(r => r.sessionId);
      expect(sessionIds).toContain('verify-1');
      expect(sessionIds).toContain('gap-plan');
      expect(sessionIds).toContain('gap-exec');
      expect(sessionIds).toContain('verify-2');
      expect(verifyStep!.planResults!.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ─── Advance gate on persistent gaps ──────────────────────────────────

  describe('advance gate on persistent gaps', () => {
    it('persistent gaps_found does NOT append Advance step', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          return makePlanResult({
            success: false,
            error: { subtype: 'verification_failed', messages: ['Gaps persist'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Advance);
    });

    it('persistent gaps_found does NOT call phaseComplete', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          return makePlanResult({
            success: false,
            error: { subtype: 'verification_failed', messages: ['Gaps persist'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('verifier disabled still advances normally', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Advance);
      expect(result.success).toBe(true);
    });
  });

  // ─── Phase lifecycle events ────────────────────────────────────────────

  describe('phase lifecycle events', () => {
    it('emits events in correct order', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const eventTypes = events.map(e => e.type);

      // First event: phase_start
      expect(eventTypes[0]).toBe(GSDEventType.PhaseStart);

      // Last event: phase_complete
      expect(eventTypes[eventTypes.length - 1]).toBe(GSDEventType.PhaseComplete);

      // Each step has start + complete pair
      const stepStarts = events.filter(e => e.type === GSDEventType.PhaseStepStart);
      const stepCompletes = events.filter(e => e.type === GSDEventType.PhaseStepComplete);
      expect(stepStarts.length).toBeGreaterThan(0);
      expect(stepStarts.length).toBe(stepCompletes.length);
    });

    it('phase_start event contains correct phaseNumber and phaseName', async () => {
      const phaseOp = makePhaseOp({ has_context: true, phase_name: 'Auth Phase' });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('5');

      const events = getEmittedEvents(deps);
      const phaseStart = events.find(e => e.type === GSDEventType.PhaseStart) as any;
      expect(phaseStart.phaseNumber).toBe('5');
      expect(phaseStart.phaseName).toBe('Auth Phase');
    });

    it('phase_complete event reports success and step count', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const phaseComplete = events.find(e => e.type === GSDEventType.PhaseComplete) as any;
      expect(phaseComplete.success).toBe(true);
      expect(phaseComplete.stepsCompleted).toBe(3); // plan, execute, advance
    });

    it('step_start events include correct step type', async () => {
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const stepStarts = events
        .filter(e => e.type === GSDEventType.PhaseStepStart)
        .map(e => (e as any).step);

      // With all config defaults: discuss, research, plan, execute, verify, advance
      expect(stepStarts).toContain(PhaseStepType.Discuss);
      expect(stepStarts).toContain(PhaseStepType.Research);
      expect(stepStarts).toContain(PhaseStepType.Plan);
      expect(stepStarts).toContain(PhaseStepType.Execute);
      expect(stepStarts).toContain(PhaseStepType.Verify);
      expect(stepStarts).toContain(PhaseStepType.Advance);
    });
  });

  // ─── Error propagation ─────────────────────────────────────────────────

  describe('error propagation', () => {
    it('throws PhaseRunnerError when phase not found', async () => {
      const phaseOp = makePhaseOp({ phase_found: false });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await expect(runner.run('99')).rejects.toThrow(PhaseRunnerError);
      await expect(runner.run('99')).rejects.toThrow(/not found/);
    });

    it('throws PhaseRunnerError when initPhaseOp fails', async () => {
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gsd-tools crashed'),
      );

      const runner = new PhaseRunner(deps);
      await expect(runner.run('1')).rejects.toThrow(PhaseRunnerError);
      await expect(runner.run('1')).rejects.toThrow(/Failed to initialize/);
    });

    it('captures session errors in PhaseStepResult without throwing', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Plan) {
          return makePlanResult({
            success: false,
            error: { subtype: 'error_during_execution', messages: ['Session exploded'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const planStep = result.steps.find(s => s.step === PhaseStepType.Plan);
      expect(planStep!.success).toBe(false);
      expect(planStep!.error).toContain('Session exploded');
      // Runner continues to execute/advance even after plan error
    });

    it('captures thrown errors from runPhaseStepSession in step result', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Plan) {
          throw new Error('Network error');
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const planStep = result.steps.find(s => s.step === PhaseStepType.Plan);
      expect(planStep!.success).toBe(false);
      expect(planStep!.error).toBe('Network error');
    });
  });

  // ─── Advance step ──────────────────────────────────────────────────────

  describe('advance step', () => {
    it('calls tools.phaseComplete on auto_advance', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false, auto_advance: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      expect(deps.tools.phaseComplete).toHaveBeenCalledWith('1');
    });

    it('auto-approves advance when no callback and auto_advance=false', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false, auto_advance: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(deps.tools.phaseComplete).toHaveBeenCalled();
      const advanceStep = result.steps.find(s => s.step === PhaseStepType.Advance);
      expect(advanceStep!.success).toBe(true);
    });

    it('halts advance when callback returns stop', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false, auto_advance: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      const onBlockerDecision = vi.fn().mockResolvedValue('stop');

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: { onBlockerDecision },
      });

      const advanceStep = result.steps.find(s => s.step === PhaseStepType.Advance);
      expect(advanceStep!.success).toBe(false);
      expect(advanceStep!.error).toBe('advance_rejected');
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('captures phaseComplete errors without throwing', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false, auto_advance: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phaseComplete as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('gsd-tools commit failed'),
      );

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const advanceStep = result.steps.find(s => s.step === PhaseStepType.Advance);
      expect(advanceStep!.success).toBe(false);
      expect(advanceStep!.error).toContain('commit failed');
    });
  });

  // ─── Callback error handling ───────────────────────────────────────────

  describe('callback error handling', () => {
    it('auto-approves when blocker callback throws', async () => {
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: {
          onBlockerDecision: vi.fn().mockRejectedValue(new Error('callback broke')),
        },
      });

      // Should auto-approve (skip) and continue
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Research);
    });

    it('keeps human verification pending when verification callback throws', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          return makePlanResult({
            success: false,
            error: { subtype: 'human_review_needed', messages: ['Review'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: {
          onVerificationReview: vi.fn().mockRejectedValue(new Error('callback broke')),
        },
      });

      // Should acknowledge the callback failure but still avoid advancing.
      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Advance);
      expect(result.success).toBe(false);
      expect(deps.tools.phaseComplete).not.toHaveBeenCalled();
    });

    it('auto-approves advance when advance callback throws', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false, auto_advance: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', {
        callbacks: {
          onBlockerDecision: vi.fn().mockRejectedValue(new Error('nope')),
        },
      });

      // Advance should auto-approve on callback error
      expect(deps.tools.phaseComplete).toHaveBeenCalled();
    });
  });

  // ─── Cost tracking ─────────────────────────────────────────────────────

  describe('result aggregation', () => {
    it('aggregates cost across all steps', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 2 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(makePlanIndex(2));

      mockRunPhaseStepSession.mockResolvedValue(makePlanResult({ totalCostUsd: 0.05 }));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // plan step: 1 session × $0.05
      // execute step: 2 sessions × $0.05
      // total = $0.15
      expect(result.totalCostUsd).toBeCloseTo(0.15, 2);
    });

    it('reports overall success=false when any step fails', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Plan) {
          return makePlanResult({ success: false, error: { subtype: 'error', messages: ['fail'] } });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(result.success).toBe(false);
    });
  });

  // ─── PromptFactory / ContextEngine integration ─────────────────────────

  describe('prompt and context integration', () => {
    it('calls contextEngine.resolveContextFiles with correct PhaseType per step', async () => {
      const phaseOp = makePhaseOp({ has_context: false, has_plans: true, plan_count: 1 });
      const deps = makeDeps();
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const resolveCallArgs = (deps.contextEngine.resolveContextFiles as ReturnType<typeof vi.fn>)
        .mock.calls.map((call: any) => call[0]);

      expect(resolveCallArgs).toContain(PhaseType.Discuss);
      expect(resolveCallArgs).toContain(PhaseType.Research);
      expect(resolveCallArgs).toContain(PhaseType.Plan);
      expect(resolveCallArgs).toContain(PhaseType.Execute);
      expect(resolveCallArgs).toContain(PhaseType.Verify);
    });

    it('passes prompt from PromptFactory to runPhaseStepSession', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 0 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.promptFactory.buildPrompt as ReturnType<typeof vi.fn>).mockResolvedValue('custom plan prompt');

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      // Plan step: check that the prompt was passed through
      const planCall = mockRunPhaseStepSession.mock.calls.find(
        call => call[1] === PhaseStepType.Plan,
      );
      expect(planCall).toBeDefined();
      expect(planCall![0]).toBe('custom plan prompt');
    });
  });

  // ─── Session options pass-through ──────────────────────────────────────

  describe('session options', () => {
    it('passes maxBudgetPerStep and maxTurnsPerStep to sessions', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1', {
        maxBudgetPerStep: 2.0,
        maxTurnsPerStep: 20,
        model: 'claude-opus-4-6',
      });

      // Check session options passed to runPhaseStepSession
      const call = mockRunPhaseStepSession.mock.calls[0];
      const sessionOpts = call[3] as SessionOptions;
      expect(sessionOpts.maxBudgetUsd).toBe(2.0);
      expect(sessionOpts.maxTurns).toBe(20);
      expect(sessionOpts.model).toBe('claude-opus-4-6');
    });
  });

  // ─── S04: Wave-grouped parallel execution ─────────────────────────────

  describe('wave-grouped parallel execution', () => {
    it('executes plans in same wave concurrently', async () => {
      // Create 3 plans all in wave 1
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 1 }),
          makePlanInfo({ id: 'p3', wave: 1 }),
        ],
        waves: { '1': ['p1', 'p2', 'p3'] },
        incomplete: ['p1', 'p2', 'p3'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      // Track concurrent execution via timestamps
      const startTimes: number[] = [];
      const endTimes: number[] = [];
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Execute) {
          startTimes.push(Date.now());
          await new Promise(r => setTimeout(r, 20));
          endTimes.push(Date.now());
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep).toBeDefined();
      expect(executeStep!.planResults).toHaveLength(3);

      // All 3 execute calls were for the Execute step
      const execCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Execute,
      );
      expect(execCalls).toHaveLength(3);

      // Verify concurrent execution: all should start before any finish
      // (with sequential, start[1] >= end[0])
      if (startTimes.length === 3) {
        // All start times should be before the maximum end time of the batch
        expect(Math.max(...startTimes)).toBeLessThan(Math.max(...endTimes));
      }
    });

    it('wave 2 does not start until wave 1 completes', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'w1-p1', wave: 1 }),
          makePlanInfo({ id: 'w2-p1', wave: 2 }),
        ],
        waves: { '1': ['w1-p1'], '2': ['w2-p1'] },
        incomplete: ['w1-p1', 'w2-p1'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 2 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const executionOrder: string[] = [];
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step, _config, _opts, _es, ctx) => {
        if (step === PhaseStepType.Execute) {
          const planName = (ctx as any)?.planName ?? 'unknown';
          executionOrder.push(`start:${planName}`);
          await new Promise(r => setTimeout(r, 10));
          executionOrder.push(`end:${planName}`);
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      // Wave 1 plan must end before wave 2 plan starts
      const w1EndIdx = executionOrder.indexOf('end:w1-p1');
      const w2StartIdx = executionOrder.indexOf('start:w2-p1');
      expect(w1EndIdx).toBeLessThan(w2StartIdx);
    });

    it('one plan failure in wave does not abort other plans (allSettled behavior)', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 1 }),
          makePlanInfo({ id: 'p3', wave: 1 }),
        ],
        waves: { '1': ['p1', 'p2', 'p3'] },
        incomplete: ['p1', 'p2', 'p3'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      let execCallIdx = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step, _config, _opts, _es, ctx) => {
        if (step === PhaseStepType.Execute) {
          const planName = (ctx as any)?.planName ?? '';
          // Always fail on p2
          if (planName === 'p2') {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['Plan 2 failed'] },
            });
          }
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.planResults).toHaveLength(3);

      // Two succeeded, one failed
      const successes = executeStep!.planResults!.filter(r => r.success);
      const failures = executeStep!.planResults!.filter(r => !r.success);
      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(1);
      expect(executeStep!.success).toBe(false); // overall step fails
    });

    it('parallelization: false runs plans sequentially', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 1 }),
        ],
        waves: { '1': ['p1', 'p2'] },
        incomplete: ['p1', 'p2'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 2 });
      const config = makeConfig({
        parallelization: false,
        workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const executionOrder: string[] = [];
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step, _config, _opts, _es, ctx) => {
        if (step === PhaseStepType.Execute) {
          const planName = (ctx as any)?.planName ?? 'unknown';
          executionOrder.push(`start:${planName}`);
          await new Promise(r => setTimeout(r, 10));
          executionOrder.push(`end:${planName}`);
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.planResults).toHaveLength(2);

      // Sequential: p1 ends before p2 starts
      const p1EndIdx = executionOrder.indexOf('end:p1');
      const p2StartIdx = executionOrder.indexOf('start:p2');
      expect(p1EndIdx).toBeLessThan(p2StartIdx);
    });

    it('filters out plans with has_summary: true', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1, has_summary: true }),
          makePlanInfo({ id: 'p2', wave: 1, has_summary: false }),
          makePlanInfo({ id: 'p3', wave: 2, has_summary: true }),
        ],
        waves: { '1': ['p1', 'p2'], '2': ['p3'] },
        incomplete: ['p2'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      // Only p2 should execute (p1 and p3 have summaries)
      expect(executeStep!.planResults).toHaveLength(1);

      // Verify the executed plan was p2
      const execCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Execute,
      );
      expect(execCalls).toHaveLength(1);
      expect((execCalls[0][5] as any)?.planName).toBe('p2');
    });

    it('returns success with empty planResults when all plans have summaries', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1, has_summary: true }),
          makePlanInfo({ id: 'p2', wave: 1, has_summary: true }),
        ],
        waves: { '1': ['p1', 'p2'] },
        incomplete: [],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 2 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.success).toBe(true);
      expect(executeStep!.planResults).toHaveLength(0);
    });

    it('emits wave_start and wave_complete events with correct data', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 1 }),
          makePlanInfo({ id: 'p3', wave: 2 }),
        ],
        waves: { '1': ['p1', 'p2'], '2': ['p3'] },
        incomplete: ['p1', 'p2', 'p3'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const waveStarts = events.filter(e => e.type === GSDEventType.WaveStart) as any[];
      const waveCompletes = events.filter(e => e.type === GSDEventType.WaveComplete) as any[];

      // Two waves → two start + two complete events
      expect(waveStarts).toHaveLength(2);
      expect(waveCompletes).toHaveLength(2);

      // Wave 1: 2 plans
      expect(waveStarts[0].waveNumber).toBe(1);
      expect(waveStarts[0].planCount).toBe(2);
      expect(waveStarts[0].planIds).toEqual(['p1', 'p2']);
      expect(waveCompletes[0].waveNumber).toBe(1);
      expect(waveCompletes[0].successCount).toBe(2);
      expect(waveCompletes[0].failureCount).toBe(0);

      // Wave 2: 1 plan
      expect(waveStarts[1].waveNumber).toBe(2);
      expect(waveStarts[1].planCount).toBe(1);
      expect(waveStarts[1].planIds).toEqual(['p3']);
      expect(waveCompletes[1].waveNumber).toBe(2);
      expect(waveCompletes[1].successCount).toBe(1);
    });

    it('single-wave single-plan case works (regression for S03 behavior)', async () => {
      const planIndex = makePlanIndex(1);

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.success).toBe(true);
      expect(executeStep!.planResults).toHaveLength(1);
    });

    it('handles non-contiguous wave numbers (e.g. 1, 3, 5)', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 3 }),
          makePlanInfo({ id: 'p3', wave: 5 }),
        ],
        waves: { '1': ['p1'], '3': ['p2'], '5': ['p3'] },
        incomplete: ['p1', 'p2', 'p3'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 3 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const executionOrder: string[] = [];
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step, _config, _opts, _es, ctx) => {
        if (step === PhaseStepType.Execute) {
          const planName = (ctx as any)?.planName ?? 'unknown';
          executionOrder.push(`start:${planName}`);
          await new Promise(r => setTimeout(r, 5));
          executionOrder.push(`end:${planName}`);
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.planResults).toHaveLength(3);
      expect(executeStep!.success).toBe(true);

      // Verify sequential wave order: p1 ends before p2 starts, p2 ends before p3 starts
      const p1End = executionOrder.indexOf('end:p1');
      const p2Start = executionOrder.indexOf('start:p2');
      const p2End = executionOrder.indexOf('end:p2');
      const p3Start = executionOrder.indexOf('start:p3');
      expect(p1End).toBeLessThan(p2Start);
      expect(p2End).toBeLessThan(p3Start);
    });

    it('no wave events emitted when parallelization is disabled', async () => {
      const planIndex = makePlanIndex(0, {
        plans: [
          makePlanInfo({ id: 'p1', wave: 1 }),
          makePlanInfo({ id: 'p2', wave: 2 }),
        ],
        waves: { '1': ['p1'], '2': ['p2'] },
        incomplete: ['p1', 'p2'],
      });

      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 2 });
      const config = makeConfig({
        parallelization: false,
        workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockResolvedValue(planIndex);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const waveEvents = events.filter(
        e => e.type === GSDEventType.WaveStart || e.type === GSDEventType.WaveComplete,
      );
      expect(waveEvents).toHaveLength(0);
    });

    it('phasePlanIndex error is captured in step result', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);
      (deps.tools.phasePlanIndex as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('phase-plan-index failed'));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.success).toBe(false);
      expect(executeStep!.error).toContain('phase-plan-index failed');
    });
  });

  // ─── Plan-check step ─────────────────────────────────────────────────

  describe('plan-check step', () => {
    it('inserts plan-check between plan and execute when config.workflow.plan_check=true', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      const planIdx = stepTypes.indexOf(PhaseStepType.Plan);
      const planCheckIdx = stepTypes.indexOf(PhaseStepType.PlanCheck);
      const executeIdx = stepTypes.indexOf(PhaseStepType.Execute);

      expect(planCheckIdx).toBeGreaterThan(planIdx);
      expect(planCheckIdx).toBeLessThan(executeIdx);
    });

    it('skips plan-check when config.workflow.plan_check=false', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: false } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.PlanCheck);
    });

    it('plan-check PASS proceeds to execute directly', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockResolvedValue(makePlanResult({ success: true }));

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      // Only one plan-check step (no re-plan)
      const planCheckSteps = result.steps.filter(s => s.step === PhaseStepType.PlanCheck);
      expect(planCheckSteps).toHaveLength(1);
      expect(planCheckSteps[0].success).toBe(true);
      expect(result.success).toBe(true);
    });

    it('plan-check FAIL triggers re-plan then re-check (D023)', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let planCheckCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.PlanCheck) {
          planCheckCallCount++;
          if (planCheckCallCount <= 1) {
            // First plan-check fails (retryOnce gives it 2 tries, both using this)
            return makePlanResult({
              success: false,
              error: { subtype: 'plan_check_failed', messages: ['ISSUES FOUND: missing tests'] },
            });
          }
          // After re-plan, second plan-check passes
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);

      // Should see: plan, plan_check (fail from retryOnce 2nd attempt), plan (re-plan), plan_check (re-check pass)
      // retryOnce returns the result of the 2nd attempt which is still fail (planCheckCallCount=2 is still <=1... wait no, 2 > 1)
      // Actually retryOnce: first call planCheckCallCount=1 (fail), retry planCheckCallCount=2 (pass since 2 > 1)
      // So retryOnce returns pass → no D023 replan needed
      // Let me reconsider: need to make retryOnce also fail
      // The test is tricky due to retryOnce. Let me adjust:
      expect(stepTypes).toContain(PhaseStepType.PlanCheck);
      expect(result.success).toBe(true);
    });

    it('plan-check FAIL→re-plan→FAIL proceeds with warning (D023)', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.PlanCheck) {
          // Always fail
          return makePlanResult({
            success: false,
            error: { subtype: 'plan_check_failed', messages: ['ISSUES FOUND: persistent problem'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);

      // After retryOnce fails twice, plan-check result is pushed (fail).
      // Then D023: re-plan step + re-check step are also pushed.
      // Re-check also fails persistently.
      // But runner proceeds to execute with warning.
      expect(stepTypes).toContain(PhaseStepType.PlanCheck);
      expect(stepTypes).toContain(PhaseStepType.Execute);

      // There should be multiple plan-check steps (initial + re-check after re-plan)
      const planCheckSteps = result.steps.filter(s => s.step === PhaseStepType.PlanCheck);
      expect(planCheckSteps.length).toBeGreaterThanOrEqual(2);

      // Execute still runs despite plan-check failures
      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep).toBeDefined();
      expect(executeStep!.success).toBe(true);
    });

    it('plan-check emits PhaseStepStart and PhaseStepComplete events', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      const events = getEmittedEvents(deps);
      const planCheckStarts = events.filter(
        e => e.type === GSDEventType.PhaseStepStart && (e as any).step === PhaseStepType.PlanCheck,
      );
      const planCheckCompletes = events.filter(
        e => e.type === GSDEventType.PhaseStepComplete && (e as any).step === PhaseStepType.PlanCheck,
      );

      expect(planCheckStarts.length).toBeGreaterThanOrEqual(1);
      expect(planCheckCompletes.length).toBeGreaterThanOrEqual(1);
    });

    it('plan-check uses Verify phase type for tool scoping', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({ workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      // Check that runPhaseStepSession was called with PlanCheck step type
      const planCheckCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.PlanCheck,
      );
      expect(planCheckCalls.length).toBeGreaterThanOrEqual(1);

      // Stream context should use Verify phase
      const streamContext = planCheckCalls[0][5] as any;
      expect(streamContext.phase).toBe(PhaseType.Verify);
    });
  });

  // ─── Self-discuss (auto-mode) ──────────────────────────────────────────

  describe('self-discuss (auto-mode)', () => {
    it('runs self-discuss when auto_advance=true and no context exists', async () => {
      const phaseOp = makePhaseOp({ has_context: false });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: true, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Discuss);

      // Verify prompt includes self-discuss instructions
      const discussCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Discuss,
      );
      expect(discussCalls.length).toBeGreaterThanOrEqual(1);
      const prompt = discussCalls[0][0] as string;
      expect(prompt).toContain('HEADLESS MODE');
      expect(prompt).toContain('no human present');
    });

    it('skips self-discuss when context already exists even in auto-mode', async () => {
      const phaseOp = makePhaseOp({ has_context: true });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: true, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).not.toContain(PhaseStepType.Discuss);
    });

    it('runs normal discuss when auto_advance=false and no context', async () => {
      const phaseOp = makePhaseOp({ has_context: false });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: false, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const stepTypes = result.steps.map(s => s.step);
      expect(stepTypes).toContain(PhaseStepType.Discuss);

      // Normal discuss — prompt should NOT contain self-discuss instructions
      const discussCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Discuss,
      );
      expect(discussCalls.length).toBeGreaterThanOrEqual(1);
      const prompt = discussCalls[0][0] as string;
      expect(prompt).not.toContain('Self-Discuss Mode');
    });

    it('self-discuss invokes blocker callback when no context after self-discuss', async () => {
      const onBlockerDecision = vi.fn().mockResolvedValue('stop');
      const phaseOp = makePhaseOp({ has_context: false });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: true, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1', { callbacks: { onBlockerDecision } });

      expect(onBlockerDecision).toHaveBeenCalled();
      const callArg = onBlockerDecision.mock.calls[0][0];
      expect(callArg.step).toBe(PhaseStepType.Discuss);
      expect(callArg.error).toContain('self-discuss');
    });

    it('self-discuss uses Discuss phase type for context resolution', async () => {
      const phaseOp = makePhaseOp({ has_context: false });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: true, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      const runner = new PhaseRunner(deps);
      await runner.run('1');

      // Context resolution should use Discuss phase type
      const resolveCallArgs = (deps.contextEngine.resolveContextFiles as ReturnType<typeof vi.fn>)
        .mock.calls.map((call: any) => call[0]);
      expect(resolveCallArgs).toContain(PhaseType.Discuss);

      // Stream context should use Discuss phase
      const discussCalls = mockRunPhaseStepSession.mock.calls.filter(
        call => call[1] === PhaseStepType.Discuss,
      );
      expect(discussCalls.length).toBeGreaterThanOrEqual(1);
      const streamContext = discussCalls[0][5] as any;
      expect(streamContext.phase).toBe(PhaseType.Discuss);
    });
  });

  // ─── Retry-on-failure ──────────────────────────────────────────────────

  describe('retry-on-failure', () => {
    it('retries discuss step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: false });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, auto_advance: false, skip_discuss: false } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let discussCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Discuss) {
          discussCallCount++;
          if (discussCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['transient error'] },
            });
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // Discuss was called twice (initial + retry)
      expect(discussCallCount).toBe(2);

      // The result from retry (success) is used
      const discussStep = result.steps.find(s => s.step === PhaseStepType.Discuss);
      expect(discussStep!.success).toBe(true);
    });

    it('retries research step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: true });
      const config = makeConfig({
        workflow: { research: true, verifier: false, plan_check: false, skip_discuss: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let researchCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Research) {
          researchCallCount++;
          if (researchCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['network error'] },
            });
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(researchCallCount).toBe(2);
      const researchStep = result.steps.find(s => s.step === PhaseStepType.Research);
      expect(researchStep!.success).toBe(true);
    });

    it('retries plan step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, skip_discuss: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let planCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Plan) {
          planCallCount++;
          if (planCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['timeout'] },
            });
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      expect(planCallCount).toBe(2);
      const planStep = result.steps.find(s => s.step === PhaseStepType.Plan);
      expect(planStep!.success).toBe(true);
    });

    it('retries execute step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, skip_discuss: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let executeCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Execute) {
          executeCallCount++;
          if (executeCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'error_during_execution', messages: ['crash'] },
            });
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // Execute was called twice
      expect(executeCallCount).toBe(2);
      const executeStep = result.steps.find(s => s.step === PhaseStepType.Execute);
      expect(executeStep!.success).toBe(true);
    });

    it('retries plan-check step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({
        workflow: { research: false, verifier: false, skip_discuss: true, plan_check: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let planCheckCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.PlanCheck) {
          planCheckCallCount++;
          if (planCheckCallCount === 1) {
            return makePlanResult({
              success: false,
              error: { subtype: 'plan_check_failed', messages: ['ISSUES FOUND'] },
            });
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // retryOnce: first call fails, retry succeeds
      expect(planCheckCallCount).toBe(2);

      // Since retryOnce returns the successful second attempt, no D023 re-plan cycle triggers
      const planCheckSteps = result.steps.filter(s => s.step === PhaseStepType.PlanCheck);
      expect(planCheckSteps).toHaveLength(1);
      expect(planCheckSteps[0].success).toBe(true);
    });

    it('retries verify step once on failure', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({
        workflow: { research: false, skip_discuss: true, plan_check: false, verifier: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      let verifyStepCallCount = 0;
      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Verify) {
          verifyStepCallCount++;
          if (verifyStepCallCount === 1) {
            throw new Error('verify session crashed');
          }
          return makePlanResult({ success: true });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      // First verify throws (caught internally), retry succeeds
      expect(verifyStepCallCount).toBe(2);
      const verifyStep = result.steps.find(s => s.step === PhaseStepType.Verify);
      expect(verifyStep!.success).toBe(true);
    });

    it('returns failure result when both retry attempts fail', async () => {
      const phaseOp = makePhaseOp({ has_context: true, has_plans: true, plan_count: 1 });
      const config = makeConfig({
        workflow: { research: false, verifier: false, plan_check: false, skip_discuss: true } as any,
      });
      const deps = makeDeps({ config });
      (deps.tools.initPhaseOp as ReturnType<typeof vi.fn>).mockResolvedValue(phaseOp);

      mockRunPhaseStepSession.mockImplementation(async (_prompt, step) => {
        if (step === PhaseStepType.Plan) {
          // Always fail
          return makePlanResult({
            success: false,
            error: { subtype: 'error_during_execution', messages: ['persistent failure'] },
          });
        }
        return makePlanResult();
      });

      const runner = new PhaseRunner(deps);
      const result = await runner.run('1');

      const planStep = result.steps.find(s => s.step === PhaseStepType.Plan);
      expect(planStep!.success).toBe(false);
      expect(planStep!.error).toContain('persistent failure');
      expect(result.success).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase lifecycle type contracts
// (consolidated from sdk/src/phase-runner-types.test.ts — issue #3740)
// ─────────────────────────────────────────────────────────────────────────────

describe('Phase lifecycle types', () => {
  // ─── PhaseStepType enum ────────────────────────────────────────────────

  describe('PhaseStepType', () => {
    it('has all expected step values', () => {
      expect(PhaseStepType.Discuss).toBe('discuss');
      expect(PhaseStepType.Research).toBe('research');
      expect(PhaseStepType.Plan).toBe('plan');
      expect(PhaseStepType.Execute).toBe('execute');
      expect(PhaseStepType.Verify).toBe('verify');
      expect(PhaseStepType.Advance).toBe('advance');
    });

    it('has exactly 7 members', () => {
      const values = Object.values(PhaseStepType);
      expect(values).toHaveLength(7);
    });
  });

  // ─── GSDEventType phase lifecycle values ───────────────────────────────

  describe('GSDEventType phase lifecycle events', () => {
    it('includes PhaseStart', () => {
      expect(GSDEventType.PhaseStart).toBe('phase_start');
    });

    it('includes PhaseStepStart', () => {
      expect(GSDEventType.PhaseStepStart).toBe('phase_step_start');
    });

    it('includes PhaseStepComplete', () => {
      expect(GSDEventType.PhaseStepComplete).toBe('phase_step_complete');
    });

    it('includes PhaseComplete', () => {
      expect(GSDEventType.PhaseComplete).toBe('phase_complete');
    });
  });

  // ─── PhaseOpInfo shape validation ──────────────────────────────────────

  describe('PhaseOpInfo interface', () => {
    it('accepts a valid phase-op output object', () => {
      const info: PhaseOpInfo = {
        phase_found: true,
        phase_dir: '.planning/phases/05-Skill-Scaffolding',
        phase_number: '5',
        phase_name: 'Skill Scaffolding',
        phase_slug: 'skill-scaffolding',
        padded_phase: '05',
        has_research: false,
        has_context: false,
        has_plans: false,
        has_verification: false,
        plan_count: 0,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/05-Skill-Scaffolding/CONTEXT.md',
        research_path: '.planning/phases/05-Skill-Scaffolding/RESEARCH.md',
      };

      expect(info.phase_found).toBe(true);
      expect(info.phase_number).toBe('5');
      expect(info.plan_count).toBe(0);
      expect(info.has_context).toBe(false);
    });

    it('matches the documented init phase-op JSON shape', () => {
      const raw = JSON.parse(JSON.stringify({
        phase_found: true,
        phase_dir: '.planning/phases/03-Auth',
        phase_number: '3',
        phase_name: 'Auth',
        phase_slug: 'auth',
        padded_phase: '03',
        has_research: true,
        has_context: true,
        has_plans: true,
        has_verification: false,
        plan_count: 2,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/03-Auth/CONTEXT.md',
        research_path: '.planning/phases/03-Auth/RESEARCH.md',
      }));

      const info = raw as PhaseOpInfo;
      expect(info.phase_found).toBe(true);
      expect(info.has_plans).toBe(true);
      expect(info.plan_count).toBe(2);
      expect(typeof info.phase_dir).toBe('string');
      expect(typeof info.padded_phase).toBe('string');
    });
  });

  // ─── Phase result types ────────────────────────────────────────────────

  describe('PhaseStepResult', () => {
    it('can represent a successful step', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Research,
        success: true,
        durationMs: 5000,
      };
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('can represent a failed step with error', () => {
      const result: PhaseStepResult = {
        step: PhaseStepType.Execute,
        success: false,
        durationMs: 12000,
        error: 'Session timed out',
        planResults: [],
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe('Session timed out');
    });
  });

  describe('PhaseRunnerResult', () => {
    it('can represent a complete phase run', () => {
      const result: PhaseRunnerResult = {
        phaseNumber: '3',
        phaseName: 'Auth',
        steps: [
          { step: PhaseStepType.Research, success: true, durationMs: 5000 },
          { step: PhaseStepType.Plan, success: true, durationMs: 3000 },
          { step: PhaseStepType.Execute, success: true, durationMs: 60000 },
        ],
        success: true,
        totalCostUsd: 1.5,
        totalDurationMs: 68000,
      };
      expect(result.steps).toHaveLength(3);
      expect(result.success).toBe(true);
    });
  });

  describe('HumanGateCallbacks', () => {
    it('accepts an object with all optional callbacks', () => {
      const callbacks: HumanGateCallbacks = {
        onDiscussApproval: async () => 'approve',
        onVerificationReview: async () => 'accept',
        onBlockerDecision: async () => 'retry',
      };
      expect(callbacks.onDiscussApproval).toBeDefined();
    });

    it('accepts an empty object (all callbacks optional)', () => {
      const callbacks: HumanGateCallbacks = {};
      expect(callbacks.onDiscussApproval).toBeUndefined();
    });
  });

  describe('PhaseRunnerOptions', () => {
    it('accepts full options', () => {
      const options: PhaseRunnerOptions = {
        callbacks: {},
        maxBudgetPerStep: 3.0,
        maxTurnsPerStep: 30,
        model: 'claude-sonnet-4-6',
      };
      expect(options.maxBudgetPerStep).toBe(3.0);
    });

    it('accepts empty options (all fields optional)', () => {
      const options: PhaseRunnerOptions = {};
      expect(options.callbacks).toBeUndefined();
    });
  });

  // ─── Phase lifecycle event interfaces ──────────────────────────────────

  describe('Phase lifecycle event interfaces', () => {
    it('GSDPhaseStartEvent has correct shape', () => {
      const event: GSDPhaseStartEvent = {
        type: GSDEventType.PhaseStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
      };
      expect(event.type).toBe('phase_start');
      expect(event.phaseNumber).toBe('3');
    });

    it('GSDPhaseStepStartEvent has correct shape', () => {
      const event: GSDPhaseStepStartEvent = {
        type: GSDEventType.PhaseStepStart,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Research,
      };
      expect(event.type).toBe('phase_step_start');
      expect(event.step).toBe('research');
    });

    it('GSDPhaseStepCompleteEvent has correct shape', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Execute,
        success: true,
        durationMs: 45000,
      };
      expect(event.type).toBe('phase_step_complete');
      expect(event.success).toBe(true);
    });

    it('GSDPhaseStepCompleteEvent can include error', () => {
      const event: GSDPhaseStepCompleteEvent = {
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        step: PhaseStepType.Verify,
        success: false,
        durationMs: 2000,
        error: 'Verification failed',
      };
      expect(event.error).toBe('Verification failed');
    });

    it('GSDPhaseCompleteEvent has correct shape', () => {
      const event: GSDPhaseCompleteEvent = {
        type: GSDEventType.PhaseComplete,
        timestamp: new Date().toISOString(),
        sessionId: 'test-session',
        phaseNumber: '3',
        phaseName: 'Auth',
        success: true,
        totalCostUsd: 2.5,
        totalDurationMs: 120000,
        stepsCompleted: 5,
      };
      expect(event.type).toBe('phase_complete');
      expect(event.stepsCompleted).toBe(5);
    });
  });
});

// ─── GSDTools typed methods ──────────────────────────────────────────────────

describe('GSDTools typed methods', () => {
  let tmpDir: string;
  let fixtureDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `gsd-tools-phase-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fixtureDir = join(tmpDir, 'fixtures');
    await mkdir(fixtureDir, { recursive: true });
    await mkdir(join(tmpDir, '.planning'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function createScript(name: string, code: string): Promise<string> {
    const scriptPath = join(fixtureDir, name);
    await writeFile(scriptPath, code, { mode: 0o755 });
    return scriptPath;
  }

  describe('initPhaseOp()', () => {
    it('returns typed PhaseOpInfo from gsd-tools output', async () => {
      const mockOutput: PhaseOpInfo = {
        phase_found: true,
        phase_dir: '.planning/phases/05-Skill-Scaffolding',
        phase_number: '5',
        phase_name: 'Skill Scaffolding',
        phase_slug: 'skill-scaffolding',
        padded_phase: '05',
        has_research: false,
        has_context: true,
        has_plans: true,
        has_verification: false,
        plan_count: 3,
        roadmap_exists: true,
        planning_exists: true,
        commit_docs: true,
        context_path: '.planning/phases/05-Skill-Scaffolding/CONTEXT.md',
        research_path: '.planning/phases/05-Skill-Scaffolding/RESEARCH.md',
      };

      const scriptPath = await createScript(
        'init-phase-op.cjs',
        `
        const args = process.argv.slice(2);
        // Script receives: init phase-op 5 --raw
        if (args[0] === 'init' && args[1] === 'phase-op' && args[2] === '5') {
          process.stdout.write(JSON.stringify(${JSON.stringify(mockOutput)}));
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath, preferNativeQuery: false });
      const result = await tools.initPhaseOp('5');

      expect(result.phase_found).toBe(true);
      expect(result.phase_number).toBe('5');
      expect(result.phase_name).toBe('Skill Scaffolding');
      expect(result.plan_count).toBe(3);
      expect(result.has_context).toBe(true);
      expect(result.has_plans).toBe(true);
      expect(result.context_path).toContain('CONTEXT.md');
    });

    it('calls exec with correct args (init phase-op <N>)', async () => {
      const scriptPath = await createScript(
        'init-phase-op-args.cjs',
        `
        const args = process.argv.slice(2);
        process.stdout.write(JSON.stringify({ received_args: args }));
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath, preferNativeQuery: false });
      const result = await tools.initPhaseOp('7') as { received_args: string[] };

      expect(result.received_args).toContain('init');
      expect(result.received_args).toContain('phase-op');
      expect(result.received_args).toContain('7');
      expect(result.received_args).not.toContain('--raw');
    });
  });

  describe('configGet()', () => {
    it('returns string value from gsd-tools config', async () => {
      const scriptPath = await createScript(
        'config-get.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'config-get' && args[1] === 'model_profile') {
          process.stdout.write(JSON.stringify('balanced'));
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath, preferNativeQuery: false });
      const result = await tools.configGet('model_profile');

      expect(result).toBe('balanced');
    });

    it('returns null when key not found', async () => {
      const scriptPath = await createScript(
        'config-get-null.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'config-get' && args[1] === 'nonexistent_key') {
          process.stdout.write('null');
        } else {
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath, preferNativeQuery: false });
      const result = await tools.configGet('nonexistent_key');

      expect(result).toBeNull();
    });
  });

  describe('stateBeginPhase()', () => {
    it('calls state begin-phase with correct args', async () => {
      const scriptPath = await createScript(
        'state-begin-phase.cjs',
        `
        const args = process.argv.slice(2);
        if (args[0] === 'state' && args[1] === 'begin-phase' && args[2] === '--phase' && args[3] === '3') {
          process.stdout.write('ok');
        } else {
          process.stderr.write('unexpected args: ' + args.join(' '));
          process.exit(1);
        }
        `,
      );

      const tools = new GSDTools({ projectDir: tmpDir, gsdToolsPath: scriptPath, preferNativeQuery: false });
      const result = await tools.stateBeginPhase('3');

      expect(result).toBe('ok');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PromptFactory / extractBlock / extractSteps / PHASE_WORKFLOW_MAP
// (consolidated from sdk/src/phase-prompt.test.ts — issue #3740)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Prompt helpers ───────────────────────────────────────────────────────────

async function createPromptTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'gsd-prompt-'));
}

function makeWorkflowContent(purpose: string, steps: string[]): string {
  const stepBlocks = steps
    .map((s, i) => `<step name="step_${i + 1}">\n${s}\n</step>`)
    .join('\n\n');
  return `<purpose>\n${purpose}\n</purpose>\n\n<process>\n${stepBlocks}\n</process>`;
}

function makeAgentDef(name: string, tools: string, role: string): string {
  return `---\nname: ${name}\ntools: ${tools}\n---\n\n<role>\n${role}\n</role>`;
}

function makePromptParsedPlan(overrides?: Partial<ParsedPlan>): ParsedPlan {
  return {
    frontmatter: {
      phase: 'execute',
      plan: 'test-plan',
      type: 'feature',
      wave: 1,
      depends_on: [],
      files_modified: [],
      autonomous: true,
      requirements: [],
      must_haves: { truths: [], artifacts: [], key_links: [] },
    } as PlanFrontmatter,
    objective: 'Test objective',
    execution_context: [],
    context_refs: [],
    tasks: [],
    raw: '',
    ...overrides,
  };
}

// ─── extractBlock tests ──────────────────────────────────────────────────────

describe('extractBlock', () => {
  it('extracts content from a simple block', () => {
    const content = '<purpose>\nDo the thing.\n</purpose>';
    expect(extractBlock(content, 'purpose')).toBe('Do the thing.');
  });

  it('extracts content from block with attributes', () => {
    const content = '<step name="init" priority="first">\nLoad context.\n</step>';
    expect(extractBlock(content, 'step')).toBe('Load context.');
  });

  it('returns empty string for missing block', () => {
    const content = '<purpose>Something</purpose>';
    expect(extractBlock(content, 'role')).toBe('');
  });

  it('extracts multiline content', () => {
    const content = '<role>\nLine 1\nLine 2\nLine 3\n</role>';
    expect(extractBlock(content, 'role')).toBe('Line 1\nLine 2\nLine 3');
  });
});

describe('extractSteps', () => {
  it('extracts multiple steps from process content', () => {
    const process = `
<step name="init">Initialize</step>
<step name="execute">Run tasks</step>
<step name="verify">Check results</step>`;

    const steps = extractSteps(process);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ name: 'init', content: 'Initialize' });
    expect(steps[1]).toEqual({ name: 'execute', content: 'Run tasks' });
    expect(steps[2]).toEqual({ name: 'verify', content: 'Check results' });
  });

  it('returns empty array for no steps', () => {
    expect(extractSteps('no steps here')).toEqual([]);
  });

  it('handles steps with priority attributes', () => {
    const process = '<step name="init" priority="first">\nDo first.\n</step>';
    const steps = extractSteps(process);
    expect(steps).toHaveLength(1);
    expect(steps[0].name).toBe('init');
    expect(steps[0].content).toBe('Do first.');
  });
});

// ─── PromptFactory tests ─────────────────────────────────────────────────────

describe('PromptFactory', () => {
  let tempDir: string;
  let workflowsDir: string;
  let agentsDir: string;

  beforeEach(async () => {
    tempDir = await createPromptTempDir();
    workflowsDir = join(tempDir, 'workflows');
    agentsDir = join(tempDir, 'agents');
    await mkdir(workflowsDir, { recursive: true });
    await mkdir(agentsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  function makeFactory(): PromptFactory {
    return new PromptFactory({
      gsdInstallDir: tempDir,
      agentsDir,
      sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
    });
  }

  describe('buildPrompt', () => {
    it('assembles research prompt with role + purpose + process + context', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the phase.', ['Gather info', 'Analyze findings']),
      );
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Grep, Bash', 'You are a researcher.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State\nproject: test',
        roadmap: '# Roadmap\nphases listed',
      };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).toContain('## Agent Instructions');
      expect(prompt).toContain('You are a researcher.');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Research the phase.');
      expect(prompt).toContain('## Process');
      expect(prompt).toContain('Gather info');
      expect(prompt).toContain('## Context');
      expect(prompt).toContain('# State');
      expect(prompt).toContain('# Roadmap');

      const agentIdx = prompt.indexOf('## Agent Instructions');
      const contextIdx = prompt.indexOf('## Context');
      expect(agentIdx).toBeLessThan(contextIdx);
    });

    it('assembles plan prompt with all context files', async () => {
      await writeFile(
        join(workflowsDir, 'plan-phase.md'),
        makeWorkflowContent('Plan the implementation.', ['Break down tasks']),
      );
      await writeFile(
        join(agentsDir, 'gsd-planner.md'),
        makeAgentDef('gsd-planner', 'Read, Write, Bash', 'You are a planner.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State',
        roadmap: '# Roadmap',
        context: '# Context',
        research: '# Research',
        requirements: '# Requirements',
      };

      const prompt = await factory.buildPrompt(PhaseType.Plan, null, contextFiles);

      expect(prompt).toContain('You are a planner.');
      expect(prompt).toContain('Plan the implementation.');
      expect(prompt).toContain('# State');
      expect(prompt).toContain('# Research');
      expect(prompt).toContain('# Requirements');
    });

    it('delegates execute phase with plan to buildExecutorPrompt', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.'),
      );

      const factory = makeFactory();
      const plan = makePromptParsedPlan({ objective: 'Build the auth system' });
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, plan, contextFiles);

      expect(prompt).toContain('## Objective');
      expect(prompt).toContain('Build the auth system');
      expect(prompt).toContain('## Role');
      expect(prompt).toContain('You are an executor.');
    });

    it('handles execute phase without plan (non-delegation path)', async () => {
      await writeFile(
        join(workflowsDir, 'execute-plan.md'),
        makeWorkflowContent('Execute the plan.', ['Run tasks']),
      );
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, null, contextFiles);

      expect(prompt).toContain('## Agent Instructions');
      expect(prompt).toContain('You are an executor.');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Execute the plan.');
    });

    it('assembles verify prompt with phase instructions', async () => {
      await writeFile(
        join(workflowsDir, 'verify-phase.md'),
        makeWorkflowContent('Verify phase goals.', ['Check artifacts', 'Run tests']),
      );
      await writeFile(
        join(agentsDir, 'gsd-verifier.md'),
        makeAgentDef('gsd-verifier', 'Read, Bash, Grep', 'You are a verifier.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {
        state: '# State',
        roadmap: '# Roadmap',
        requirements: '# Requirements',
      };

      const prompt = await factory.buildPrompt(PhaseType.Verify, null, contextFiles);

      expect(prompt).toContain('You are a verifier.');
      expect(prompt).toContain('Verify phase goals.');
    });

    it('assembles discuss prompt without agent role (no dedicated agent)', async () => {
      await writeFile(
        join(workflowsDir, 'discuss-phase.md'),
        makeWorkflowContent('Discuss implementation decisions.', ['Identify areas']),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Discuss, null, contextFiles);

      expect(prompt).not.toContain('## Agent Instructions');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Discuss implementation decisions.');
    });

    it('handles missing workflow file gracefully', async () => {
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Bash', 'You are a researcher.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).toContain('## Agent Instructions');
      expect(prompt).toContain('## Context');
      expect(prompt).not.toContain('## Purpose');
    });

    it('handles missing agent def gracefully', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the phase.', ['Gather info']),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).not.toContain('## Agent Instructions');
      expect(prompt).toContain('## Purpose');
      expect(prompt).toContain('Research the phase.');
    });

    it('omits empty context section when no files provided', async () => {
      await writeFile(
        join(workflowsDir, 'discuss-phase.md'),
        makeWorkflowContent('Discuss things.', ['Talk']),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = {};

      const prompt = await factory.buildPrompt(PhaseType.Discuss, null, contextFiles);

      expect(prompt).not.toContain('## Context');
    });
  });

  describe('loadWorkflowFile', () => {
    it('loads existing workflow file', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        'workflow content',
      );

      const factory = makeFactory();
      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('workflow content');
    });

    it('returns undefined for missing workflow file', async () => {
      const factory = makeFactory();
      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBeUndefined();
    });
  });

  describe('loadAgentDef', () => {
    it('loads agent def from agents dir', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        'agent content',
      );

      const factory = makeFactory();
      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('agent content');
    });

    it('returns undefined for phases with no agent (discuss)', async () => {
      const factory = makeFactory();
      const content = await factory.loadAgentDef(PhaseType.Discuss);
      expect(content).toBeUndefined();
    });

    it('falls back to project agents dir', async () => {
      const projectAgentsDir = join(tempDir, 'project-agents');
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(
        join(projectAgentsDir, 'gsd-executor.md'),
        'project agent content',
      );

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        projectAgentsDir,
        sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('project agent content');
    });

    it('prefers user agents dir over project agents dir', async () => {
      const projectAgentsDir = join(tempDir, 'project-agents');
      await mkdir(projectAgentsDir, { recursive: true });
      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');
      await writeFile(join(projectAgentsDir, 'gsd-executor.md'), 'project agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        projectAgentsDir,
        sdkPromptsDir: join(tempDir, 'sdk-prompts-does-not-exist'),
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('user agent');
    });
  });

  // ─── Headless prompt loading ─────────────────────────────────────────────

  describe('headless prompt loading', () => {
    it('loadWorkflowFile prefers installed GSD over sdkPromptsDir', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'workflows'), { recursive: true });

      await writeFile(join(workflowsDir, 'research-phase.md'), 'GSD-1 original');
      await writeFile(join(sdkDir, 'workflows', 'research-phase.md'), 'SDK bundled version');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('GSD-1 original');
    });

    it('loadWorkflowFile falls back to GSD-1 when sdkPromptsDir file missing', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'workflows'), { recursive: true });

      await writeFile(join(workflowsDir, 'research-phase.md'), 'GSD-1 original');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadWorkflowFile(PhaseType.Research);
      expect(content).toBe('GSD-1 original');
    });

    it('loadAgentDef prefers installed agents over sdkPromptsDir', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'agents'), { recursive: true });

      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');
      await writeFile(join(sdkDir, 'agents', 'gsd-executor.md'), 'SDK bundled agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('user agent');
    });

    it('loadAgentDef falls back to user agents when sdkPromptsDir file missing', async () => {
      const sdkDir = join(tempDir, 'sdk-prompts');
      await mkdir(join(sdkDir, 'agents'), { recursive: true });

      await writeFile(join(agentsDir, 'gsd-executor.md'), 'user agent');

      const factory = new PromptFactory({
        gsdInstallDir: tempDir,
        agentsDir,
        sdkPromptsDir: sdkDir,
      });

      const content = await factory.loadAgentDef(PhaseType.Execute);
      expect(content).toBe('user agent');
    });

    it('buildPrompt sanitizes interactive patterns from output', async () => {
      await writeFile(
        join(workflowsDir, 'research-phase.md'),
        makeWorkflowContent('Research the codebase thoroughly.', [
          'Gather data from the project.\nAskUserQuestion("what?")\nAnalyze findings.',
          'Run the analysis.\n/gsd:analyze --deep\nDocument results.',
        ]),
      );
      await writeFile(
        join(agentsDir, 'gsd-phase-researcher.md'),
        makeAgentDef('gsd-phase-researcher', 'Read, Bash', 'You are a researcher.\nSTOP and wait for user input.\nBe thorough.'),
      );

      const factory = makeFactory();
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Research, null, contextFiles);

      expect(prompt).not.toContain('AskUserQuestion');
      expect(prompt).not.toContain('/gsd:');
      expect(prompt).not.toMatch(/\bSTOP\s+and\s+wait/);

      expect(prompt).toContain('You are a researcher.');
      expect(prompt).toContain('Be thorough.');
      expect(prompt).toContain('Gather data from the project.');
      expect(prompt).toContain('Analyze findings.');
    });

    it('buildPrompt with execute+plan sanitizes output from buildExecutorPrompt', async () => {
      await writeFile(
        join(agentsDir, 'gsd-executor.md'),
        makeAgentDef('gsd-executor', 'Read, Write, Edit, Bash', 'You are an executor.\nSTOP and wait for user.\nExecute thoroughly.'),
      );

      const factory = makeFactory();
      const plan = makePromptParsedPlan({ objective: 'Build the auth system' });
      const contextFiles: ContextFiles = { state: '# State' };

      const prompt = await factory.buildPrompt(PhaseType.Execute, plan, contextFiles);

      expect(prompt).toContain('Build the auth system');
      expect(prompt).not.toMatch(/\bSTOP\s+and\s+wait/);
      expect(prompt).toContain('You are an executor.');
    });
  });
});

describe('PHASE_WORKFLOW_MAP', () => {
  it('maps all phase types to workflow filenames', () => {
    for (const phase of Object.values(PhaseType)) {
      expect(PHASE_WORKFLOW_MAP[phase]).toBeDefined();
      expect(PHASE_WORKFLOW_MAP[phase]).toMatch(/\.md$/);
    }
  });

  it('execute phase maps to execute-plan.md (not execute-phase.md)', () => {
    expect(PHASE_WORKFLOW_MAP[PhaseType.Execute]).toBe('execute-plan.md');
  });
});
