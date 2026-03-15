'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Plan, PlanTask } from '@/types/plan';
import { fetchPlan } from '@/lib/api';

function classifyPlanError(code?: string, message?: string): string {
  if (code === 'PROJECT_NOT_FOUND') {
    return 'Project not found.';
  }

  if (code === 'PHASE_UNAVAILABLE') {
    return 'Plan phase is unavailable for this project.';
  }

  if (message?.startsWith('HTTP 404')) {
    return 'Plan phase is unavailable for this project.';
  }

  return message || 'Failed to load plan tasks';
}

export interface UsePlanDataState {
  planData: Plan | null;
  isLoading: boolean;
  planError: string | null;
  loadPlan: () => Promise<void>;
  patchTask: (taskId: string, updater: (task: PlanTask) => PlanTask) => void;
}

export function usePlanData(projectId: string): UsePlanDataState {
  const [planData, setPlanData] = useState<Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    setPlanError(null);

    const response = await fetchPlan(projectId);
    if (response.success && response.data) {
      // Server payload is authoritative for task presence.
      setPlanData(response.data);
      setPlanError(null);
    } else {
      setPlanError(classifyPlanError(response.error?.code, response.error?.message));
    }

    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const patchTask = useCallback((taskId: string, updater: (task: PlanTask) => PlanTask) => {
    setPlanData((previous) => {
      if (!previous) {
        return previous;
      }

      let changed = false;
      const updatedTasks = previous.tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        changed = true;
        return updater(task);
      });

      return changed ? { ...previous, tasks: updatedTasks } : previous;
    });
  }, []);

  return {
    planData,
    isLoading,
    planError,
    loadPlan,
    patchTask,
  };
}
