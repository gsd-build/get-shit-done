/**
 * useAgentControl hook
 *
 * Provides pause, resume, and abort functionality for agent execution.
 * Communicates with the backend via REST API.
 */

'use client';

import { useState, useCallback } from 'react';
import { useExecutionStore } from '@/stores/executionStore';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

export interface UseAgentControlResult {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  abort: (rollback?: boolean) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for controlling agent execution (pause/resume/abort).
 *
 * @param agentId - The ID of the agent to control, or null if no agent is active
 * @returns Object with pause, resume, abort functions and loading/error state
 */
export function useAgentControl(agentId: string | null): UseAgentControlResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPaused = useExecutionStore((state) => state.setPaused);
  const reset = useExecutionStore((state) => state.reset);

  /**
   * Pause the agent execution.
   * Makes PATCH request with status: 'paused'.
   */
  const pause = useCallback(async () => {
    if (!agentId) {
      setError('No agent ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'paused' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to pause agent: ${response.status}`);
      }

      setPaused(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pause agent';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, setPaused]);

  /**
   * Resume the agent execution.
   * Makes PATCH request with status: 'running'.
   */
  const resume = useCallback(async () => {
    if (!agentId) {
      setError('No agent ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/agents/${agentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'running' }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to resume agent: ${response.status}`);
      }

      setPaused(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume agent';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, setPaused]);

  /**
   * Abort the agent execution.
   * Makes DELETE request, optionally with rollback query param.
   *
   * @param rollback - If true, includes rollback=true query param
   */
  const abort = useCallback(async (rollback?: boolean) => {
    if (!agentId) {
      setError('No agent ID provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const url = rollback
        ? `${API_BASE}/api/agents/${agentId}?rollback=true`
        : `${API_BASE}/api/agents/${agentId}`;

      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || `Failed to abort agent: ${response.status}`);
      }

      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to abort agent';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [agentId, reset]);

  return {
    pause,
    resume,
    abort,
    isLoading,
    error,
  };
}
