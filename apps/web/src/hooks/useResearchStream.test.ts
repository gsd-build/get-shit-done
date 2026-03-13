import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResearchStream } from './useResearchStream';
import { usePlanStore } from '@/stores/planStore';
import type { TypedSocket } from '@gsd/events';
import type { AgentStartEvent, AgentEndEvent, AgentErrorEvent } from '@gsd/events';

// Create a mock socket that stores event handlers
function createMockSocket() {
  const handlers: Map<string, Array<(...args: unknown[]) => void>> = new Map();

  return {
    connected: true,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) {
        handlers.set(event, []);
      }
      handlers.get(event)!.push(handler);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        const index = eventHandlers.indexOf(handler);
        if (index > -1) {
          eventHandlers.splice(index, 1);
        }
      }
    }),
    emit: vi.fn(),
    // Helper to simulate server events
    _emit: (event: string, data: unknown) => {
      const eventHandlers = handlers.get(event);
      if (eventHandlers) {
        eventHandlers.forEach((handler) => handler(data));
      }
    },
    _handlers: handlers,
  };
}

describe('useResearchStream', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    // Reset the plan store before each test
    usePlanStore.getState().resetPlanState();
    mockSocket = createMockSocket();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('subscription lifecycle', () => {
    it('subscribes to agent:start events on mount', () => {
      renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      expect(mockSocket.emit).toHaveBeenCalledWith('research:subscribe', 'phase-15');
      expect(mockSocket.on).toHaveBeenCalledWith('agent:start', expect.any(Function));
    });

    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      unmount();

      expect(mockSocket.emit).toHaveBeenCalledWith('research:unsubscribe');
      expect(mockSocket.off).toHaveBeenCalledWith('agent:start', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('agent:end', expect.any(Function));
      expect(mockSocket.off).toHaveBeenCalledWith('agent:error', expect.any(Function));
    });

    it('does nothing when socket is null', () => {
      const { result } = renderHook(() => useResearchStream(null, 'phase-15'));

      expect(result.current.agents.size).toBe(0);
    });
  });

  describe('agent:start event', () => {
    it('updates store when agent:start received', async () => {
      renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      const startEvent: AgentStartEvent = {
        agentId: 'agent-1',
        planId: 'plan-1',
        taskName: 'Research API patterns',
      };

      act(() => {
        mockSocket._emit('agent:start', startEvent);
      });

      await waitFor(() => {
        const agents = usePlanStore.getState().agents;
        expect(agents.get('agent-1')).toBeDefined();
        expect(agents.get('agent-1')?.name).toBe('Research API patterns');
        expect(agents.get('agent-1')?.status).toBe('running');
      });
    });
  });

  describe('agent:end event', () => {
    it('updates store when agent:end received', async () => {
      // First add an agent
      usePlanStore.getState().addAgent({ id: 'agent-1', name: 'Test Agent' });
      usePlanStore.getState().updateAgentStatus('agent-1', 'running');

      renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      const endEvent: AgentEndEvent = {
        agentId: 'agent-1',
        status: 'success',
        summary: 'Analyzed 3 files successfully',
      };

      act(() => {
        mockSocket._emit('agent:end', endEvent);
      });

      await waitFor(() => {
        const agents = usePlanStore.getState().agents;
        expect(agents.get('agent-1')?.status).toBe('complete');
        expect(agents.get('agent-1')?.summary).toBe('Analyzed 3 files successfully');
      });
    });
  });

  describe('agent:error event', () => {
    it('updates store when agent:error received', async () => {
      // First add an agent
      usePlanStore.getState().addAgent({ id: 'agent-1', name: 'Test Agent' });
      usePlanStore.getState().updateAgentStatus('agent-1', 'running');

      renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      const errorEvent: AgentErrorEvent = {
        agentId: 'agent-1',
        code: 'TIMEOUT',
        message: 'Request timed out after 30s',
      };

      act(() => {
        mockSocket._emit('agent:error', errorEvent);
      });

      await waitFor(() => {
        const agents = usePlanStore.getState().agents;
        expect(agents.get('agent-1')?.status).toBe('error');
        expect(agents.get('agent-1')?.error).toBe('Request timed out after 30s');
      });
    });
  });

  describe('return value', () => {
    it('returns agents and isLoading from store', () => {
      const { result } = renderHook(() =>
        useResearchStream(mockSocket as unknown as TypedSocket, 'phase-15')
      );

      expect(result.current.agents).toBeInstanceOf(Map);
      expect(typeof result.current.isLoading).toBe('boolean');
    });
  });
});
