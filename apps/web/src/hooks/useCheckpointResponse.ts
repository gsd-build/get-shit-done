'use client';

import { useCallback } from 'react';
import { EVENTS, type TypedSocket } from '@gsd/events';
import { useExecutionStore } from '@/stores/executionStore';

/**
 * Hook for responding to checkpoint requests via Socket.IO.
 *
 * Emits CHECKPOINT_RESPONSE event and clears the pending checkpoint
 * from the execution store.
 *
 * @param socket - Typed Socket.IO client (or null if not connected)
 * @returns Object with respondToCheckpoint function
 */
export function useCheckpointResponse(socket: TypedSocket | null) {
  const setCheckpoint = useExecutionStore((state) => state.setCheckpoint);

  const respondToCheckpoint = useCallback(
    (checkpointId: string, response: string) => {
      if (!socket) {
        return;
      }

      // Emit response to server
      socket.emit(EVENTS.CHECKPOINT_RESPONSE, {
        checkpointId,
        response,
      });

      // Clear pending checkpoint from store
      setCheckpoint(null);
    },
    [socket, setCheckpoint]
  );

  return { respondToCheckpoint };
}
