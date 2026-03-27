/**
 * Phase Runner — core state machine driving the full phase lifecycle.
 *
 * Orchestrates: discuss → research → plan → execute → verify → advance
 * with config-driven step skipping, human gate callbacks, event emission,
 * and structured error handling per step.
 */

import type {
  PhaseOpInfo,
  PhaseStepResult,
  PhaseRunnerResult,
  HumanGateCallbacks,
  PhaseRunnerOptions,
  PlanResult,
  SessionOptions,
  ParsedPlan,
  PhasePlanIndex,
  PlanInfo,
} from './types.js';
import { PhaseStepType, PhaseType, GSDEventType } from './types.js';
import type { GSDConfig } from './config.js';
import type { GSDTools } from './gsd-tools.js';
import type { GSDEventStream } from './event-stream.js';
import type { PromptFactory } from './phase-prompt.js';
import type { ContextEngine } from './context-engine.js';
import type { GSDLogger } from './logger.js';
import { runPhaseStepSession, runPlanSession } from './session-runner.js';

// ─── Error type ──────────────────────────────────────────────────────────────

export class PhaseRunnerError extends Error {
  constructor(
    message: string,
    public readonly phaseNumber: string,
    public readonly step: PhaseStepType,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'PhaseRunnerError';
  }
}

// ─── Verification result enum ────────────────────────────────────────────────

export type VerificationOutcome = 'passed' | 'human_needed' | 'gaps_found';

// ─── PhaseRunner deps interface ──────────────────────────────────────────────

export interface PhaseRunnerDeps {
  projectDir: string;
  tools: GSDTools;
  promptFactory: PromptFactory;
  contextEngine: ContextEngine;
  eventStream: GSDEventStream;
  config: GSDConfig;
  logger?: GSDLogger;
}

// ─── PhaseRunner ─────────────────────────────────────────────────────────────

export class PhaseRunner {
  private readonly projectDir: string;
  private readonly tools: GSDTools;
  private readonly promptFactory: PromptFactory;
  private readonly contextEngine: ContextEngine;
  private readonly eventStream: GSDEventStream;
  private readonly config: GSDConfig;
  private readonly logger?: GSDLogger;

  constructor(deps: PhaseRunnerDeps) {
    this.projectDir = deps.projectDir;
    this.tools = deps.tools;
    this.promptFactory = deps.promptFactory;
    this.contextEngine = deps.contextEngine;
    this.eventStream = deps.eventStream;
    this.config = deps.config;
    this.logger = deps.logger;
  }

