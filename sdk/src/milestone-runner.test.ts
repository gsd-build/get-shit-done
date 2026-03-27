import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  PhaseRunnerResult,
  RoadmapPhaseInfo,
  RoadmapAnalysis,
  GSDEvent,
  MilestoneRunnerOptions,
} from './types.js';
import { GSDEventType } from './types.js';

// ─── Mock modules ────────────────────────────────────────────────────────────

// Mock the heavy dependencies that GSD constructor + runPhase pull in
vi.mock('./plan-parser.js', () => ({
  parsePlan: vi.fn(),
  parsePlanFile: vi.fn(),
}));

vi.mock('./config.js', () => ({
  loadConfig: vi.fn().mockResolvedValue({
    model_profile: 'test-model',
    tools: [],
    phases: {},
  }),
}));

vi.mock('./session-runner.js', () => ({
  runPlanSession: vi.fn(),
  runPhaseStepSession: vi.fn(),
}));

vi.mock('./prompt-builder.js', () => ({
  buildExecutorPrompt: vi.fn(),
  parseAgentTools: vi.fn().mockReturnValue([]),
}));

vi.mock('./event-stream.js', () => {
  return {
    GSDEventStream: vi.fn().mockImplementation(() => ({
      emitEvent: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
      addTransport: vi.fn(),
    })),
  };
});

vi.mock('./phase-runner.js', () => ({
  PhaseRunner: vi.fn(),
  PhaseRunnerError: class extends Error {
    name = 'PhaseRunnerError';
  },
}));

vi.mock('./context-engine.js', () => ({
  ContextEngine: vi.fn(),
  PHASE_FILE_MANIFEST: [],
}));

vi.mock('./phase-prompt.js', () => ({
  PromptFactory: vi.fn(),
  extractBlock: vi.fn(),
  extractSteps: vi.fn(),
  PHASE_WORKFLOW_MAP: {},
}));

vi.mock('./gsd-tools.js', () => ({
  GSDTools: vi.fn().mockImplementation(() => ({
    roadmapAnalyze: vi.fn(),
  })),
  GSDToolsError: class extends Error {
    name = 'GSDToolsError';
  },
}));

import { GSD } from './index.js';
import { GSDTools } from './gsd-tools.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePhaseInfo(overrides: Partial<RoadmapPhaseInfo> = {}): RoadmapPhaseInfo {
  return {
    number: '1',
    disk_status: 'not_started',
    roadmap_complete: false,
    phase_name: 'Auth',
    ...overrides,
  };
}

function makePhaseResult(overrides: Partial<PhaseRunnerResult> = {}): PhaseRunnerResult {
  return {
    phaseNumber: '1',
    phaseName: 'Auth',
    steps: [],
    success: true,
    totalCostUsd: 0.50,
    totalDurationMs: 5000,
    ...overrides,
  };
}

