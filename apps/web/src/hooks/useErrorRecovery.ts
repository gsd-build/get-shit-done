'use client';

import { useState, useCallback } from 'react';
import type { AgentErrorEvent } from '@gsd/events';
import { useExecutionStore } from '@/stores/executionStore';
import { API_PROXY_BASE } from '@/lib/endpoints';

const API_BASE = API_PROXY_BASE;

/**
 * Context for retry operations
 */
export interface RetryContext {
  planId: string;
  taskName: string;
  projectPath: string;
  lastCheckpointId?: string;
}

/**
 * Return type for useErrorRecovery hook
 */
export interface UseErrorRecoveryReturn {
  retryFromCurrentTask: () => Promise<void>;
  retryFromBeginning: () => Promise<void>;
  isRetrying: boolean;
  retryError: string | null;
}

/**
 * Hook for handling error recovery with retry options.
 *
 * Provides two retry strategies:
 * - retryFromCurrentTask: Resumes from the last checkpoint
 * - retryFromBeginning: Starts fresh from the beginning
 *
 * @param error - Current error event (can be null)
 * @param context - Retry context with plan and task info
 * @returns Retry functions and state
 */
export function useErrorRecovery(
  error: AgentErrorEvent | null,
  context: RetryContext | null
): UseErrorRecoveryReturn {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const store = useExecutionStore();

  const retryFromCurrentTask = useCallback(async () => {
    if (!context) return;

    setIsRetrying(true);
    setRetryError(null);

    try {
      const body: Record<string, string> = {
        planId: context.planId,
        taskName: context.taskName,
        projectPath: context.projectPath,
      };

      // Include resumeFrom only if lastCheckpointId exists
      if (context.lastCheckpointId) {
        body['resumeFrom'] = context.lastCheckpointId;
      }

      const response = await fetch(`${API_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      const data = await response.json();
      store.reset();
      store.startExecution(data.agentId, context.planId, context.taskName);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRetrying(false);
    }
  }, [context, store]);

  const retryFromBeginning = useCallback(async () => {
    if (!context) return;

    setIsRetrying(true);
    setRetryError(null);

    try {
      const body = {
        planId: context.planId,
        taskName: context.taskName,
        projectPath: context.projectPath,
        // Intentionally no resumeFrom - start from beginning
      };

      const response = await fetch(`${API_BASE}/api/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      const data = await response.json();
      store.reset();
      store.startExecution(data.agentId, context.planId, context.taskName);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRetrying(false);
    }
  }, [context, store]);

  return { retryFromCurrentTask, retryFromBeginning, isRetrying, retryError };
}

export default useErrorRecovery;
