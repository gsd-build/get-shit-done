/**
 * useContextPreview - Hook for real-time CONTEXT.md preview updates
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useContextStore } from '@/stores/contextStore';
import { parseContextMd, markNewDecisions } from '@/lib/contextParser';
import type { TypedSocket } from '@gsd/events';

interface UseContextPreviewOptions {
  socket: TypedSocket | null;
  agentId: string | null;
  phaseId: string;
}

interface UseContextPreviewResult {
  isUpdating: boolean;
}

/**
 * Listen for context:update events and update the context store
 */
export function useContextPreview({
  socket,
  agentId,
  phaseId,
}: UseContextPreviewOptions): UseContextPreviewResult {
  const setContext = useContextStore(state => state.setContext);
  const contextState = useContextStore(state => state.contextState);
  const isUpdatingRef = useRef(false);

  const handleContextUpdate = useCallback(
    (data: { agentId: string; markdown: string }) => {
      if (!agentId || data.agentId !== agentId) return;

      isUpdatingRef.current = true;

      // Parse and mark new decisions
      const newState = parseContextMd(data.markdown);
      const markedState = markNewDecisions(newState, contextState);

      // Update store
      setContext(phaseId, data.markdown);

      // Clear updating flag after a short delay
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 100);
    },
    [agentId, phaseId, contextState, setContext]
  );

  useEffect(() => {
    if (!socket) return;

    // Listen for context updates from the server
    // The server emits 'context:update' when CONTEXT.md is modified
    socket.on('context:update' as any, handleContextUpdate);

    return () => {
      socket.off('context:update' as any, handleContextUpdate);
    };
  }, [socket, handleContextUpdate]);

  // Subscribe/unsubscribe to agent context updates
  useEffect(() => {
    if (!socket || !agentId) return;

    // Subscribe to context updates for this agent
    socket.emit('context:subscribe' as any, { agentId });

    return () => {
      socket.emit('context:unsubscribe' as any, { agentId });
    };
  }, [socket, agentId]);

  return {
    isUpdating: isUpdatingRef.current,
  };
}
