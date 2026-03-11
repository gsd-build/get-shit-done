/**
 * Plan store - Zustand store for planning state.
 *
 * Manages research agent state for swimlane visualization.
 */

import { create } from 'zustand';
import type { ResearchAgent, Plan, AgentStatus } from '@/types/plan';

interface PlanStore {
  agents: Map<string, ResearchAgent>;
  plan: Plan | null;
  isLoading: boolean;
  addAgent: (agent: Partial<ResearchAgent>) => void;
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;
  updateAgentAction: (agentId: string, action: string) => void;
  setAgentComplete: (agentId: string, summary: string) => void;
  setAgentError: (agentId: string, error: string) => void;
  resetPlanState: () => void;
}

const initialState = {
  agents: new Map<string, ResearchAgent>(),
  plan: null as Plan | null,
  isLoading: false,
};

export const usePlanStore = create<PlanStore>((set, get) => ({
  ...initialState,

  addAgent: (partial) => {
    const agent: ResearchAgent = {
      id: partial.id ?? '',
      name: partial.name ?? '',
      status: partial.status ?? 'pending',
      elapsedMs: partial.elapsedMs ?? 0,
      ...(partial.currentAction && { currentAction: partial.currentAction }),
      ...(partial.summary && { summary: partial.summary }),
      ...(partial.error && { error: partial.error }),
    };

    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(agent.id, agent);
      return { agents: newAgents };
    });
  },

  updateAgentStatus: (agentId, status) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status });
      return { agents: newAgents };
    });
  },

  updateAgentAction: (agentId, action) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, currentAction: action });
      return { agents: newAgents };
    });
  },

  setAgentComplete: (agentId, summary) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status: 'complete', summary });
      return { agents: newAgents };
    });
  },

  setAgentError: (agentId, error) => {
    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status: 'error', error });
      return { agents: newAgents };
    });
  },

  resetPlanState: () => {
    set({
      agents: new Map(),
      plan: null,
      isLoading: false,
    });
  },
}));

// Selectors for optimized re-renders
export const selectAgents = (state: PlanStore) => state.agents;
export const selectPlan = (state: PlanStore) => state.plan;
export const selectIsLoading = (state: PlanStore) => state.isLoading;