  /**
   * Run a full phase lifecycle: discuss → research → plan → plan-check → execute → verify → advance.
   *
   * Each step is gated by config flags and phase state. Human gate callbacks
   * are invoked at decision points; when not provided, auto-approve is used.
   */
  async run(phaseNumber: string, options?: PhaseRunnerOptions): Promise<PhaseRunnerResult> {
    const startTime = Date.now();
    const steps: PhaseStepResult[] = [];
    const callbacks = options?.callbacks ?? {};

    // ── Init: query phase state ──
    let phaseOp: PhaseOpInfo;
    try {
      phaseOp = await this.tools.initPhaseOp(phaseNumber);
    } catch (err) {
      throw new PhaseRunnerError(
        `Failed to initialize phase ${phaseNumber}: ${err instanceof Error ? err.message : String(err)}`,
        phaseNumber,
        PhaseStepType.Discuss,
        err instanceof Error ? err : undefined,
      );
    }

    // Validate phase exists
    if (!phaseOp.phase_found) {
      throw new PhaseRunnerError(
        `Phase ${phaseNumber} not found on disk`,
        phaseNumber,
        PhaseStepType.Discuss,
      );
    }

    const phaseName = phaseOp.phase_name;

    // Emit phase_start
    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      phaseName,
    });

    const sessionOpts: SessionOptions = {
      maxTurns: options?.maxTurnsPerStep ?? 50,
      maxBudgetUsd: options?.maxBudgetPerStep ?? 5.0,
      model: options?.model,
      cwd: this.projectDir,
    };

    let halted = false;

    // ── Step 1: Discuss ──
    if (!halted) {
      const shouldSkip = phaseOp.has_context || this.config.workflow.skip_discuss;
      if (shouldSkip && !(this.config.workflow.auto_advance && !phaseOp.has_context && !this.config.workflow.skip_discuss)) {
        this.logger?.debug(`Skipping discuss: has_context=${phaseOp.has_context}, skip_discuss=${this.config.workflow.skip_discuss}`);
      } else if (!phaseOp.has_context && !this.config.workflow.skip_discuss && this.config.workflow.auto_advance) {
        // AI self-discuss: auto-mode with no context — run a self-discuss session
        const result = await this.retryOnce('self-discuss', () => this.runSelfDiscussStep(phaseNumber, sessionOpts));
        steps.push(result);

        // Re-query phase state to check if context was created
        try {
          phaseOp = await this.tools.initPhaseOp(phaseNumber);
        } catch {
          // If re-query fails, proceed with original state
        }

        if (!phaseOp.has_context) {
          const decision = await this.invokeBlockerCallback(callbacks, phaseNumber, PhaseStepType.Discuss, 'No context after self-discuss step');
          if (decision === 'stop') {
            halted = true;
          }
        }
      } else if (!shouldSkip) {
        const result = await this.retryOnce('discuss', () => this.runStep(PhaseStepType.Discuss, phaseNumber, sessionOpts));
        steps.push(result);

        // Re-query phase state to check if context was created
        try {
          phaseOp = await this.tools.initPhaseOp(phaseNumber);
        } catch {
          // If re-query fails, proceed with original state
        }

        if (!phaseOp.has_context) {
          // No context after discuss — invoke blocker callback
          const decision = await this.invokeBlockerCallback(callbacks, phaseNumber, PhaseStepType.Discuss, 'No context after discuss step');
          if (decision === 'stop') {
            halted = true;
          }
        }
      }
    }

    // ── Step 2: Research ──
    if (!halted) {
      if (!this.config.workflow.research) {
        this.logger?.debug('Skipping research: config.workflow.research=false');
      } else {
        const result = await this.retryOnce('research', () => this.runStep(PhaseStepType.Research, phaseNumber, sessionOpts));
        steps.push(result);
      }
    }

    // ── Step 3: Plan ──
    if (!halted) {
      const result = await this.retryOnce('plan', () => this.runStep(PhaseStepType.Plan, phaseNumber, sessionOpts));
      steps.push(result);

      // Re-query to check for plans
      try {
        phaseOp = await this.tools.initPhaseOp(phaseNumber);
      } catch {
        // Proceed with prior state
      }

      if (!phaseOp.has_plans || phaseOp.plan_count === 0) {
        const decision = await this.invokeBlockerCallback(callbacks, phaseNumber, PhaseStepType.Plan, 'No plans created after plan step');
        if (decision === 'stop') {
          halted = true;
        }
      }
    }

    // ── Step 3.5: Plan Check ──
    if (!halted && this.config.workflow.plan_check) {
      const planCheckResult = await this.retryOnce('plan-check', () => this.runPlanCheckStep(phaseNumber, sessionOpts));
      steps.push(planCheckResult);

      // If plan-check failed, re-plan once then re-check once (D023)
      if (!planCheckResult.success) {
        this.logger?.info(`Plan check failed for phase ${phaseNumber}, re-planning once (D023)`);

        // Re-run plan step with feedback
        const replanResult = await this.runStep(PhaseStepType.Plan, phaseNumber, sessionOpts);
        steps.push(replanResult);

        // Re-check once
        const recheckResult = await this.runPlanCheckStep(phaseNumber, sessionOpts);
        steps.push(recheckResult);

        if (!recheckResult.success) {
          this.logger?.warn(`Plan check failed again after re-plan for phase ${phaseNumber}. Proceeding with warning (D023).`);
        }
      }
    }

    // ── Step 4: Execute ──
    if (!halted) {
      const executeResult = await this.retryOnce('execute', () => this.runExecuteStep(phaseNumber, sessionOpts));
      steps.push(executeResult);
    }

    // ── Step 5: Verify ──
    if (!halted) {
      if (!this.config.workflow.verifier) {
        this.logger?.debug('Skipping verify: config.workflow.verifier=false');
      } else {
        const verifyResult = await this.retryOnce('verify', () => this.runVerifyStep(phaseNumber, sessionOpts, callbacks, options));
        steps.push(verifyResult);

        // Check if verify resulted in a halt
        if (!verifyResult.success && verifyResult.error === 'halted_by_callback') {
          halted = true;
        }
      }
    }

    // ── Step 6: Advance ──
    if (!halted) {
      const advanceResult = await this.runAdvanceStep(phaseNumber, sessionOpts, callbacks);
      steps.push(advanceResult);
    }

    const totalDurationMs = Date.now() - startTime;
    const totalCostUsd = steps.reduce((sum, s) => {
      const stepCost = s.planResults?.reduce((c, pr) => c + pr.totalCostUsd, 0) ?? 0;
      return sum + stepCost;
    }, 0);
    const success = !halted && steps.every(s => s.success);

    // Emit phase_complete
    this.eventStream.emitEvent({
      type: GSDEventType.PhaseComplete,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      phaseName,
      success,
      totalCostUsd,
      totalDurationMs,
      stepsCompleted: steps.length,
    });

    return {
      phaseNumber,
      phaseName,
      steps,
      success,
      totalCostUsd,
      totalDurationMs,
    };
  }

  // ─── Step runners ──────────────────────────────────────────────────────

  /**
   * Retry a step function once on failure.
   * On first error/failure, logs a warning and calls the function once more.
   * Returns the result from the last attempt.
   */
  private async retryOnce<T extends PhaseStepResult>(label: string, fn: () => Promise<T>): Promise<T> {
    const result = await fn();
    if (result.success) return result;

    this.logger?.warn(`Step "${label}" failed, retrying once...`);
    return fn();
  }

  /**
   * Run the plan-check step.
   * Loads the gsd-plan-checker agent definition, runs a Verify-scoped session,
   * and parses output for PASS/FAIL signals.
   */
  private async runPlanCheckStep(
    phaseNumber: string,
    sessionOpts: SessionOptions,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.PlanCheck,
    });

    let planResult: PlanResult;
    try {
      // Load plan-checker agent definition (same pattern as PromptFactory.loadAgentDef)
      const agentDef = await this.promptFactory.loadAgentDef(PhaseType.Verify);

      // Build prompt using Verify phase type for context resolution
      const contextFiles = await this.contextEngine.resolveContextFiles(PhaseType.Verify);
      let prompt = await this.promptFactory.buildPrompt(PhaseType.Verify, null, contextFiles);

      // Supplement with plan-checker instructions
      prompt += '\n\n## Plan Checker Instructions\n\nYou are a plan checker. Review the plans for this phase and verify they are well-formed, complete, and achievable. If all plans pass, output "VERIFICATION PASSED". If any issues are found, output "ISSUES FOUND" followed by a description of each issue.';

      planResult = await runPhaseStepSession(
        prompt,
        PhaseStepType.PlanCheck,
        this.config,
        sessionOpts,
        this.eventStream,
        { phase: PhaseType.Verify, planName: undefined },
      );
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.PlanCheck,
        success: false,
        durationMs,
        error: errorMsg,
      });

      return {
        step: PhaseStepType.PlanCheck,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    const durationMs = Date.now() - stepStart;
    // Parse plan-check outcome: success if the session succeeded (real output parsing would check for VERIFICATION PASSED / ISSUES FOUND)
    const success = planResult.success;

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: planResult.sessionId,
      phaseNumber,
      step: PhaseStepType.PlanCheck,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
    });

    return {
      step: PhaseStepType.PlanCheck,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
      planResults: [planResult],
    };
  }

  /**
   * Run the self-discuss step for auto-mode.
   * When auto_advance is true and no context exists, run an AI self-discuss
   * session that identifies gray areas and makes opinionated decisions.
   */
  private async runSelfDiscussStep(
    phaseNumber: string,
    sessionOpts: SessionOptions,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Discuss,
    });

    let planResult: PlanResult;
    try {
      const contextFiles = await this.contextEngine.resolveContextFiles(PhaseType.Discuss);
      let prompt = await this.promptFactory.buildPrompt(PhaseType.Discuss, null, contextFiles);

      // Supplement with self-discuss instructions
      prompt += '\n\n## Self-Discuss Mode\n\nYou are the AI discussing decisions with yourself. No human is present. Identify 3-5 gray areas in the project scope, reason through each one, make opinionated choices, and write CONTEXT.md with your decisions.';

      planResult = await runPhaseStepSession(
        prompt,
        PhaseStepType.Discuss,
        this.config,
        sessionOpts,
        this.eventStream,
        { phase: PhaseType.Discuss, planName: undefined },
      );
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.Discuss,
        success: false,
        durationMs,
        error: errorMsg,
      });

      return {
        step: PhaseStepType.Discuss,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    const durationMs = Date.now() - stepStart;
    const success = planResult.success;

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: planResult.sessionId,
      phaseNumber,
      step: PhaseStepType.Discuss,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
    });

    return {
      step: PhaseStepType.Discuss,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
      planResults: [planResult],
    };
  }

  /**
   * Run a single phase step session (discuss, research, plan).
   * Emits step start/complete events and captures errors.
   */
  private async runStep(
    step: PhaseStepType,
    phaseNumber: string,
    sessionOpts: SessionOptions,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step,
    });

    let planResult: PlanResult;
    try {
      // Map step to PhaseType for prompt/context resolution
      const phaseType = this.stepToPhaseType(step);
      const contextFiles = await this.contextEngine.resolveContextFiles(phaseType);
      const prompt = await this.promptFactory.buildPrompt(phaseType, null, contextFiles);

      planResult = await runPhaseStepSession(
        prompt,
        step,
        this.config,
        sessionOpts,
        this.eventStream,
        { phase: phaseType, planName: undefined },
      );
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step,
        success: false,
        durationMs,
        error: errorMsg,
      });

      return {
        step,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    const durationMs = Date.now() - stepStart;
    const success = planResult.success;

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: planResult.sessionId,
      phaseNumber,
      step,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
    });

    return {
      step,
      success,
      durationMs,
      error: planResult.error?.messages.join('; ') || undefined,
      planResults: [planResult],
    };
  }

  /**
   * Run the execute step — uses phase-plan-index for wave-grouped parallel execution.
   * Plans in the same wave run concurrently via Promise.allSettled().
   * Waves execute sequentially (wave 1 completes before wave 2 starts).
   * Respects config.parallelization: false to fall back to sequential execution.
   * Filters out plans with has_summary: true (already completed).
   */
  private async runExecuteStep(
    phaseNumber: string,
    sessionOpts: SessionOptions,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Execute,
    });

    // Get the plan index from gsd-tools
    let planIndex: PhasePlanIndex;
    try {
      planIndex = await this.tools.phasePlanIndex(phaseNumber);
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.Execute,
        success: false,
        durationMs,
        error: errorMsg,
      });
      return {
        step: PhaseStepType.Execute,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    // Filter to incomplete plans only (has_summary === false)
    const incompletePlans = planIndex.plans.filter(p => !p.has_summary);

    if (incompletePlans.length === 0) {
      const durationMs = Date.now() - stepStart;
      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.Execute,
        success: true,
        durationMs,
      });
      return {
        step: PhaseStepType.Execute,
        success: true,
        durationMs,
        planResults: [],
      };
    }

    const planResults: PlanResult[] = [];

    // Sequential fallback when parallelization is disabled
    if (this.config.parallelization === false) {
      for (const plan of incompletePlans) {
        const result = await this.executeSinglePlan(phaseNumber, plan.id, sessionOpts);
        planResults.push(result);
      }
    } else {
      // Group incomplete plans by wave, sort waves numerically
      const waveMap = new Map<number, PlanInfo[]>();
      for (const plan of incompletePlans) {
        const existing = waveMap.get(plan.wave) ?? [];
        existing.push(plan);
        waveMap.set(plan.wave, existing);
      }
      const sortedWaves = [...waveMap.keys()].sort((a, b) => a - b);

      for (const waveNum of sortedWaves) {
        const wavePlans = waveMap.get(waveNum)!;
        const wavePlanIds = wavePlans.map(p => p.id);

        // Emit wave_start
        this.eventStream.emitEvent({
          type: GSDEventType.WaveStart,
          timestamp: new Date().toISOString(),
          sessionId: '',
          phaseNumber,
          waveNumber: waveNum,
          planCount: wavePlans.length,
          planIds: wavePlanIds,
        });

        const waveStart = Date.now();

        // Execute all plans in this wave concurrently
        const settled = await Promise.allSettled(
          wavePlans.map(plan => this.executeSinglePlan(phaseNumber, plan.id, sessionOpts)),
        );

        // Map settled results to PlanResult[]
        let successCount = 0;
        let failureCount = 0;
        for (const outcome of settled) {
          if (outcome.status === 'fulfilled') {
            planResults.push(outcome.value);
            if (outcome.value.success) successCount++;
            else failureCount++;
          } else {
            failureCount++;
            planResults.push({
              success: false,
              sessionId: '',
              totalCostUsd: 0,
              durationMs: 0,
              usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
              numTurns: 0,
              error: {
                subtype: 'error_during_execution',
                messages: [outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)],
              },
            });
          }
        }

        // Emit wave_complete
        this.eventStream.emitEvent({
          type: GSDEventType.WaveComplete,
          timestamp: new Date().toISOString(),
          sessionId: '',
          phaseNumber,
          waveNumber: waveNum,
          successCount,
          failureCount,
          durationMs: Date.now() - waveStart,
        });
      }
    }

    const durationMs = Date.now() - stepStart;
    const allSucceeded = planResults.every(r => r.success);

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Execute,
      success: allSucceeded,
      durationMs,
    });

    return {
      step: PhaseStepType.Execute,
      success: allSucceeded,
      durationMs,
      planResults,
    };
  }

  /**
   * Execute a single plan by ID within the execute step.
   */
  private async executeSinglePlan(
    phaseNumber: string,
    planId: string,
    sessionOpts: SessionOptions,
  ): Promise<PlanResult> {
    try {
      const phaseType = PhaseType.Execute;
      const contextFiles = await this.contextEngine.resolveContextFiles(phaseType);
      const prompt = await this.promptFactory.buildPrompt(phaseType, null, contextFiles);

      return await runPhaseStepSession(
        prompt,
        PhaseStepType.Execute,
        this.config,
        sessionOpts,
        this.eventStream,
        { phase: phaseType, planName: planId },
      );
    } catch (err) {
      return {
        success: false,
        sessionId: '',
        totalCostUsd: 0,
        durationMs: 0,
        usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        numTurns: 0,
        error: {
          subtype: 'error_during_execution',
          messages: [err instanceof Error ? err.message : String(err)],
        },
      };
    }
  }

  /**
   * Run the verify step with full gap closure cycle.
   * Verification outcome routing:
   * - passed → proceed to advance
   * - human_needed → invoke onVerificationReview callback
   * - gaps_found → plan (create gap plans) → execute (run gap plans) → re-verify
   * Gap closure retries are capped at configurable maxGapRetries (default 1).
   */
  private async runVerifyStep(
    phaseNumber: string,
    sessionOpts: SessionOptions,
    callbacks: HumanGateCallbacks,
    options?: PhaseRunnerOptions,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Verify,
    });

    const maxGapRetries = options?.maxGapRetries ?? 1;
    let gapRetryCount = 0;
    let lastResult: PlanResult | undefined;
    let outcome: VerificationOutcome = 'passed';
    const allPlanResults: PlanResult[] = [];

    while (true) {
      try {
        const phaseType = PhaseType.Verify;
        const contextFiles = await this.contextEngine.resolveContextFiles(phaseType);
        const prompt = await this.promptFactory.buildPrompt(phaseType, null, contextFiles);

        lastResult = await runPhaseStepSession(
          prompt,
          PhaseStepType.Verify,
          this.config,
          sessionOpts,
          this.eventStream,
          { phase: phaseType },
        );
        allPlanResults.push(lastResult);
      } catch (err) {
        const durationMs = Date.now() - stepStart;
        const errorMsg = err instanceof Error ? err.message : String(err);

        this.eventStream.emitEvent({
          type: GSDEventType.PhaseStepComplete,
          timestamp: new Date().toISOString(),
          sessionId: '',
          phaseNumber,
          step: PhaseStepType.Verify,
          success: false,
          durationMs,
          error: errorMsg,
        });

        return {
          step: PhaseStepType.Verify,
          success: false,
          durationMs,
          error: errorMsg,
          planResults: allPlanResults.length > 0 ? allPlanResults : undefined,
        };
      }

      // Parse verification outcome from session result
      outcome = this.parseVerificationOutcome(lastResult);

      if (outcome === 'passed') {
        break;
      }

      if (outcome === 'human_needed') {
        // Invoke verification review callback
        const decision = await this.invokeVerificationCallback(callbacks, phaseNumber, {
          step: PhaseStepType.Verify,
          success: lastResult.success,
          durationMs: Date.now() - stepStart,
          planResults: allPlanResults,
        });

        if (decision === 'accept') {
          break; // Treat as passed
        } else if (decision === 'retry' && gapRetryCount < maxGapRetries) {
          gapRetryCount++;
          continue;
        } else {
          // reject or exceeded retries
          const durationMs = Date.now() - stepStart;
          this.eventStream.emitEvent({
            type: GSDEventType.PhaseStepComplete,
            timestamp: new Date().toISOString(),
            sessionId: lastResult.sessionId,
            phaseNumber,
            step: PhaseStepType.Verify,
            success: false,
            durationMs,
            error: 'halted_by_callback',
          });
          return {
            step: PhaseStepType.Verify,
            success: false,
            durationMs,
            error: 'halted_by_callback',
            planResults: allPlanResults,
          };
        }
      }

      if (outcome === 'gaps_found') {
        if (gapRetryCount < maxGapRetries) {
          gapRetryCount++;
          this.logger?.info(`Gap closure attempt ${gapRetryCount}/${maxGapRetries} for phase ${phaseNumber}`);

          // ── Gap closure cycle: plan → execute → re-verify ──

          // 1. Run a plan step to create gap plans
          try {
            const planResult = await this.runStep(PhaseStepType.Plan, phaseNumber, sessionOpts);
            if (planResult.planResults) {
              allPlanResults.push(...planResult.planResults);
            }
          } catch (err) {
            this.logger?.warn(`Gap closure plan step failed: ${err instanceof Error ? err.message : String(err)}`);
            // Proceed to re-verify anyway
          }

          // 2. Re-query phase state to discover newly created gap plans
          try {
            await this.tools.initPhaseOp(phaseNumber);
          } catch (err) {
            this.logger?.warn(`Gap closure re-query failed, proceeding with stale state: ${err instanceof Error ? err.message : String(err)}`);
          }

          // 3. Execute gap plans via the wave-capable runExecuteStep
          try {
            const executeResult = await this.runExecuteStep(phaseNumber, sessionOpts);
            if (executeResult.planResults) {
              allPlanResults.push(...executeResult.planResults);
            }
          } catch (err) {
            this.logger?.warn(`Gap closure execute step failed: ${err instanceof Error ? err.message : String(err)}`);
            // Proceed to re-verify anyway
          }

          // 4. Continue the loop to re-verify
          continue;
        }
        // Exceeded gap closure retries — proceed
        break;
      }

      break; // Safety: unknown outcome → proceed
    }

    const durationMs = Date.now() - stepStart;

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: lastResult?.sessionId ?? '',
      phaseNumber,
      step: PhaseStepType.Verify,
      success: true,
      durationMs,
    });

    return {
      step: PhaseStepType.Verify,
      success: true,
      durationMs,
      planResults: allPlanResults,
    };
  }

  /**
   * Run the advance step — mark phase complete.
   * Gated by config.workflow.auto_advance or callback approval.
   */
  private async runAdvanceStep(
    phaseNumber: string,
    _sessionOpts: SessionOptions,
    callbacks: HumanGateCallbacks,
  ): Promise<PhaseStepResult> {
    const stepStart = Date.now();

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepStart,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Advance,
    });

    // Check if auto_advance or callback approves
    let shouldAdvance = this.config.workflow.auto_advance;

    if (!shouldAdvance && callbacks.onBlockerDecision) {
      try {
        const decision = await callbacks.onBlockerDecision({
          phaseNumber,
          step: PhaseStepType.Advance,
          error: undefined,
        });
        shouldAdvance = decision !== 'stop';
      } catch (err) {
        this.logger?.warn(`Advance callback threw, auto-approving: ${err instanceof Error ? err.message : String(err)}`);
        shouldAdvance = true; // Auto-approve on callback error
      }
    } else if (!shouldAdvance) {
      // No callback, auto-approve
      shouldAdvance = true;
    }

    if (!shouldAdvance) {
      const durationMs = Date.now() - stepStart;
      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.Advance,
        success: false,
        durationMs,
        error: 'advance_rejected',
      });
      return {
        step: PhaseStepType.Advance,
        success: false,
        durationMs,
        error: 'advance_rejected',
      };
    }

    try {
      await this.tools.phaseComplete(phaseNumber);
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.eventStream.emitEvent({
        type: GSDEventType.PhaseStepComplete,
        timestamp: new Date().toISOString(),
        sessionId: '',
        phaseNumber,
        step: PhaseStepType.Advance,
        success: false,
        durationMs,
        error: errorMsg,
      });

      return {
        step: PhaseStepType.Advance,
        success: false,
        durationMs,
        error: errorMsg,
      };
    }

    const durationMs = Date.now() - stepStart;

    this.eventStream.emitEvent({
      type: GSDEventType.PhaseStepComplete,
      timestamp: new Date().toISOString(),
      sessionId: '',
      phaseNumber,
      step: PhaseStepType.Advance,
      success: true,
      durationMs,
    });

    return {
      step: PhaseStepType.Advance,
      success: true,
      durationMs,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Map PhaseStepType to PhaseType for prompt/context resolution.
   */
  private stepToPhaseType(step: PhaseStepType): PhaseType {
    const mapping: Record<string, PhaseType> = {
      [PhaseStepType.Discuss]: PhaseType.Discuss,
      [PhaseStepType.Research]: PhaseType.Research,
      [PhaseStepType.Plan]: PhaseType.Plan,
      [PhaseStepType.PlanCheck]: PhaseType.Verify,
      [PhaseStepType.Execute]: PhaseType.Execute,
      [PhaseStepType.Verify]: PhaseType.Verify,
    };
    return mapping[step] ?? PhaseType.Execute;
  }

  /**
   * Parse the verification outcome from a PlanResult.
   * In a real implementation, this would parse the session output for
   * structured verification signals. For now, map from success/error.
   */
  private parseVerificationOutcome(result: PlanResult): VerificationOutcome {
    if (result.success) return 'passed';
    if (result.error?.subtype === 'human_review_needed') return 'human_needed';
    return 'gaps_found';
  }

  /**
   * Invoke the onBlockerDecision callback, falling back to auto-approve.
   */
  private async invokeBlockerCallback(
    callbacks: HumanGateCallbacks,
    phaseNumber: string,
    step: PhaseStepType,
    error?: string,
  ): Promise<'retry' | 'skip' | 'stop'> {
    if (!callbacks.onBlockerDecision) {
      return 'skip'; // Auto-approve: skip the blocker
    }

    try {
      const decision = await callbacks.onBlockerDecision({ phaseNumber, step, error });
      // Validate return value
      if (decision === 'retry' || decision === 'skip' || decision === 'stop') {
        return decision;
      }
      this.logger?.warn(`Unexpected blocker callback return value: ${String(decision)}, falling back to skip`);
      return 'skip';
    } catch (err) {
      this.logger?.warn(`Blocker callback threw, auto-approving: ${err instanceof Error ? err.message : String(err)}`);
      return 'skip'; // Auto-approve on error
    }
  }

  /**
   * Invoke the onVerificationReview callback, falling back to auto-accept.
   */
  private async invokeVerificationCallback(
    callbacks: HumanGateCallbacks,
    phaseNumber: string,
    stepResult: PhaseStepResult,
  ): Promise<'accept' | 'reject' | 'retry'> {
    if (!callbacks.onVerificationReview) {
      return 'accept'; // Auto-approve
    }

    try {
      const decision = await callbacks.onVerificationReview({ phaseNumber, stepResult });
      if (decision === 'accept' || decision === 'reject' || decision === 'retry') {
        return decision;
      }
      this.logger?.warn(`Unexpected verification callback return value: ${String(decision)}, falling back to accept`);
      return 'accept';
    } catch (err) {
      this.logger?.warn(`Verification callback threw, auto-accepting: ${err instanceof Error ? err.message : String(err)}`);
      return 'accept'; // Auto-approve on error
    }
  }
}
