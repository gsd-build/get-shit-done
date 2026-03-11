import { describe, it, expect, beforeEach } from 'vitest';
import { useExecutionStore } from './executionStore';
import type { ToolStartEvent, ToolEndEvent, CheckpointRequestEvent } from '@gsd/events';

describe('executionStore', () => {
  beforeEach(() => {
    useExecutionStore.getState().reset();
  });

  describe('initial state', () => {
    it('agentId is null', () => {
      const { agentId } = useExecutionStore.getState();
      expect(agentId).toBeNull();
    });

    it('status is idle', () => {
      const { status } = useExecutionStore.getState();
      expect(status).toBe('idle');
    });

    it('tddPhase is null', () => {
      const { tddPhase } = useExecutionStore.getState();
      expect(tddPhase).toBeNull();
    });

    it('plans is empty Map', () => {
      const { plans } = useExecutionStore.getState();
      expect(plans).toBeInstanceOf(Map);
      expect(plans.size).toBe(0);
    });

    it('pendingCheckpoint is null', () => {
      const { pendingCheckpoint } = useExecutionStore.getState();
      expect(pendingCheckpoint).toBeNull();
    });

    it('selectedFile is null', () => {
      const { selectedFile } = useExecutionStore.getState();
      expect(selectedFile).toBeNull();
    });

    it('commits is empty array', () => {
      const { commits } = useExecutionStore.getState();
      expect(commits).toEqual([]);
    });
  });

  describe('startExecution action', () => {
    it('sets agentId', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { agentId } = useExecutionStore.getState();
      expect(agentId).toBe('agent-123');
    });

    it('sets status to running', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { status } = useExecutionStore.getState();
      expect(status).toBe('running');
    });

    it('creates plan entry with status running', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan).toBeDefined();
      expect(plan?.status).toBe('running');
    });

    it('creates plan entry with empty logs', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.logs).toBe('');
    });

    it('creates plan entry with empty toolCalls', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.toolCalls).toEqual([]);
    });

    it('creates plan entry with taskName', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.taskName).toBe('Task 1');
    });
  });

  describe('appendLog action', () => {
    it('appends token to plan.logs', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().appendLog('plan-1', 'Hello ');
      useExecutionStore.getState().appendLog('plan-1', 'World');

      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.logs).toBe('Hello World');
    });

    it('handles non-existent plan gracefully', () => {
      // Should not throw
      expect(() => {
        useExecutionStore.getState().appendLog('non-existent', 'token');
      }).not.toThrow();
    });
  });

  describe('startTool/endTool actions', () => {
    const toolStartEvent: ToolStartEvent = {
      agentId: 'agent-123',
      toolId: 'tool-1',
      toolName: 'Read',
      input: { path: '/test.ts' },
      sequence: 1,
    };

    const toolEndEvent: ToolEndEvent = {
      agentId: 'agent-123',
      toolId: 'tool-1',
      success: true,
      output: 'file contents',
      duration: 150,
      sequence: 2,
    };

    it('startTool adds tool call to plan.toolCalls', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().startTool('plan-1', toolStartEvent);

      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.toolCalls).toHaveLength(1);
      expect(plan?.toolCalls[0]?.toolId).toBe('tool-1');
      expect(plan?.toolCalls[0]?.toolName).toBe('Read');
      expect(plan?.toolCalls[0]?.input).toEqual({ path: '/test.ts' });
    });

    it('endTool updates tool call with output, success, duration', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().startTool('plan-1', toolStartEvent);
      useExecutionStore.getState().endTool('plan-1', toolEndEvent);

      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      const toolCall = plan?.toolCalls[0];
      expect(toolCall?.output).toBe('file contents');
      expect(toolCall?.success).toBe(true);
      expect(toolCall?.duration).toBe(150);
    });

    it('endTool handles non-existent tool gracefully', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      // End a tool that was never started
      expect(() => {
        useExecutionStore.getState().endTool('plan-1', toolEndEvent);
      }).not.toThrow();
    });
  });

  describe('checkpoint actions', () => {
    const checkpointRequest: CheckpointRequestEvent = {
      checkpointId: 'cp-1',
      type: 'human-verify',
      prompt: 'Please verify the implementation',
      options: [{ id: 'approve', label: 'Approve' }],
      timeoutMs: 30000,
    };

    it('setCheckpoint stores checkpoint request', () => {
      useExecutionStore.getState().setCheckpoint(checkpointRequest);
      const { pendingCheckpoint } = useExecutionStore.getState();
      expect(pendingCheckpoint).toEqual(checkpointRequest);
    });

    it('setCheckpoint(null) clears checkpoint', () => {
      useExecutionStore.getState().setCheckpoint(checkpointRequest);
      useExecutionStore.getState().setCheckpoint(null);
      const { pendingCheckpoint } = useExecutionStore.getState();
      expect(pendingCheckpoint).toBeNull();
    });
  });

  describe('control actions', () => {
    it('setPaused(true) sets status to paused', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().setPaused(true);
      const { status } = useExecutionStore.getState();
      expect(status).toBe('paused');
    });

    it('setPaused(false) sets status to running', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().setPaused(true);
      useExecutionStore.getState().setPaused(false);
      const { status } = useExecutionStore.getState();
      expect(status).toBe('running');
    });

    it('reset() clears all state to initial', () => {
      // Set up some state
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().appendLog('plan-1', 'some logs');
      useExecutionStore.getState().setCheckpoint({
        checkpointId: 'cp-1',
        type: 'human-verify',
        prompt: 'test',
      });

      // Reset
      useExecutionStore.getState().reset();

      // Verify initial state
      const state = useExecutionStore.getState();
      expect(state.agentId).toBeNull();
      expect(state.status).toBe('idle');
      expect(state.tddPhase).toBeNull();
      expect(state.plans.size).toBe(0);
      expect(state.pendingCheckpoint).toBeNull();
      expect(state.selectedFile).toBeNull();
      expect(state.commits).toEqual([]);
    });
  });

  describe('additional actions', () => {
    it('setTddPhase updates tddPhase', () => {
      useExecutionStore.getState().setTddPhase('red');
      expect(useExecutionStore.getState().tddPhase).toBe('red');

      useExecutionStore.getState().setTddPhase('green');
      expect(useExecutionStore.getState().tddPhase).toBe('green');

      useExecutionStore.getState().setTddPhase('refactor');
      expect(useExecutionStore.getState().tddPhase).toBe('refactor');
    });

    it('selectFile updates selectedFile', () => {
      const file = {
        path: '/src/test.ts',
        original: 'const x = 1;',
        modified: 'const x = 2;',
      };
      useExecutionStore.getState().selectFile(file);
      expect(useExecutionStore.getState().selectedFile).toEqual(file);
    });

    it('addCommit appends to commits array', () => {
      const commit1 = { sha: 'abc123', message: 'feat: add feature', timestamp: '2026-03-11T12:00:00Z' };
      const commit2 = { sha: 'def456', message: 'fix: fix bug', timestamp: '2026-03-11T12:30:00Z' };

      useExecutionStore.getState().addCommit(commit1);
      useExecutionStore.getState().addCommit(commit2);

      const { commits } = useExecutionStore.getState();
      expect(commits).toHaveLength(2);
      expect(commits[0]).toEqual(commit1);
      expect(commits[1]).toEqual(commit2);
    });

    it('completePlan updates plan status', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().completePlan('plan-1', 'complete');

      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.status).toBe('complete');
    });

    it('completePlan sets endTime', () => {
      useExecutionStore.getState().startExecution('agent-123', 'plan-1', 'Task 1');
      useExecutionStore.getState().completePlan('plan-1', 'error');

      const { plans } = useExecutionStore.getState();
      const plan = plans.get('plan-1');
      expect(plan?.endTime).toBeDefined();
      expect(typeof plan?.endTime).toBe('number');
    });
  });
});
