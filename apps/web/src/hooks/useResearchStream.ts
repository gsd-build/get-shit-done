/**
 * useResearchStream hook - subscribes to Socket.IO research agent events.
 *
 * Updates the plan store when agent lifecycle events are received.
 */

'use client';

import { useEffect, useCallback } from 'react';
import type { TypedSocket, AgentStartEvent, AgentEndEvent, AgentErrorEvent } from '@gsd/events';
import { EVENTS } from '@gsd/events';
import { usePlanStore, selectAgents, selectIsLoading } from '@/stores/planStore';

/**
 * Hook that subscribes to research agent Socket.IO events.
 * Updates the plan store with agent state changes.
 *
 * @param socket - TypedSocket instance or null
 * @param phaseId - Phase ID to subscribe to
 * @returns Object with agents Map and isLoading state
 */
export function useResearchStream(socket: TypedSocket | null, phaseId: string) {
  const agents = usePlanStore(selectAgents);
  const isLoading = usePlanStore(selectIsLoading);

  // Event handlers that update the store
  const handleAgentStart = useCallback((event: AgentStartEvent) => {
    const store = usePlanStore.getState();
    store.addAgent({
      id: event.agentId,
      name: event.taskName,
      status: 'running',
    });
    // Start the elapsed time timer
    store.startAgentTimer(event.agentId);
  }, []);

  const handleAgentEnd = useCallback((event: AgentEndEvent) => {
    const store = usePlanStore.getState();
    if (event.status === 'success') {
      store.setAgentComplete(event.agentId, event.summary ?? '');
    } else if (event.status === 'error') {
      store.setAgentError(event.agentId, 'Unknown error');
    }
    // 'checkpoint' status could be handled differently if needed
  }, []);

  const handleAgentError = useCallback((event: AgentErrorEvent) => {
    const store = usePlanStore.getState();
    store.setAgentError(event.agentId, event.message);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Subscribe to the phase's research events
    socket.emit('research:subscribe', phaseId);

    // Set up event listeners
    socket.on(EVENTS.AGENT_START, handleAgentStart);
    socket.on(EVENTS.AGENT_END, handleAgentEnd);
    socket.on(EVENTS.AGENT_ERROR, handleAgentError);

    // Cleanup on unmount
    return () => {
      socket.emit('research:unsubscribe');
      socket.off(EVENTS.AGENT_START, handleAgentStart);
      socket.off(EVENTS.AGENT_END, handleAgentEnd);
      socket.off(EVENTS.AGENT_ERROR, handleAgentError);
    };
  }, [socket, phaseId, handleAgentStart, handleAgentEnd, handleAgentError]);

  return { agents, isLoading };
}
