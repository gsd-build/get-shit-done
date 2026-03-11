/**
 * useResearchStream hook - subscribes to Socket.IO research agent events.
 *
 * Stub implementation for RED phase TDD.
 */

'use client';

import { useEffect } from 'react';
import type { TypedSocket } from '@gsd/events';
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
  // Stub implementation - does nothing
  useEffect(() => {
    // No-op
  }, [socket, phaseId]);

  const agents = usePlanStore(selectAgents);
  const isLoading = usePlanStore(selectIsLoading);

  return { agents, isLoading };
}
