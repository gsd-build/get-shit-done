/**
 * Plan store - Zustand store for planning state.
 *
 * Manages research agent state for swimlane visualization.
 * Includes elapsed time tracking with intervals for running agents.
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
  startAgentTimer: (agentId: string) => void;
  stopAgentTimer: (agentId: string) => void;
  resetPlanState: () => void;
}

// Store interval IDs outside of Zustand state to avoid serialization issues
const timerIntervals = new Map<string, ReturnType<typeof setInterval>>();
const timerStartTimes = new Map<string, number>();

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
    // Stop the timer first
    get().stopAgentTimer(agentId);

    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status: 'complete', summary });
      return { agents: newAgents };
    });
  },

  setAgentError: (agentId, error) => {
    // Stop the timer first
    get().stopAgentTimer(agentId);

    set((state) => {
      const agent = state.agents.get(agentId);
      if (!agent) return state;

      const newAgents = new Map(state.agents);
      newAgents.set(agentId, { ...agent, status: 'error', error });
      return { agents: newAgents };
    });
  },

  startAgentTimer: (agentId) => {
    // Clear any existing timer for this agent
    const existingInterval = timerIntervals.get(agentId);
    if (existingInterval) {
      clearInterval(existingInterval);
    }

    // Record start time
    const startTime = Date.now();
    timerStartTimes.set(agentId, startTime);

    // Start interval to update elapsedMs every 100ms
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - startTime;
      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent) return state;

        const newAgents = new Map(state.agents);
        newAgents.set(agentId, { ...agent, elapsedMs: elapsed });
        return { agents: newAgents };
      });
    }, 100);

    timerIntervals.set(agentId, intervalId);
  },

  stopAgentTimer: (agentId) => {
    const intervalId = timerIntervals.get(agentId);
    if (intervalId) {
      clearInterval(intervalId);
      timerIntervals.delete(agentId);
    }

    // Finalize elapsed time
    const startTime = timerStartTimes.get(agentId);
    if (startTime) {
      const finalElapsed = Date.now() - startTime;
      timerStartTimes.delete(agentId);

      set((state) => {
        const agent = state.agents.get(agentId);
        if (!agent) return state;

        const newAgents = new Map(state.agents);
        newAgents.set(agentId, { ...agent, elapsedMs: finalElapsed });
        return { agents: newAgents };
      });
    }
  },

  resetPlanState: () => {
    // Stop all active timers
    timerIntervals.forEach((intervalId) => clearInterval(intervalId));
    timerIntervals.clear();
    timerStartTimes.clear();

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
