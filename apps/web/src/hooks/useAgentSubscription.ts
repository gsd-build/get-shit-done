'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  EVENTS,
  type TypedSocket,
  type AgentStartEvent,
  type AgentEndEvent,
  type ToolStartEvent,
  type ToolEndEvent,
  type CheckpointRequestEvent,
} from '@gsd/events';
import { useExecutionStore } from '@/stores/executionStore';
import { useTokenBuffer } from './useTokenBuffer';

/**
 * React hook for subscribing to agent events via Socket.IO.
 *
 * Manages subscription lifecycle:
 * - On mount: emits 'agent:subscribe' to join agent room
 * - Subscribes to all agent events (start, end, tool_start, tool_end, checkpoint)
 * - Uses useTokenBuffer for RAF-based token batching
 * - Calls executionStore actions to update state
 * - On unmount: emits 'agent:unsubscribe' and removes listeners
 *
 * @param socket - TypedSocket instance (null if not connected)
 * @param agentId - Agent ID to subscribe to (null to unsubscribe)
 */
export function useAgentSubscription(
  socket: TypedSocket | null,
  agentId: string | null
) {
  const store = useExecutionStore.getState();
  const currentPlanRef = useRef<string | null>(null);

  // Token buffer with callback to append logs
  const handleTokenUpdate = useCallback((tokens: string[]) => {
    if (currentPlanRef.current) {
      // Append the joined tokens as a single log entry
      const combined = tokens.join('');
      if (combined) {
        store.appendLog(currentPlanRef.current, combined);
      }
    }
  }, [store]);

  const tokenBuffer = useTokenBuffer(socket, handleTokenUpdate);

  useEffect(() => {
    if (!socket || !agentId) {
      return;
    }

    // Subscribe to agent room
    socket.emit('agent:subscribe', agentId);

    // Event handlers
    const handleAgentStart = (event: AgentStartEvent) => {
      if (event.agentId !== agentId) return;
      currentPlanRef.current = event.planId;
      store.startExecution(event.agentId, event.planId, event.taskName);
      tokenBuffer.subscribe(agentId);
    };

    const handleAgentEnd = (event: AgentEndEvent) => {
      if (event.agentId !== agentId) return;
      if (currentPlanRef.current) {
        const status = event.status === 'success' ? 'complete' : 'error';
        store.completePlan(currentPlanRef.current, status);
      }
      tokenBuffer.unsubscribe(agentId);
    };

    const handleToolStart = (event: ToolStartEvent) => {
      if (event.agentId !== agentId) return;
      if (currentPlanRef.current) {
        store.startTool(currentPlanRef.current, event);
      }
    };

    const handleToolEnd = (event: ToolEndEvent) => {
      if (event.agentId !== agentId) return;
      if (currentPlanRef.current) {
        store.endTool(currentPlanRef.current, event);
      }
    };

    const handleCheckpoint = (event: CheckpointRequestEvent) => {
      store.setCheckpoint(event);
    };

    // Subscribe to events
    socket.on(EVENTS.AGENT_START, handleAgentStart);
    socket.on(EVENTS.AGENT_END, handleAgentEnd);
    socket.on(EVENTS.TOOL_START, handleToolStart);
    socket.on(EVENTS.TOOL_END, handleToolEnd);
    socket.on(EVENTS.CHECKPOINT_REQUEST, handleCheckpoint);

    return () => {
      // Unsubscribe from events
      socket.off(EVENTS.AGENT_START, handleAgentStart);
      socket.off(EVENTS.AGENT_END, handleAgentEnd);
      socket.off(EVENTS.TOOL_START, handleToolStart);
      socket.off(EVENTS.TOOL_END, handleToolEnd);
      socket.off(EVENTS.CHECKPOINT_REQUEST, handleCheckpoint);

      // Leave agent room
      socket.emit('agent:unsubscribe', agentId);
      tokenBuffer.unsubscribe(agentId);
      tokenBuffer.clear();
    };
  }, [socket, agentId, store, tokenBuffer]);

  return {
    currentPlanId: currentPlanRef.current,
  };
}
