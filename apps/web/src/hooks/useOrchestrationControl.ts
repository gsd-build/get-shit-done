'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  fetchParallelismAssessment,
  postAgentLifecycleAction,
  postRunRevalidation,
  type OrchestrationAction,
  type RevalidationSummary,
} from '@/lib/api';
import { useOrchestrationStore } from '@/stores/orchestrationStore';
import { useExecutionStore } from '@/stores/executionStore';
import { usePlanStore } from '@/stores/planStore';

export interface PendingAction {
  action: OrchestrationAction;
  runId: string;
  requiresConfirmation: boolean;
}

export interface UseOrchestrationControlResult {
  pendingAction: PendingAction | null;
  isLoading: boolean;
  error: string | null;
  revalidation: RevalidationSummary | null;
  requestAction: (action: OrchestrationAction, runId: string) => void;
  confirmAction: () => Promise<void>;
  cancelAction: () => void;
  assessParallelism: (phaseId: string) => Promise<void>;
  revalidateBeforeResume: (runId: string) => Promise<boolean>;
}

const CONFIRMATION_ACTIONS: Set<OrchestrationAction> = new Set([
  'abort',
  'stopNow',
  'cancelAndStartNew',
  'rerunFromCheckpoint',
  'retryFailedStep',
]);

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected orchestration error';
}

export function useOrchestrationControl(
  projectId: string
): UseOrchestrationControlResult {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revalidation, setRevalidation] = useState<RevalidationSummary | null>(null);

  const setAssessment = useOrchestrationStore((state) => state.setAssessment);
  const setEditingLock = useOrchestrationStore((state) => state.setEditingLock);
  const setExecutionPlanEditingLocked = useExecutionStore(
    (state) => state.setPlanEditingLocked
  );
  const setPlanEditingLocked = usePlanStore((state) => state.setEditLocked);

  const requestAction = useCallback((action: OrchestrationAction, runId: string) => {
    setError(null);
    setPendingAction({
      action,
      runId,
      requiresConfirmation: CONFIRMATION_ACTIONS.has(action),
    });
  }, []);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await postAgentLifecycleAction(projectId, {
        action: pendingAction.action,
        runId: pendingAction.runId,
      });

      if (!response.success) {
        throw new Error(response.error?.message ?? 'Failed to execute lifecycle action');
      }

      if (pendingAction.action === 'pause') {
        setEditingLock(pendingAction.runId, false);
        setExecutionPlanEditingLocked(false);
        setPlanEditingLocked(false);
      }

      if (pendingAction.action === 'resume') {
        setEditingLock(pendingAction.runId, true);
        setExecutionPlanEditingLocked(true);
        setPlanEditingLocked(true);
      }

      setPendingAction(null);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [pendingAction, projectId, setEditingLock]);

  const assessParallelism = useCallback(
    async (phaseId: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetchParallelismAssessment(projectId, phaseId);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message ?? 'Failed to assess parallelism');
        }
        setAssessment(phaseId, response.data);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, setAssessment]
  );

  const revalidateBeforeResume = useCallback(
    async (runId: string): Promise<boolean> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await postRunRevalidation(projectId, runId);
        if (!response.success || !response.data) {
          throw new Error(response.error?.message ?? 'Revalidation failed');
        }

        setRevalidation(response.data);
        setExecutionPlanEditingLocked(!response.data.passed);
        setPlanEditingLocked(!response.data.passed);
        return response.data.passed;
      } catch (err) {
        setError(toErrorMessage(err));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, setExecutionPlanEditingLocked, setPlanEditingLocked]
  );

  return useMemo(
    () => ({
      pendingAction,
      isLoading,
      error,
      revalidation,
      requestAction,
      confirmAction,
      cancelAction,
      assessParallelism,
      revalidateBeforeResume,
    }),
    [
      pendingAction,
      isLoading,
      error,
      revalidation,
      requestAction,
      confirmAction,
      cancelAction,
      assessParallelism,
      revalidateBeforeResume,
    ]
  );
}
