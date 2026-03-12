'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createTokenBuffer, type TypedSocket, type TokenBufferState } from '@gsd/events';

/**
 * React hook wrapper around createTokenBuffer from @gsd/events.
 *
 * Provides RAF-based token buffering for efficient token streaming display.
 * Automatically disposes buffer on unmount.
 *
 * @param socket - TypedSocket instance (null if not connected)
 * @param onUpdate - Callback fired when tokens are flushed from buffer
 * @returns Object with push function to manually add tokens
 */
export function useTokenBuffer(
  socket: TypedSocket | null,
  onUpdate: (tokens: string[]) => void
) {
  const bufferRef = useRef<TokenBufferState | null>(null);
  const currentAgentRef = useRef<string | null>(null);

  // Cleanup on unmount or socket change
  useEffect(() => {
    if (!socket) {
      bufferRef.current = null;
      return;
    }

    bufferRef.current = createTokenBuffer(socket, onUpdate);

    return () => {
      if (bufferRef.current && currentAgentRef.current) {
        bufferRef.current.unsubscribe(currentAgentRef.current);
      }
      bufferRef.current = null;
    };
  }, [socket, onUpdate]);

  const subscribe = useCallback((agentId: string) => {
    if (bufferRef.current) {
      bufferRef.current.subscribe(agentId);
      currentAgentRef.current = agentId;
    }
  }, []);

  const unsubscribe = useCallback((agentId: string) => {
    if (bufferRef.current) {
      bufferRef.current.unsubscribe(agentId);
      if (currentAgentRef.current === agentId) {
        currentAgentRef.current = null;
      }
    }
  }, []);

  const clear = useCallback(() => {
    if (bufferRef.current) {
      bufferRef.current.clear();
    }
  }, []);

  return {
    subscribe,
    unsubscribe,
    clear,
    get tokens() {
      return bufferRef.current?.tokens ?? [];
    },
  };
}
