import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanStore, selectAgents, selectPlan, selectIsLoading } from './planStore';
import type { ResearchAgent } from '@/types/plan';

describe('planStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    usePlanStore.getState().resetPlanState();
  });

  describe('addAgent', () => {
    it('adds a new research agent with pending status', () => {
      const { addAgent } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.get('agent-1')).toEqual({
        id: 'agent-1',
        name: 'Test Agent',
        status: 'pending',
        elapsedMs: 0,
      });
    });

    it('initializes elapsedMs to 0', () => {
      const { addAgent } = usePlanStore.getState();

      addAgent({ id: 'agent-2', name: 'Another Agent' });

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.get('agent-2')?.elapsedMs).toBe(0);
    });
  });

  describe('updateAgentStatus', () => {
    it('changes agent status from pending to running', () => {
      const { addAgent, updateAgentStatus } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });
      updateAgentStatus('agent-1', 'running');

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.get('agent-1')?.status).toBe('running');
    });

    it('does nothing for non-existent agent', () => {
      const { updateAgentStatus } = usePlanStore.getState();

      // Should not throw
      updateAgentStatus('non-existent', 'running');

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.size).toBe(0);
    });
  });

  describe('updateAgentAction', () => {
    it('sets currentAction text', () => {
      const { addAgent, updateAgentAction } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });
      updateAgentAction('agent-1', 'Reading src/api/routes.ts');

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.get('agent-1')?.currentAction).toBe('Reading src/api/routes.ts');
    });

    it('updates action text when called multiple times', () => {
      const { addAgent, updateAgentAction } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });
      updateAgentAction('agent-1', 'First action');
      updateAgentAction('agent-1', 'Second action');

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.get('agent-1')?.currentAction).toBe('Second action');
    });
  });

  describe('setAgentComplete', () => {
    it('sets summary and status to complete', () => {
      const { addAgent, updateAgentStatus, setAgentComplete } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });
      updateAgentStatus('agent-1', 'running');
      setAgentComplete('agent-1', 'Successfully analyzed 5 files');

      const agents = selectAgents(usePlanStore.getState());
      const agent = agents.get('agent-1');
      expect(agent?.status).toBe('complete');
      expect(agent?.summary).toBe('Successfully analyzed 5 files');
    });
  });

  describe('setAgentError', () => {
    it('sets error and status to error', () => {
      const { addAgent, updateAgentStatus, setAgentError } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });
      updateAgentStatus('agent-1', 'running');
      setAgentError('agent-1', 'Connection timeout');

      const agents = selectAgents(usePlanStore.getState());
      const agent = agents.get('agent-1');
      expect(agent?.status).toBe('error');
      expect(agent?.error).toBe('Connection timeout');
    });
  });

  describe('resetPlanState', () => {
    it('clears all agents', () => {
      const { addAgent, resetPlanState } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Agent 1' });
      addAgent({ id: 'agent-2', name: 'Agent 2' });

      resetPlanState();

      const agents = selectAgents(usePlanStore.getState());
      expect(agents.size).toBe(0);
    });

    it('resets plan to null', () => {
      // Assuming plan can be set somehow
      const { resetPlanState } = usePlanStore.getState();

      resetPlanState();

      const plan = selectPlan(usePlanStore.getState());
      expect(plan).toBeNull();
    });
  });

  describe('selectors', () => {
    it('selectAgents returns agent map', () => {
      const { addAgent } = usePlanStore.getState();

      addAgent({ id: 'agent-1', name: 'Test Agent' });

      const agents = selectAgents(usePlanStore.getState());
      expect(agents).toBeInstanceOf(Map);
      expect(agents.size).toBe(1);
    });

    it('selectPlan returns null when no plan', () => {
      const plan = selectPlan(usePlanStore.getState());
      expect(plan).toBeNull();
    });

    it('selectIsLoading returns loading state', () => {
      const isLoading = selectIsLoading(usePlanStore.getState());
      expect(typeof isLoading).toBe('boolean');
    });
  });
});