function makeAnalysis(phases: RoadmapPhaseInfo[]): RoadmapAnalysis {
  return { phases };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GSD.run()', () => {
  let gsd: GSD;
  let mockRoadmapAnalyze: ReturnType<typeof vi.fn>;
  let events: GSDEvent[];

  beforeEach(() => {
    vi.clearAllMocks();

    gsd = new GSD({ projectDir: '/tmp/test-project' });
    events = [];

    // Capture emitted events
    (gsd.eventStream.emitEvent as ReturnType<typeof vi.fn>).mockImplementation(
      (event: GSDEvent) => events.push(event),
    );

    // Wire mock roadmapAnalyze on the GSDTools instance
    mockRoadmapAnalyze = vi.fn();
    vi.mocked(GSDTools).mockImplementation(
      () =>
        ({
          roadmapAnalyze: mockRoadmapAnalyze,
        }) as any,
    );
  });

  it('discovers phases and calls runPhase for each incomplete one', async () => {
    const phases = [
      makePhaseInfo({ number: '1', phase_name: 'Auth', roadmap_complete: false }),
      makePhaseInfo({ number: '2', phase_name: 'Dashboard', roadmap_complete: false }),
    ];

    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis(phases)) // initial discovery
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ])) // after phase 1
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
      ])); // after phase 2

    const runPhaseSpy = vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '1' }))
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '2' }));

    const result = await gsd.run('build the app');

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(2);
    expect(runPhaseSpy).toHaveBeenCalledTimes(2);
    expect(runPhaseSpy).toHaveBeenCalledWith('1', undefined);
    expect(runPhaseSpy).toHaveBeenCalledWith('2', undefined);
  });

  it('skips phases where roadmap_complete === true', async () => {
    const phases = [
      makePhaseInfo({ number: '1', roadmap_complete: true }),
      makePhaseInfo({ number: '2', roadmap_complete: false }),
      makePhaseInfo({ number: '3', roadmap_complete: true }),
    ];

    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis(phases))
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
        makePhaseInfo({ number: '3', roadmap_complete: true }),
      ]));

    const runPhaseSpy = vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '2' }));

    const result = await gsd.run('build it');

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(1);
    expect(runPhaseSpy).toHaveBeenCalledTimes(1);
    expect(runPhaseSpy).toHaveBeenCalledWith('2', undefined);
  });

  it('re-discovers phases after each completion to catch dynamically inserted phases', async () => {
    // Initially phase 1 and 2 are incomplete
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]))
      // After phase 1, a new phase 1.5 was inserted
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '1.5', phase_name: 'Hotfix', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]))
      // After phase 1.5 completes
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '1.5', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]))
      // After phase 2 completes
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '1.5', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
      ]));

    const runPhaseSpy = vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '1' }))
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '1.5', phaseName: 'Hotfix' }))
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '2' }));

    const result = await gsd.run('build it');

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(3);
    expect(runPhaseSpy).toHaveBeenCalledTimes(3);
    // The dynamically inserted phase 1.5 was executed
    expect(runPhaseSpy).toHaveBeenNthCalledWith(2, '1.5', undefined);
  });

  it('aggregates costs from all phases', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]))
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]))
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
      ]));

    vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ totalCostUsd: 1.25 }))
      .mockResolvedValueOnce(makePhaseResult({ totalCostUsd: 0.75 }));

    const result = await gsd.run('build it');

    expect(result.totalCostUsd).toBeCloseTo(2.0, 2);
  });

  it('emits MilestoneStart and MilestoneComplete events', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
      ]))
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
      ]));

    vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ totalCostUsd: 0.50 }));

    await gsd.run('build it');

    const startEvents = events.filter(e => e.type === GSDEventType.MilestoneStart);
    const completeEvents = events.filter(e => e.type === GSDEventType.MilestoneComplete);

    expect(startEvents).toHaveLength(1);
    expect(completeEvents).toHaveLength(1);

    const start = startEvents[0] as any;
    expect(start.phaseCount).toBe(1);
    expect(start.prompt).toBe('build it');

    const complete = completeEvents[0] as any;
    expect(complete.success).toBe(true);
    expect(complete.phasesCompleted).toBe(1);
    expect(complete.totalCostUsd).toBeCloseTo(0.50, 2);
  });

  it('stops on phase failure', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]));

    vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '1', success: false }));

    const result = await gsd.run('build it');

    expect(result.success).toBe(false);
    expect(result.phases).toHaveLength(1);
    // Phase 2 was never started
  });

  it('handles empty phase list', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([]));

    const runPhaseSpy = vi.spyOn(gsd, 'runPhase');

    const result = await gsd.run('build it');

    expect(result.success).toBe(true);
    expect(result.phases).toHaveLength(0);
    expect(runPhaseSpy).not.toHaveBeenCalled();
    expect(result.totalCostUsd).toBe(0);
  });

  it('sorts phases numerically, not lexicographically', async () => {
    const phases = [
      makePhaseInfo({ number: '10', phase_name: 'Ten', roadmap_complete: false }),
      makePhaseInfo({ number: '2', phase_name: 'Two', roadmap_complete: false }),
      makePhaseInfo({ number: '1.5', phase_name: 'OnePointFive', roadmap_complete: false }),
    ];

    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis(phases))
      // After phase 1.5
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1.5', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
        makePhaseInfo({ number: '10', roadmap_complete: false }),
      ]))
      // After phase 2
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1.5', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
        makePhaseInfo({ number: '10', roadmap_complete: false }),
      ]))
      // After phase 10
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1.5', roadmap_complete: true }),
        makePhaseInfo({ number: '2', roadmap_complete: true }),
        makePhaseInfo({ number: '10', roadmap_complete: true }),
      ]));

    const executionOrder: string[] = [];
    vi.spyOn(gsd, 'runPhase').mockImplementation(async (phaseNumber: string) => {
      executionOrder.push(phaseNumber);
      return makePhaseResult({ phaseNumber });
    });

    await gsd.run('build it');

    // Numeric order: 1.5 → 2 → 10 (not lexicographic: "10" < "2")
    expect(executionOrder).toEqual(['1.5', '2', '10']);
  });

  it('handles phase throwing an unexpected error', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', phase_name: 'Broken', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]));

    vi.spyOn(gsd, 'runPhase')
      .mockRejectedValueOnce(new Error('Unexpected explosion'));

    const result = await gsd.run('build it');

    expect(result.success).toBe(false);
    expect(result.phases).toHaveLength(1);
    expect(result.phases[0].success).toBe(false);
    expect(result.phases[0].phaseNumber).toBe('1');
  });

  it('passes MilestoneRunnerOptions through to runPhase', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
      ]))
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: true }),
      ]));

    const runPhaseSpy = vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult());

    const opts: MilestoneRunnerOptions = {
      model: 'claude-sonnet-4-6',
      maxBudgetPerStep: 2.0,
      onPhaseComplete: vi.fn(),
    };

    await gsd.run('build it', opts);

    expect(runPhaseSpy).toHaveBeenCalledWith('1', opts);
  });

  it('respects onPhaseComplete returning stop', async () => {
    mockRoadmapAnalyze
      .mockResolvedValueOnce(makeAnalysis([
        makePhaseInfo({ number: '1', roadmap_complete: false }),
        makePhaseInfo({ number: '2', roadmap_complete: false }),
      ]));

    vi.spyOn(gsd, 'runPhase')
      .mockResolvedValueOnce(makePhaseResult({ phaseNumber: '1' }));

    const result = await gsd.run('build it', {
      onPhaseComplete: async () => 'stop',
    });

    // Only 1 phase was executed because callback said stop
    expect(result.phases).toHaveLength(1);
    expect(result.success).toBe(true);
  });
});
