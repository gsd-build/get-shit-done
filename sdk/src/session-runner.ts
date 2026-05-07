/**
 * Session runner — orchestrates Agent SDK query() calls for plan execution.
 *
 * Takes a parsed plan, builds the executor prompt, configures query() options,
 * processes the message stream, and extracts results into a typed PlanResult.
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { SDKMessage, SDKResultMessage, SDKResultSuccess, SDKResultError } from '@anthropic-ai/claude-agent-sdk';
import type { ParsedPlan, PlanResult, SessionOptions, SessionUsage, GSDCostUpdateEvent, PhaseStepType } from './types.js';
import { GSDEventType, PhaseType } from './types.js';
import type { GSDConfig } from './config.js';
import { buildExecutorPrompt, parseAgentTools, DEFAULT_ALLOWED_TOOLS } from './prompt-builder.js';
import type { GSDEventStream, EventStreamContext } from './event-stream.js';
import { getToolsForPhase } from './tool-scoping.js';
import { detectRuntime } from './query/helpers.js';
import { resolveRuntimeTierDefault } from './model-catalog.js';

// ─── Model resolution ────────────────────────────────────────────────────────

/**
 * Resolve model identifier from options or config profile.
 *
 * Priority: explicit model option > config model_profile > default.
 *
 * Runtime-aware (#2832): the profile -> Claude-id map only applies when the
 * project is targeting the Claude runtime. For Codex, Gemini, OpenCode, etc.,
 * forcing a Claude model id (e.g. 'claude-sonnet-4-6') silently routes the
 * autonomous run through the Claude path, which is wrong for those runtimes.
 * In those cases — and whenever `resolve_model_ids: "omit"` is set — leave
 * `model` unset so the runtime falls back to its configured default.
 */
function resolveModel(options?: SessionOptions, config?: GSDConfig): string | undefined {
  if (options?.model) return options.model;

  // Honor the explicit "don't resolve model ids" config knob (#2652, #2832).
  // Mirrors `query/config-query.ts` resolve_model_ids === 'omit' branch.
  if ((config as Record<string, unknown> | undefined)?.resolve_model_ids === 'omit') {
    return undefined;
  }

  // Profile -> Claude id map. Applies only on the Claude runtime.
  // Use `detectRuntime` so `GSD_RUNTIME` env precedence is honored — a Codex
  // run with a Claude-shaped config must NOT be silently routed to Claude.
  const runtime = detectRuntime({
    runtime: (config as Record<string, unknown> | undefined)?.runtime,
  });
  if (runtime !== 'claude') {
    // Non-Claude runtimes: never inject a Claude id from the profile map.
    return undefined;
  }

  if (config?.model_profile) {
    const profile = String(config.model_profile).toLowerCase();
    const tier = profile === 'quality' ? 'opus'
      : (profile === 'budget' || profile === 'speed') ? 'haiku'
      : (profile === 'balanced' || profile === 'adaptive') ? 'sonnet'
      : null;
    if (!tier) return config.model_profile;
    return resolveRuntimeTierDefault('claude', tier)?.model;
  }

  return undefined; // Let SDK use its default
}

// ─── Session runner ──────────────────────────────────────────────────────────

/**
 * Run a plan execution session via the Agent SDK query() function.
 *
 * Builds the executor prompt from the parsed plan, configures query() with
 * appropriate permissions, tool restrictions, and budget limits, then iterates
 * the message stream to extract the result.
 *
 * @param plan - Parsed plan structure
 * @param config - GSD project configuration
 * @param options - Session overrides (maxTurns, budget, model, etc.)
 * @param agentDef - Raw agent definition content (optional, for tool/role extraction)
 * @returns Typed PlanResult with cost, duration, success/error status
 */
export async function runPlanSession(
  plan: ParsedPlan,
  config: GSDConfig,
  options?: SessionOptions,
  agentDef?: string,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
  phaseDir?: string,
): Promise<PlanResult> {
  // Build the executor prompt
  const executorPrompt = buildExecutorPrompt(plan, { agentDef, phaseDir });

  // Resolve allowed tools — from agent definition or defaults
  const allowedTools = options?.allowedTools ??
    (agentDef ? parseAgentTools(agentDef) : DEFAULT_ALLOWED_TOOLS);

  // Resolve model
  const model = resolveModel(options, config);

  // Configure query options
  const maxTurns = options?.maxTurns ?? 50;
  const maxBudgetUsd = options?.maxBudgetUsd ?? 5.0;
  const cwd = options?.cwd ?? process.cwd();

  const queryStream = query({
    prompt: `Execute this plan:\n\n${plan.objective || 'Execute the plan tasks below.'}`,
    options: {
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: executorPrompt,
      },
      settingSources: ['project'],
      allowedTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns,
      maxBudgetUsd,
      cwd,
      ...(model ? { model } : {}),
    },
  });

  return processQueryStream(queryStream, eventStream, streamContext);
}

// ─── Result extraction ───────────────────────────────────────────────────────

function isResultMessage(msg: SDKMessage): msg is SDKResultMessage {
  return msg.type === 'result';
}

