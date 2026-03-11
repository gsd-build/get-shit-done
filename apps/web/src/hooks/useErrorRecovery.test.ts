import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useErrorRecovery } from './useErrorRecovery';
import { useExecutionStore } from '@/stores/executionStore';
import type { AgentErrorEvent } from '@gsd/events';

// Test data factories
function createErrorEvent(overrides: Partial<AgentErrorEvent> = {}): AgentErrorEvent {
  return {
    agentId: 'agent-123',
    code: 'EXECUTION_ERROR',
    message: 'Task failed due to unexpected error',
    ...overrides,
  };
}

interface RetryContext {
  planId: string;
  taskName: string;
  projectPath: string;
  lastCheckpointId?: string;
}

function createRetryContext(overrides: Partial<RetryContext> = {}): RetryContext {
  const base: RetryContext = {
    planId: 'plan-1',
    taskName: 'Task 1',
    projectPath: '/project/path',
  };
  // Only include lastCheckpointId if provided
  if (overrides.lastCheckpointId !== undefined) {
    return { ...base, ...overrides };
  }
  return { ...base, ...overrides };
}

// Track request body for assertions
let lastRequestBody: Record<string, unknown> | null = null;

describe('useErrorRecovery', () => {
  const originalFetch = global.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.getState().reset();
    lastRequestBody = null;

    // Mock fetch to capture request body
    mockFetch = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
      if (options?.body) {
        lastRequestBody = JSON.parse(options.body as string);
      }
      return {
        ok: true,
        json: () => Promise.resolve({ agentId: 'new-agent-456' }),
      };
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe('retryFromCurrentTask', () => {
    it('calls POST /api/agents with lastCheckpoint context', async () => {
      const error = createErrorEvent();
      const context = createRetryContext({ lastCheckpointId: 'cp-123' });

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      expect(lastRequestBody).toEqual({
        planId: 'plan-1',
        taskName: 'Task 1',
        projectPath: '/project/path',
        resumeFrom: 'cp-123',
      });
    });

    it('preserves planId and taskName for retry context', async () => {
      const error = createErrorEvent();
      const context = createRetryContext({
        planId: 'plan-17-07',
        taskName: 'Task 3: Implement ErrorRecovery',
        lastCheckpointId: 'cp-456',
      });

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      expect(lastRequestBody).not.toBeNull();
      expect(lastRequestBody?.planId).toBe('plan-17-07');
      expect(lastRequestBody?.taskName).toBe('Task 3: Implement ErrorRecovery');
    });

    it('clears error state on successful retry', async () => {
      const error = createErrorEvent();
      const context = createRetryContext();

      // Setup execution state
      useExecutionStore.getState().startExecution('old-agent', 'plan-1', 'Task 1');

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      // Store should have been reset and started fresh
      const state = useExecutionStore.getState();
      expect(state.status).toBe('running');
      expect(state.agentId).toBe('new-agent-456');
    });
  });

  describe('retryFromBeginning', () => {
    it('calls POST /api/agents with initial context (no resumeFrom)', async () => {
      const error = createErrorEvent();
      const context = createRetryContext({ lastCheckpointId: 'cp-123' });

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromBeginning();
      });

      expect(lastRequestBody).toEqual({
        planId: 'plan-1',
        taskName: 'Task 1',
        projectPath: '/project/path',
      });

      // Verify resumeFrom is NOT in the body
      expect(lastRequestBody?.resumeFrom).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      // Override fetch to return an error response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal Server Error' }),
      });

      const error = createErrorEvent();
      const context = createRetryContext();

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      // Should have a retry error
      expect(result.current.retryError).toBeTruthy();
      expect(result.current.isRetrying).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      // Override fetch to simulate network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      const error = createErrorEvent();
      const context = createRetryContext();

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      // Should have some retry error message
      expect(result.current.retryError).toBe('Network error');
      expect(result.current.isRetrying).toBe(false);
    });

    it('does nothing when context is null', async () => {
      const error = createErrorEvent();

      const { result } = renderHook(() => useErrorRecovery(error, null));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      // No request should be made
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('sets isRetrying to true during retry attempt', async () => {
      // Make fetch hang to observe loading state
      let resolveFetch: (value: unknown) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });

      mockFetch.mockImplementation(() => fetchPromise);

      const error = createErrorEvent();
      const context = createRetryContext();

      const { result } = renderHook(() => useErrorRecovery(error, context));

      // Start the retry (but don't await)
      act(() => {
        result.current.retryFromCurrentTask();
      });

      // Should be retrying
      expect(result.current.isRetrying).toBe(true);

      // Resolve the fetch
      await act(async () => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({ agentId: 'new-agent' }),
        });
      });

      // Should no longer be retrying
      await waitFor(() => {
        expect(result.current.isRetrying).toBe(false);
      });
    });
  });
});
