import { create } from 'zustand';
import type {
  ToolStartEvent,
  ToolEndEvent,
  CheckpointRequestEvent,
} from '@gsd/events';

/**
 * Tool call state for tracking tool execution
 */
export interface ToolCall {
  toolId: string;
  toolName: string;
  input: unknown;
  output?: string;
  success?: boolean;
  duration?: number;
  startTime: number;
}

/**
 * Plan execution state for tracking individual plan progress
 */
export interface PlanExecution {
  planId: string;
  taskName: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  logs: string;
  toolCalls: ToolCall[];
  startTime?: number;
  endTime?: number;
}

/**
 * Selected file state for diff viewing
 */
export interface SelectedFile {
  path: string;
  original: string;
  modified: string;
}

/**
 * Commit record for tracking execution commits
 */
export interface Commit {
  sha: string;
  message: string;
  timestamp: string;
}

/**
 * Execution state interface
 */
export interface ExecutionState {
  agentId: string | null;
  status: 'idle' | 'running' | 'paused' | 'complete' | 'error';
  tddPhase: 'red' | 'green' | 'refactor' | null;
  plans: Map<string, PlanExecution>;
  pendingCheckpoint: CheckpointRequestEvent | null;
  selectedFile: SelectedFile | null;
  commits: Commit[];

  // Actions
  startExecution: (agentId: string, planId: string, taskName: string) => void;
  appendLog: (planId: string, token: string) => void;
  startTool: (planId: string, event: ToolStartEvent) => void;
  endTool: (planId: string, event: ToolEndEvent) => void;
  setCheckpoint: (checkpoint: CheckpointRequestEvent | null) => void;
  setTddPhase: (phase: ExecutionState['tddPhase']) => void;
  selectFile: (file: SelectedFile | null) => void;
  addCommit: (commit: Commit) => void;
  setPaused: (paused: boolean) => void;
  completePlan: (planId: string, status: 'complete' | 'error') => void;
  reset: () => void;
}

const initialState = {
  agentId: null as string | null,
  status: 'idle' as ExecutionState['status'],
  tddPhase: null as ExecutionState['tddPhase'],
  plans: new Map<string, PlanExecution>(),
  pendingCheckpoint: null as CheckpointRequestEvent | null,
  selectedFile: null as SelectedFile | null,
  commits: [] as Commit[],
};

/**
 * Zustand store for execution state management.
 *
 * Tracks agent execution including:
 * - Agent status and ID
 * - Plan execution progress with logs and tool calls
 * - Pending checkpoints requiring user input
 * - TDD phase (red/green/refactor)
 * - Selected file for diff viewing
 * - Commits made during execution
 */
export const useExecutionStore = create<ExecutionState>((set, get) => ({
  ...initialState,

  startExecution: (agentId, planId, taskName) =>
    set((state) => {
      const newPlans = new Map(state.plans);
      newPlans.set(planId, {
        planId,
        taskName,
        status: 'running',
        logs: '',
        toolCalls: [],
        startTime: Date.now(),
      });
      return {
        agentId,
        status: 'running',
        plans: newPlans,
      };
    }),

  appendLog: (planId, token) =>
    set((state) => {
      const plan = state.plans.get(planId);
      if (!plan) return state;

      const newPlans = new Map(state.plans);
      newPlans.set(planId, {
        ...plan,
        logs: plan.logs + token,
      });
      return { plans: newPlans };
    }),

  startTool: (planId, event) =>
    set((state) => {
      const plan = state.plans.get(planId);
      if (!plan) return state;

      const toolCall: ToolCall = {
        toolId: event.toolId,
        toolName: event.toolName,
        input: event.input,
        startTime: Date.now(),
      };

      const newPlans = new Map(state.plans);
      newPlans.set(planId, {
        ...plan,
        toolCalls: [...plan.toolCalls, toolCall],
      });
      return { plans: newPlans };
    }),

  endTool: (planId, event) =>
    set((state) => {
      const plan = state.plans.get(planId);
      if (!plan) return state;

      const updatedToolCalls = plan.toolCalls.map((tc) =>
        tc.toolId === event.toolId
          ? {
              ...tc,
              output: event.output,
              success: event.success,
              duration: event.duration,
            }
          : tc
      );

      const newPlans = new Map(state.plans);
      newPlans.set(planId, {
        ...plan,
        toolCalls: updatedToolCalls,
      });
      return { plans: newPlans };
    }),

  setCheckpoint: (checkpoint) => set({ pendingCheckpoint: checkpoint }),

  setTddPhase: (phase) => set({ tddPhase: phase }),

  selectFile: (file) => set({ selectedFile: file }),

  addCommit: (commit) =>
    set((state) => ({
      commits: [...state.commits, commit],
    })),

  setPaused: (paused) =>
    set({ status: paused ? 'paused' : 'running' }),

  completePlan: (planId, status) =>
    set((state) => {
      const plan = state.plans.get(planId);
      if (!plan) return state;

      const newPlans = new Map(state.plans);
      newPlans.set(planId, {
        ...plan,
        status,
        endTime: Date.now(),
      });
      return { plans: newPlans };
    }),

  reset: () =>
    set({
      agentId: null,
      status: 'idle',
      tddPhase: null,
      plans: new Map(),
      pendingCheckpoint: null,
      selectedFile: null,
      commits: [],
    }),
}));

// Selectors for optimized re-renders
export const selectAgentId = (state: ExecutionState) => state.agentId;
export const selectStatus = (state: ExecutionState) => state.status;
export const selectTddPhase = (state: ExecutionState) => state.tddPhase;
export const selectPlans = (state: ExecutionState) => state.plans;
export const selectPendingCheckpoint = (state: ExecutionState) => state.pendingCheckpoint;
export const selectSelectedFile = (state: ExecutionState) => state.selectedFile;
export const selectCommits = (state: ExecutionState) => state.commits;
