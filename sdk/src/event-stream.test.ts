import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GSDEventStream } from './event-stream.js';
import {
  GSDEventType,
  PhaseType,
  type GSDEvent,
  type GSDSessionInitEvent,
  type GSDSessionCompleteEvent,
  type GSDSessionErrorEvent,
  type GSDAssistantTextEvent,
  type GSDToolCallEvent,
  type GSDToolProgressEvent,
  type GSDToolUseSummaryEvent,
  type GSDTaskStartedEvent,
  type GSDTaskProgressEvent,
  type GSDTaskNotificationEvent,
  type GSDAPIRetryEvent,
  type GSDRateLimitEvent,
  type GSDStatusChangeEvent,
  type GSDCompactBoundaryEvent,
  type GSDStreamEvent,
  type GSDCostUpdateEvent,
  type TransportHandler,
} from './types.js';
import type {
  SDKMessage,
  SDKSystemMessage,
  SDKAssistantMessage,
  SDKResultSuccess,
  SDKResultError,
  SDKToolProgressMessage,
  SDKToolUseSummaryMessage,
  SDKTaskStartedMessage,
  SDKTaskProgressMessage,
  SDKTaskNotificationMessage,
  SDKAPIRetryMessage,
  SDKRateLimitEvent,
  SDKStatusMessage,
  SDKCompactBoundaryMessage,
  SDKPartialAssistantMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { UUID } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_UUID = '00000000-0000-0000-0000-000000000000' as UUID;
const TEST_SESSION = 'test-session-1';

function makeSystemInit(): SDKSystemMessage {
  return {
    type: 'system',
    subtype: 'init',
    agents: [],
    apiKeySource: 'user',
    betas: [],
    claude_code_version: '1.0.0',
    cwd: '/test',
    tools: ['Read', 'Write', 'Bash'],
    mcp_servers: [],
    model: 'claude-sonnet-4-6',
    permissionMode: 'bypassPermissions',
    slash_commands: [],
    output_style: 'text',
    skills: [],
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKSystemMessage;
}

function makeAssistantMsg(content: Array<{ type: string; [key: string]: unknown }>): SDKAssistantMessage {
  return {
    type: 'assistant',
    message: {
      content,
      id: 'msg-1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-4-6',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: 100, output_tokens: 50 },
    } as unknown as SDKAssistantMessage['message'],
    parent_tool_use_id: null,
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKAssistantMessage;
}

function makeResultSuccess(costUsd = 0.05): SDKResultSuccess {
  return {
    type: 'result',
    subtype: 'success',
    duration_ms: 5000,
    duration_api_ms: 4000,
    is_error: false,
    num_turns: 3,
    result: 'Task completed successfully',
    stop_reason: 'end_turn',
    total_cost_usd: costUsd,
    usage: { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    modelUsage: {},
    permission_denials: [],
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKResultSuccess;
}

function makeResultError(): SDKResultError {
  return {
    type: 'result',
    subtype: 'error_max_turns',
    duration_ms: 10000,
    duration_api_ms: 8000,
    is_error: true,
    num_turns: 50,
    stop_reason: null,
    total_cost_usd: 2.50,
    usage: { input_tokens: 5000, output_tokens: 2000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    modelUsage: {},
    permission_denials: [],
    errors: ['Max turns exceeded'],
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKResultError;
}

function makeToolProgress(): SDKToolProgressMessage {
  return {
    type: 'tool_progress',
    tool_use_id: 'tu-1',
    tool_name: 'Bash',
    parent_tool_use_id: null,
    elapsed_time_seconds: 5.2,
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKToolProgressMessage;
}

function makeToolUseSummary(): SDKToolUseSummaryMessage {
  return {
    type: 'tool_use_summary',
    summary: 'Ran 3 bash commands',
    preceding_tool_use_ids: ['tu-1', 'tu-2', 'tu-3'],
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKToolUseSummaryMessage;
}

function makeTaskStarted(): SDKTaskStartedMessage {
  return {
    type: 'system',
    subtype: 'task_started',
    task_id: 'task-1',
    description: 'Running test suite',
    task_type: 'local_workflow',
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKTaskStartedMessage;
}

function makeTaskProgress(): SDKTaskProgressMessage {
  return {
    type: 'system',
    subtype: 'task_progress',
    task_id: 'task-1',
    description: 'Running tests',
    usage: { total_tokens: 500, tool_uses: 3, duration_ms: 2000 },
    last_tool_name: 'Bash',
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKTaskProgressMessage;
}

function makeTaskNotification(): SDKTaskNotificationMessage {
  return {
    type: 'system',
    subtype: 'task_notification',
    task_id: 'task-1',
    status: 'completed',
    output_file: '/tmp/output.txt',
    summary: 'All tests passed',
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKTaskNotificationMessage;
}

function makeAPIRetry(): SDKAPIRetryMessage {
  return {
    type: 'system',
    subtype: 'api_retry',
    attempt: 2,
    max_retries: 5,
    retry_delay_ms: 1000,
    error_status: 529,
    error: 'server_error',
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKAPIRetryMessage;
}

function makeRateLimitEvent(): SDKRateLimitEvent {
  return {
    type: 'rate_limit_event',
    rate_limit_info: {
      status: 'allowed_warning',
      resetsAt: Date.now() + 60000,
      utilization: 0.85,
    },
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKRateLimitEvent;
}

function makeStatusMessage(): SDKStatusMessage {
  return {
    type: 'system',
    subtype: 'status',
    status: 'compacting',
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKStatusMessage;
}

function makeCompactBoundary(): SDKCompactBoundaryMessage {
  return {
    type: 'system',
    subtype: 'compact_boundary',
    compact_metadata: {
      trigger: 'auto',
      pre_tokens: 95000,
    },
    uuid: TEST_UUID,
    session_id: TEST_SESSION,
  } as SDKCompactBoundaryMessage;
}

// ─── SDKMessage → GSDEvent mapping tests ─────────────────────────────────────

describe('GSDEventStream', () => {
  let stream: GSDEventStream;

  beforeEach(() => {
    stream = new GSDEventStream();
  });

  describe('mapSDKMessage', () => {
    it('maps SDKSystemMessage init → SessionInit', () => {
      const event = stream.mapSDKMessage(makeSystemInit());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.SessionInit);

      const init = event as GSDSessionInitEvent;
      expect(init.model).toBe('claude-sonnet-4-6');
      expect(init.tools).toEqual(['Read', 'Write', 'Bash']);
      expect(init.cwd).toBe('/test');
      expect(init.sessionId).toBe(TEST_SESSION);
    });

    it('maps assistant text blocks → AssistantText', () => {
      const msg = makeAssistantMsg([
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
      ]);
      const event = stream.mapSDKMessage(msg);
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.AssistantText);
      expect((event as GSDAssistantTextEvent).text).toBe('Hello world');
    });

    it('maps assistant tool_use blocks → ToolCall', () => {
      const msg = makeAssistantMsg([
        { type: 'tool_use', id: 'tu-1', name: 'Read', input: { path: 'test.ts' } },
      ]);
      const event = stream.mapSDKMessage(msg);
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.ToolCall);

      const tc = event as GSDToolCallEvent;
      expect(tc.toolName).toBe('Read');
      expect(tc.toolUseId).toBe('tu-1');
      expect(tc.input).toEqual({ path: 'test.ts' });
    });

    it('handles multi-block assistant messages (text + tool_use)', () => {
      const events: GSDEvent[] = [];
      stream.on('event', (e: GSDEvent) => events.push(e));

      const msg = makeAssistantMsg([
        { type: 'text', text: 'Let me check that.' },
        { type: 'tool_use', id: 'tu-1', name: 'Read', input: { path: 'f.ts' } },
      ]);

      // mapAndEmit will emit the text event directly and return the tool_call
      const returned = stream.mapAndEmit(msg);
      expect(returned).not.toBeNull();

      // Should have received 2 events total
      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe(GSDEventType.AssistantText);
      expect(events[1]!.type).toBe(GSDEventType.ToolCall);
    });

    it('maps SDKResultSuccess → SessionComplete', () => {
      const event = stream.mapSDKMessage(makeResultSuccess());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.SessionComplete);

      const complete = event as GSDSessionCompleteEvent;
      expect(complete.success).toBe(true);
      expect(complete.totalCostUsd).toBe(0.05);
      expect(complete.durationMs).toBe(5000);
      expect(complete.numTurns).toBe(3);
      expect(complete.result).toBe('Task completed successfully');
    });

    it('maps SDKResultError → SessionError', () => {
      const event = stream.mapSDKMessage(makeResultError());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.SessionError);

      const err = event as GSDSessionErrorEvent;
      expect(err.success).toBe(false);
      expect(err.errorSubtype).toBe('error_max_turns');
      expect(err.errors).toContain('Max turns exceeded');
    });

    it('maps SDKToolProgressMessage → ToolProgress', () => {
      const event = stream.mapSDKMessage(makeToolProgress());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.ToolProgress);

      const tp = event as GSDToolProgressEvent;
      expect(tp.toolName).toBe('Bash');
      expect(tp.toolUseId).toBe('tu-1');
      expect(tp.elapsedSeconds).toBe(5.2);
    });

    it('maps SDKToolUseSummaryMessage → ToolUseSummary', () => {
      const event = stream.mapSDKMessage(makeToolUseSummary());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.ToolUseSummary);

      const tus = event as GSDToolUseSummaryEvent;
      expect(tus.summary).toBe('Ran 3 bash commands');
      expect(tus.toolUseIds).toEqual(['tu-1', 'tu-2', 'tu-3']);
    });

    it('maps SDKTaskStartedMessage → TaskStarted', () => {
      const event = stream.mapSDKMessage(makeTaskStarted());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.TaskStarted);

      const ts = event as GSDTaskStartedEvent;
      expect(ts.taskId).toBe('task-1');
      expect(ts.description).toBe('Running test suite');
      expect(ts.taskType).toBe('local_workflow');
    });

    it('maps SDKTaskProgressMessage → TaskProgress', () => {
      const event = stream.mapSDKMessage(makeTaskProgress());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.TaskProgress);

      const tp = event as GSDTaskProgressEvent;
      expect(tp.taskId).toBe('task-1');
      expect(tp.totalTokens).toBe(500);
      expect(tp.toolUses).toBe(3);
      expect(tp.lastToolName).toBe('Bash');
    });

    it('maps SDKTaskNotificationMessage → TaskNotification', () => {
      const event = stream.mapSDKMessage(makeTaskNotification());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.TaskNotification);

      const tn = event as GSDTaskNotificationEvent;
      expect(tn.taskId).toBe('task-1');
      expect(tn.status).toBe('completed');
      expect(tn.summary).toBe('All tests passed');
    });

    it('maps SDKAPIRetryMessage → APIRetry', () => {
      const event = stream.mapSDKMessage(makeAPIRetry());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.APIRetry);

      const retry = event as GSDAPIRetryEvent;
      expect(retry.attempt).toBe(2);
      expect(retry.maxRetries).toBe(5);
      expect(retry.retryDelayMs).toBe(1000);
      expect(retry.errorStatus).toBe(529);
    });

    it('maps SDKRateLimitEvent → RateLimit', () => {
      const event = stream.mapSDKMessage(makeRateLimitEvent());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.RateLimit);

      const rl = event as GSDRateLimitEvent;
      expect(rl.status).toBe('allowed_warning');
      expect(rl.utilization).toBe(0.85);
    });

    it('maps SDKStatusMessage → StatusChange', () => {
      const event = stream.mapSDKMessage(makeStatusMessage());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.StatusChange);
      expect((event as GSDStatusChangeEvent).status).toBe('compacting');
    });

    it('maps SDKCompactBoundaryMessage → CompactBoundary', () => {
      const event = stream.mapSDKMessage(makeCompactBoundary());
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.CompactBoundary);

      const cb = event as GSDCompactBoundaryEvent;
      expect(cb.trigger).toBe('auto');
      expect(cb.preTokens).toBe(95000);
    });

    it('returns null for user messages', () => {
      const msg = { type: 'user', session_id: TEST_SESSION } as SDKMessage;
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });

    it('returns null for auth_status messages', () => {
      const msg = { type: 'auth_status', session_id: TEST_SESSION } as SDKMessage;
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });

    it('returns null for prompt_suggestion messages', () => {
      const msg = { type: 'prompt_suggestion', session_id: TEST_SESSION } as SDKMessage;
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });

    it('includes phase and planName context when provided', () => {
      const event = stream.mapSDKMessage(makeSystemInit(), {
        phase: PhaseType.Execute,
        planName: 'feature-plan',
      });

      expect(event!.phase).toBe(PhaseType.Execute);
      expect(event!.planName).toBe('feature-plan');
    });
  });

  // ─── Cost tracking ─────────────────────────────────────────────────────

  describe('cost tracking', () => {
    it('tracks per-session cost on session_complete', () => {
      stream.mapSDKMessage(makeResultSuccess(0.05));

      const cost = stream.getCost();
      expect(cost.session).toBe(0.05);
      expect(cost.cumulative).toBe(0.05);
    });

    it('accumulates cumulative cost across multiple sessions', () => {
      // Session 1
      const result1 = makeResultSuccess(0.05);
      result1.session_id = 'session-1';
      stream.mapSDKMessage(result1);

      // Session 2
      const result2 = makeResultSuccess(0.10);
      result2.session_id = 'session-2';
      stream.mapSDKMessage(result2);

      const cost = stream.getCost();
      // Current session is session-2 (last one updated)
      expect(cost.session).toBe(0.10);
      expect(cost.cumulative).toBeCloseTo(0.15, 10);
    });

    it('correctly computes delta when same session updates cost', () => {
      // Session reports intermediate cost, then final cost
      const result1 = makeResultSuccess(0.03);
      stream.mapSDKMessage(result1);

      const result2 = makeResultSuccess(0.05);
      stream.mapSDKMessage(result2);

      const cost = stream.getCost();
      expect(cost.session).toBe(0.05);
      // Cumulative should be 0.05, not 0.08 (delta was +0.02, not +0.05)
      expect(cost.cumulative).toBeCloseTo(0.05, 10);
    });

    it('tracks error session costs too', () => {
      stream.mapSDKMessage(makeResultError());

      const cost = stream.getCost();
      expect(cost.session).toBe(2.50);
      expect(cost.cumulative).toBe(2.50);
    });
  });

  // ─── Transport management ──────────────────────────────────────────────

  describe('transport management', () => {
    it('delivers events to subscribed transports', () => {
      const received: GSDEvent[] = [];
      const transport: TransportHandler = {
        onEvent: (event) => received.push(event),
        close: () => {},
      };

      stream.addTransport(transport);
      stream.mapAndEmit(makeSystemInit());

      expect(received).toHaveLength(1);
      expect(received[0]!.type).toBe(GSDEventType.SessionInit);
    });

    it('delivers events to multiple transports', () => {
      const received1: GSDEvent[] = [];
      const received2: GSDEvent[] = [];

      stream.addTransport({
        onEvent: (e) => received1.push(e),
        close: () => {},
      });
      stream.addTransport({
        onEvent: (e) => received2.push(e),
        close: () => {},
      });

      stream.mapAndEmit(makeSystemInit());

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('stops delivering events after transport removal', () => {
      const received: GSDEvent[] = [];
      const transport: TransportHandler = {
        onEvent: (e) => received.push(e),
        close: () => {},
      };

      stream.addTransport(transport);
      stream.mapAndEmit(makeSystemInit());
      expect(received).toHaveLength(1);

      stream.removeTransport(transport);
      stream.mapAndEmit(makeResultSuccess());
      expect(received).toHaveLength(1); // No new events
    });

    it('survives transport.onEvent() throwing', () => {
      const badTransport: TransportHandler = {
        onEvent: () => { throw new Error('transport failed'); },
        close: () => {},
      };
      const goodReceived: GSDEvent[] = [];
      const goodTransport: TransportHandler = {
        onEvent: (e) => goodReceived.push(e),
        close: () => {},
      };

      stream.addTransport(badTransport);
      stream.addTransport(goodTransport);

      // Should not throw, and good transport still receives events
      expect(() => stream.mapAndEmit(makeSystemInit())).not.toThrow();
      expect(goodReceived).toHaveLength(1);
    });

    it('closeAll() calls close on all transports and clears them', () => {
      const closeCalled: boolean[] = [];
      stream.addTransport({
        onEvent: () => {},
        close: () => closeCalled.push(true),
      });
      stream.addTransport({
        onEvent: () => {},
        close: () => closeCalled.push(true),
      });

      stream.closeAll();
      expect(closeCalled).toHaveLength(2);

      // No more deliveries after closeAll
      const events: GSDEvent[] = [];
      stream.on('event', (e: GSDEvent) => events.push(e));
      stream.mapAndEmit(makeSystemInit());
      // EventEmitter listeners still work, but transports are gone
      expect(events).toHaveLength(1);
    });
  });

  // ─── EventEmitter integration ──────────────────────────────────────────

  describe('EventEmitter integration', () => {
    it('emits typed events via "event" channel', () => {
      const events: GSDEvent[] = [];
      stream.on('event', (e: GSDEvent) => events.push(e));

      stream.mapAndEmit(makeSystemInit());
      stream.mapAndEmit(makeResultSuccess());

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe(GSDEventType.SessionInit);
      expect(events[1]!.type).toBe(GSDEventType.SessionComplete);
    });

    it('emits events on per-type channels', () => {
      const initEvents: GSDEvent[] = [];
      stream.on(GSDEventType.SessionInit, (e: GSDEvent) => initEvents.push(e));

      stream.mapAndEmit(makeSystemInit());
      stream.mapAndEmit(makeResultSuccess());

      expect(initEvents).toHaveLength(1);
      expect(initEvents[0]!.type).toBe(GSDEventType.SessionInit);
    });
  });

  // ─── Stream event mapping ──────────────────────────────────────────────

  describe('stream_event mapping', () => {
    it('maps SDKPartialAssistantMessage → StreamEvent', () => {
      const msg = {
        type: 'stream_event' as const,
        event: { type: 'content_block_delta' },
        parent_tool_use_id: null,
        uuid: TEST_UUID,
        session_id: TEST_SESSION,
      } as SDKPartialAssistantMessage;

      const event = stream.mapSDKMessage(msg);
      expect(event).not.toBeNull();
      expect(event!.type).toBe(GSDEventType.StreamEvent);
      expect((event as GSDStreamEvent).event).toEqual({ type: 'content_block_delta' });
    });
  });

  // ─── Empty / edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for assistant messages with empty content', () => {
      const msg = makeAssistantMsg([]);
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });

    it('returns null for assistant messages with only empty text', () => {
      const msg = makeAssistantMsg([{ type: 'text', text: '' }]);
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });

    it('returns null for unknown system subtypes', () => {
      const msg = {
        type: 'system',
        subtype: 'unknown_future_type',
        session_id: TEST_SESSION,
        uuid: TEST_UUID,
      } as unknown as SDKMessage;
      expect(stream.mapSDKMessage(msg)).toBeNull();
    });
  });
});
