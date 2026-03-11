/**
 * Plan store - Zustand store for planning state.
 *
 * Manages research agent state for swimlane visualization.
 * Stub implementation for RED phase TDD.
 */

import { create } from 'zustand';
import type { ResearchAgent, Plan } from '@/types/plan';

interface PlanStore {
  agents: Map<string, ResearchAgent>;
  plan: Plan | null;
  isLoading: boolean;
  addAgent: (agent: Partial<ResearchAgent>) => void;
  updateAgentStatus: (agentId: string, status: ResearchAgent['status']) => void;
  updateAgentAction: (agentId: string, action: string) => void;
  setAgentComplete: (agentId: string, summary: string) => void;
  setAgentError: (agentId: string, error: string) => void;
  resetPlanState: () => void;
}

export const usePlanStore = create<PlanStore>(() => ({
  agents: new Map(),
  plan: null,
  isLoading: false,
  // Stub implementations that will fail tests
  addAgent: () => {},
  updateAgentStatus: () => {},
  updateAgentAction: () => {},
  setAgentComplete: () => {},
  setAgentError: () => {},
  resetPlanState: () => {},
}));

// Selectors for optimized re-renders
export const selectAgents = (state: PlanStore) => state.agents;
export const selectPlan = (state: PlanStore) => state.plan;
export const selectIsLoading = (state: PlanStore) => state.isLoading;