function isSuccessResult(msg: SDKResultMessage): msg is SDKResultSuccess {
  return msg.subtype === 'success';
}

function isErrorResult(msg: SDKResultMessage): msg is SDKResultError {
  return msg.subtype !== 'success';
}

function emptyUsage(): SessionUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  };
}

function extractUsage(msg: SDKResultMessage): SessionUsage {
  const u = msg.usage;
  return {
    inputTokens: u.input_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
    cacheReadInputTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: u.cache_creation_input_tokens ?? 0,
  };
}

function extractResult(msg: SDKResultMessage): PlanResult {
  const base = {
    sessionId: msg.session_id,
    totalCostUsd: msg.total_cost_usd,
    durationMs: msg.duration_ms,
    usage: extractUsage(msg),
    numTurns: msg.num_turns,
  };

  if (isSuccessResult(msg)) {
    return {
      ...base,
      success: true,
    };
  }

  // Error result
  const errorMsg = msg as SDKResultError;
  return {
    ...base,
    success: false,
    error: {
      subtype: errorMsg.subtype,
      messages: errorMsg.errors ?? [],
    },
  };
}

// ─── Shared stream processing ────────────────────────────────────────────────

/**
 * Process a query() message stream, emit events, and extract the result.
 * Shared between runPlanSession and runPhaseStepSession to avoid duplication.
 */
async function processQueryStream(
  queryStream: AsyncIterable<SDKMessage>,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
): Promise<PlanResult> {
  let resultMessage: SDKResultMessage | undefined;

  try {
    for await (const message of queryStream) {
      if (eventStream) {
        eventStream.mapAndEmit(message, streamContext ?? {});
      }
      if (isResultMessage(message)) {
        resultMessage = message;
      }
    }
  } catch (err) {
    return {
      success: false,
      sessionId: '',
      totalCostUsd: 0,
      durationMs: 0,
      usage: emptyUsage(),
      numTurns: 0,
      error: {
        subtype: 'error_during_execution',
        messages: [err instanceof Error ? err.message : String(err)],
      },
    };
  }

  if (!resultMessage) {
    return {
      success: false,
      sessionId: '',
      totalCostUsd: 0,
      durationMs: 0,
      usage: emptyUsage(),
      numTurns: 0,
      error: {
        subtype: 'error_during_execution',
        messages: ['No result message received from query stream'],
      },
    };
  }

  const result = extractResult(resultMessage);

  if (eventStream) {
    const cost = eventStream.getCost();
    eventStream.emitEvent({
      type: GSDEventType.CostUpdate,
      timestamp: new Date().toISOString(),
      sessionId: resultMessage.session_id,
      phase: streamContext?.phase,
      planName: streamContext?.planName,
      sessionCostUsd: result.totalCostUsd,
      cumulativeCostUsd: cost.cumulative,
    } as GSDCostUpdateEvent);
  }

  return result;
}

// ─── Phase step session runner ───────────────────────────────────────────────

/**
 * Map PhaseStepType to PhaseType for tool scoping.
 * PhaseStepType includes 'advance' which has no session-level equivalent.
 */
function stepTypeToPhaseType(step: PhaseStepType): PhaseType {
  const mapping: Record<string, PhaseType> = {
    discuss: PhaseType.Discuss,
    research: PhaseType.Research,
    plan: PhaseType.Plan,
    plan_check: PhaseType.Verify,
    execute: PhaseType.Execute,
    verify: PhaseType.Verify,
  };
  return mapping[step] ?? PhaseType.Execute;
}

/**
 * Run a phase step session via the Agent SDK query() function.
 *
 * Unlike runPlanSession which takes a ParsedPlan, this accepts a raw prompt
 * string and a phase step type. The prompt becomes the system prompt append,
 * and tools are scoped by phase type.
 *
 * @param prompt - Raw prompt string to append to the system prompt
 * @param phaseStep - Phase step type (determines tool scoping)
 * @param config - GSD project configuration
 * @param options - Session overrides (maxTurns, budget, model, etc.)
 * @param eventStream - Optional event stream for observability
 * @param streamContext - Optional context for event tagging
 * @returns Typed PlanResult with cost, duration, success/error status
 */
export async function runPhaseStepSession(
  prompt: string,
  phaseStep: PhaseStepType,
  config: GSDConfig,
  options?: SessionOptions,
  eventStream?: GSDEventStream,
  streamContext?: EventStreamContext,
): Promise<PlanResult> {
  const phaseType = stepTypeToPhaseType(phaseStep);
  const allowedTools = options?.allowedTools ?? getToolsForPhase(phaseType);
  const model = resolveModel(options, config);
  const maxTurns = options?.maxTurns ?? 50;
  const maxBudgetUsd = options?.maxBudgetUsd ?? 5.0;
  const cwd = options?.cwd ?? process.cwd();

  const queryStream = query({
    prompt: `Execute this phase step: ${phaseStep}`,
    options: {
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: prompt,
      },
      settingSources: ['project'],
      allowedTools,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      maxTurns,
      maxBudgetUsd,
      cwd,
      ...(model ? { model } : {}),
    },
  });

  return processQueryStream(queryStream, eventStream, streamContext);
}
