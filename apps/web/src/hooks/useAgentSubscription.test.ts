import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useExecutionStore } from '@/stores/executionStore';

// Mock RAF for token buffer
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
  cb();
  return 1;
});
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// Mock @gsd/events - vi.mock is hoisted, so we need to inline the values
vi.mock('@gsd/events', () => ({
  EVENTS: {
    AGENT_TOKEN: 'agent:token',
    AGENT_START: 'agent:start',
    AGENT_END: 'agent:end',
    AGENT_ERROR: 'agent:error',
    AGENT_PHASE: 'agent:phase',
    TOOL_START: 'agent:tool_start',
    TOOL_END: 'agent:tool_end',
    CHECKPOINT_REQUEST: 'checkpoint:request',
    CHECKPOINT_RESPONSE: 'checkpoint:response',
    CONNECTION_HEALTH: 'connection:health',
  },
  createTokenBuffer: vi.fn((_socket, _onUpdate) => {
    let tokens: string[] = [];
    return {
      get tokens() { return tokens; },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(() => { tokens = []; }),
    };
  }),
  createSocketClient: vi.fn(),
}));

// Event constants for test assertions
const EVENTS = {
  AGENT_TOKEN: 'agent:token',
  AGENT_START: 'agent:start',
  AGENT_END: 'agent:end',
  AGENT_ERROR: 'agent:error',
  AGENT_PHASE: 'agent:phase',
  TOOL_START: 'agent:tool_start',
  TOOL_END: 'agent:tool_end',
  CHECKPOINT_REQUEST: 'checkpoint:request',
  CHECKPOINT_RESPONSE: 'checkpoint:response',
  CONNECTION_HEALTH: 'connection:health',
} as const;

// Create mock socket with event listener management
function createMockSocket() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
      return socket;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(handler);
      return socket;
    }),
    emit: vi.fn(),
    // Helper to simulate server events
    _emit: (event: string, ...args: unknown[]) => {
      listeners.get(event)?.forEach((handler) => handler(...args));
    },
    connected: true,
  };

  return socket;
}

// Import after mock setup
import { useAgentSubscription } from './useAgentSubscription';

describe('useAgentSubscription', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    useExecutionStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
  });

  it('subscribes to agent room on mount', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    expect(mockSocket.emit).toHaveBeenCalledWith('agent:subscribe', 'agent-123');
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() =>
      // @ts-expect-error - mock socket type mismatch
      useAgentSubscription(mockSocket, 'agent-123')
    );

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('agent:unsubscribe', 'agent-123');
  });

  it('does not subscribe when socket is null', () => {
    renderHook(() => useAgentSubscription(null, 'agent-123'));

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('does not subscribe when agentId is null', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, null));

    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('processes AGENT_START event correctly', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    act(() => {
      mockSocket._emit(EVENTS.AGENT_START, {
        agentId: 'agent-123',
        planId: 'plan-1',
        taskName: 'Task 1',
      });
    });

    const state = useExecutionStore.getState();
    expect(state.agentId).toBe('agent-123');
    expect(state.status).toBe('running');
    expect(state.plans.get('plan-1')).toBeDefined();
    expect(state.plans.get('plan-1')?.taskName).toBe('Task 1');
  });

  it('ignores AGENT_START for different agent', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    act(() => {
      mockSocket._emit(EVENTS.AGENT_START, {
        agentId: 'different-agent',
        planId: 'plan-1',
        taskName: 'Task 1',
      });
    });

    const state = useExecutionStore.getState();
    expect(state.agentId).toBeNull();
  });

  it('processes TOOL_START event correctly', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    // Start execution first
    act(() => {
      mockSocket._emit(EVENTS.AGENT_START, {
        agentId: 'agent-123',
        planId: 'plan-1',
        taskName: 'Task 1',
      });
    });

    // Then tool start
    act(() => {
      mockSocket._emit(EVENTS.TOOL_START, {
        agentId: 'agent-123',
        toolId: 'tool-1',
        toolName: 'Read',
        input: { path: '/test.ts' },
        sequence: 1,
      });
    });

    const state = useExecutionStore.getState();
    const plan = state.plans.get('plan-1');
    expect(plan?.toolCalls).toHaveLength(1);
    expect(plan?.toolCalls[0]?.toolName).toBe('Read');
  });

  it('processes TOOL_END event correctly', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    // Start execution and tool
    act(() => {
      mockSocket._emit(EVENTS.AGENT_START, {
        agentId: 'agent-123',
        planId: 'plan-1',
        taskName: 'Task 1',
      });
      mockSocket._emit(EVENTS.TOOL_START, {
        agentId: 'agent-123',
        toolId: 'tool-1',
        toolName: 'Read',
        input: { path: '/test.ts' },
        sequence: 1,
      });
    });

    // End tool
    act(() => {
      mockSocket._emit(EVENTS.TOOL_END, {
        agentId: 'agent-123',
        toolId: 'tool-1',
        success: true,
        output: 'file contents',
        duration: 100,
        sequence: 2,
      });
    });

    const state = useExecutionStore.getState();
    const plan = state.plans.get('plan-1');
    expect(plan?.toolCalls[0]?.success).toBe(true);
    expect(plan?.toolCalls[0]?.output).toBe('file contents');
  });

  it('processes CHECKPOINT_REQUEST event', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    act(() => {
      mockSocket._emit(EVENTS.CHECKPOINT_REQUEST, {
        checkpointId: 'cp-1',
        type: 'human-verify',
        prompt: 'Please verify',
      });
    });

    const state = useExecutionStore.getState();
    expect(state.pendingCheckpoint?.checkpointId).toBe('cp-1');
    expect(state.pendingCheckpoint?.type).toBe('human-verify');
  });

  it('processes AGENT_END event and completes plan', () => {
    // @ts-expect-error - mock socket type mismatch
    renderHook(() => useAgentSubscription(mockSocket, 'agent-123'));

    // Start execution
    act(() => {
      mockSocket._emit(EVENTS.AGENT_START, {
        agentId: 'agent-123',
        planId: 'plan-1',
        taskName: 'Task 1',
      });
    });

    // End execution
    act(() => {
      mockSocket._emit(EVENTS.AGENT_END, {
        agentId: 'agent-123',
        status: 'success',
      });
    });

    const state = useExecutionStore.getState();
    expect(state.plans.get('plan-1')?.status).toBe('complete');
  });

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() =>
      // @ts-expect-error - mock socket type mismatch
      useAgentSubscription(mockSocket, 'agent-123')
    );

    unmount();

    expect(mockSocket.off).toHaveBeenCalledWith(EVENTS.AGENT_START, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith(EVENTS.AGENT_END, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith(EVENTS.TOOL_START, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith(EVENTS.TOOL_END, expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith(EVENTS.CHECKPOINT_REQUEST, expect.any(Function));
  });
});
