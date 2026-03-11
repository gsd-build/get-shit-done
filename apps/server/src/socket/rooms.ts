/**
 * Room management for Socket.IO
 *
 * Room naming conventions per CONTEXT.md:
 * - project:{projectId} - All events for a project
 * - agent:{agentId} - Events for a specific agent
 *
 * Prefixed names prevent collisions with socket IDs.
 */

import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@gsd/events';

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Get room name for a project
 */
export function projectRoom(projectId: string): string {
  return `project:${projectId}`;
}

/**
 * Get room name for an agent
 */
export function agentRoom(agentId: string): string {
  return `agent:${agentId}`;
}

/**
 * Join a project room
 */
export function joinProjectRoom(socket: TypedSocket, projectId: string): void {
  socket.join(projectRoom(projectId));
  // Store projectId in socket data for later reference
  socket.data.projectId = projectId;
}

/**
 * Join an agent room
 */
export function joinAgentRoom(socket: TypedSocket, agentId: string): void {
  socket.join(agentRoom(agentId));
  // Track subscribed agents in socket data
  if (!socket.data.subscribedAgents) {
    socket.data.subscribedAgents = new Set();
  }
  socket.data.subscribedAgents.add(agentId);
}

/**
 * Leave an agent room
 */
export function leaveAgentRoom(socket: TypedSocket, agentId: string): void {
  socket.leave(agentRoom(agentId));
  socket.data.subscribedAgents?.delete(agentId);
}
