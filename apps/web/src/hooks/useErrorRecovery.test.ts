import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useErrorRecovery } from './useErrorRecovery';
import { useExecutionStore } from '@/stores/executionStore';
import type { AgentErrorEvent } from '@gsd/events';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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

describe('useErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExecutionStore.getState().reset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ agentId: 'new-agent-456' }),
    });
  });

  afterEach(() => {
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

      expect(mockFetch).toHaveBeenCalledWith('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'plan-1',
          taskName: 'Task 1',
          projectPath: '/project/path',
          resumeFrom: 'cp-123',
        }),
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

      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.planId).toBe('plan-17-07');
      expect(callArgs.taskName).toBe('Task 3: Implement ErrorRecovery');
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

      expect(mockFetch).toHaveBeenCalledWith('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'plan-1',
          taskName: 'Task 1',
          projectPath: '/project/path',
        }),
      });

      // Verify resumeFrom is NOT in the body
      const callArgs = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callArgs.resumeFrom).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('handles API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
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
      mockFetch.mockRejectedValue(new Error('Network error'));

      const error = createErrorEvent();
      const context = createRetryContext();

      const { result } = renderHook(() => useErrorRecovery(error, context));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      expect(result.current.retryError).toBe('Network error');
      expect(result.current.isRetrying).toBe(false);
    });

    it('does nothing when context is null', async () => {
      const error = createErrorEvent();

      const { result } = renderHook(() => useErrorRecovery(error, null));

      await act(async () => {
        await result.current.retryFromCurrentTask();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('sets isRetrying to true during retry attempt', async () => {
      // Make fetch hang to observe loading state
      let resolvePromise: () => void;
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      mockFetch.mockImplementation(() => pendingPromise.then(() => ({
        ok: true,
        json: () => Promise.resolve({ agentId: 'new-agent' }),
      })));

      const error = createErrorEvent();
      const context = createRetryContext();

      const { result } = renderHook(() => useErrorRecovery(error, context));

      // Start the retry
      act(() => {
        result.current.retryFromCurrentTask();
      });

      // Should be retrying
      expect(result.current.isRetrying).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!();
        await pendingPromise;
      });

      // Should no longer be retrying
      await waitFor(() => {
        expect(result.current.isRetrying).toBe(false);
      });
    });
  });
});
