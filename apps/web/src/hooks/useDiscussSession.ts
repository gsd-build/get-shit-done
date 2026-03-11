'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { TypedSocket } from '@gsd/events';
import { useDiscussStore, selectAgentId } from '@/stores/discussStore';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

interface UseDiscussSessionOptions {
  /** Phase ID for the discussion session */
  phaseId: string;
  /** Socket instance from useSocket */
  socket: TypedSocket | null;
  /** Callback when reconnection completes */
  onReconnected?: () => void;
}

interface UseDiscussSessionResult {
  /** Whether socket is currently connected */
  isConnected: boolean;
  /** Whether socket is attempting to reconnect */
  isReconnecting: boolean;
  /** Current agent ID from store */
  agentId: string | null;
  /** Start a new agent with the given prompt */
  startAgent: (prompt: string) => Promise<string | null>;
  /** Cancel the current agent */
  cancelAgent: () => Promise<void>;
}

/**
 * Hook for managing discuss session lifecycle and reconnection.
 *
 * Handles:
 * - Re-subscribing to agent room on reconnect
 * - Starting/canceling agents via REST API
 * - Tracking connection and reconnection state
 */
export function useDiscussSession({
  phaseId,
  socket,
  onReconnected,
}: UseDiscussSessionOptions): UseDiscussSessionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wasConnectedRef = useRef(false);

  // Store state
  const agentId = useDiscussStore(selectAgentId);
  const setAgentId = useDiscussStore((s) => s.setAgentId);

  // Track connection state and handle reconnection
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      const wasDisconnected = wasConnectedRef.current && !isConnected;
      setIsConnected(true);
      setIsReconnecting(false);

      // Re-subscribe to agent room if we have an agent ID and were previously disconnected
      if (wasDisconnected && agentId) {
        socket.emit('agent:subscribe', agentId);
        onReconnected?.();
      }

      wasConnectedRef.current = true;
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };

    const handleReconnectAttempt = () => {
      setIsReconnecting(true);
    };

    const handleReconnectFailed = () => {
      setIsReconnecting(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.io.on('reconnect_failed', handleReconnectFailed);

    // Check initial connection state
    if (socket.connected) {
      setIsConnected(true);
      wasConnectedRef.current = true;
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      socket.io.off('reconnect_failed', handleReconnectFailed);
    };
  }, [socket, agentId, isConnected, onReconnected]);

  // Subscribe to existing agent on mount if we have an agentId from persisted state
  useEffect(() => {
    if (!socket || !agentId || !socket.connected) return;

    // Re-subscribe to the agent room to resume receiving events
    socket.emit('agent:subscribe', agentId);
  }, [socket, agentId]);

  /**
   * Start a new agent with the given prompt.
   * Returns the agent ID on success, null on failure.
   */
  const startAgent = useCallback(
    async (prompt: string): Promise<string | null> => {
      try {
        const response = await fetch(`${API_BASE}/api/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: phaseId,
            agentType: 'discuss-phase',
            prompt,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to start agent: ${response.status}`);
        }

        const data = await response.json();
        const newAgentId = data.data?.agentId as string | undefined;

        if (!newAgentId) {
          throw new Error('No agent ID in response');
        }

        // Store agent ID and subscribe to streaming
        setAgentId(newAgentId);

        if (socket?.connected) {
          socket.emit('agent:subscribe', newAgentId);
        }

        return newAgentId;
      } catch {
        return null;
      }
    },
    [phaseId, socket, setAgentId]
  );

  /**
   * Cancel the current agent.
   */
  const cancelAgent = useCallback(async (): Promise<void> => {
    if (!agentId) return;

    try {
      await fetch(`${API_BASE}/api/agents/${agentId}`, {
        method: 'DELETE',
      });
    } finally {
      setAgentId(null);
    }
  }, [agentId, setAgentId]);

  return {
    isConnected,
    isReconnecting,
    agentId,
    startAgent,
    cancelAgent,
  };
}
