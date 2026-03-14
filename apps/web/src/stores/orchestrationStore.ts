import { create } from 'zustand';
import type {
  OrchestrationRunStatus,
  ParallelismAssessment,
  ParallelismWorkflowNode,
} from '@/types/plan';

export interface OrchestrationRun {
  id: string;
  phaseId: string;
  name: string;
  status: OrchestrationRunStatus;
  updatedAt: string;
  isEditingLocked: boolean;
}

export interface OrchestrationState {
  runs: Map<string, OrchestrationRun>;
  selectedRunId: string | null;
  assessments: Map<string, ParallelismAssessment>;
  workflow: ParallelismWorkflowNode[];
  lastAssessedAt: string | null;

  upsertRun: (run: OrchestrationRun) => void;
  setRuns: (runs: OrchestrationRun[]) => void;
  setSelectedRun: (runId: string | null) => void;
  setWorkflow: (nodes: ParallelismWorkflowNode[]) => void;
  setAssessment: (phaseId: string, assessment: ParallelismAssessment) => void;
  setEditingLock: (runId: string, locked: boolean) => void;
  clear: () => void;
}

const initialState = {
  runs: new Map<string, OrchestrationRun>(),
  selectedRunId: null,
  assessments: new Map<string, ParallelismAssessment>(),
  workflow: [] as ParallelismWorkflowNode[],
  lastAssessedAt: null as string | null,
};

export const useOrchestrationStore = create<OrchestrationState>((set) => ({
  ...initialState,

  upsertRun: (run) =>
    set((state) => {
      const runs = new Map(state.runs);
      runs.set(run.id, run);
      return { runs };
    }),

  setRuns: (runs) =>
    set(() => ({
      runs: new Map(runs.map((run) => [run.id, run])),
    })),

  setSelectedRun: (runId) => set({ selectedRunId: runId }),

  setWorkflow: (nodes) => set({ workflow: nodes }),

  setAssessment: (phaseId, assessment) =>
    set((state) => {
      const assessments = new Map(state.assessments);
      assessments.set(phaseId, assessment);
      return {
        assessments,
        lastAssessedAt: assessment.assessedAt,
      };
    }),

  setEditingLock: (runId, locked) =>
    set((state) => {
      const existing = state.runs.get(runId);
      if (!existing) return state;

      const runs = new Map(state.runs);
      runs.set(runId, { ...existing, isEditingLocked: locked });
      return { runs };
    }),

  clear: () => set(initialState),
}));

export const selectOrchestrationRuns = (state: OrchestrationState) =>
  Array.from(state.runs.values());
export const selectSelectedOrchestrationRun = (state: OrchestrationState) =>
  state.selectedRunId ? state.runs.get(state.selectedRunId) ?? null : null;
export const selectParallelismWorkflow = (state: OrchestrationState) =>
  state.workflow;
export const selectAssessmentForPhase =
  (phaseId: string) =>
  (state: OrchestrationState): ParallelismAssessment | null =>
    state.assessments.get(phaseId) ?? null;
