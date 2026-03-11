/**
 * Socket.IO event handlers
 *
 * Handles connection lifecycle, room subscriptions, checkpoint responses,
 * and health metrics broadcast.
 *
 * Per CONTEXT.md:
 * - Checkpoint responses forwarded to orchestrator with idempotency
 * - Pending checkpoints auto-pushed on socket reconnect
 */

import { EVENTS } from '@gsd/events';
import { joinProjectRoom, joinAgentRoom, leaveAgentRoom } from './rooms.js';
import { startHealthBroadcast } from './health.js';
import type { TypedServer } from './server.js';
import type { Orchestrator } from '../orchestrator/index.js';

/**
 * Register all Socket.IO event handlers.
 *
 * @param io - Typed Socket.IO server instance
 * @param orchestrator - Agent orchestrator for checkpoint handling
 * @returns Cleanup function for graceful shutdown
 */
export function registerHandlers(
  io: TypedServer,
  orchestrator: Orchestrator
): () => void {
  // Start health metrics broadcast (30 second interval)
  const stopHealthBroadcast = startHealthBroadcast(io);

  io.on('connection', (socket) => {
    // Log recovery status per RESEARCH.md pattern
    if (socket.recovered) {
      console.log(`[socket] Recovered session: ${socket.id}`);
      // When recovered, the socket is already in its previous rooms
      // and socket.data is restored from the server's internal state

      // Per CONTEXT.md: "Auto-push checkpoint:pending immediately after socket reconnects"
      // Push pending checkpoints for all subscribed agents
      if (socket.data.subscribedAgents) {
        for (const agentId of socket.data.subscribedAgents) {
          const pending = orchestrator.getPendingCheckpointsForAgent(agentId);
          for (const cp of pending) {
            const elapsed = Date.now() - cp.createdAt;
            const remainingTimeout = Math.max(0, cp.timeoutMs - elapsed);
            // Note: Only include options if defined (exactOptionalPropertyTypes)
            socket.emit(EVENTS.CHECKPOINT_REQUEST, {
              checkpointId: cp.checkpointId,
              type: cp.type,
              prompt: cp.prompt,
              ...(cp.options && { options: cp.options }),
              timeoutMs: remainingTimeout,
            });
            console.log(
              `[socket] Re-pushed pending checkpoint ${cp.checkpointId} for agent ${agentId}`
            );
          }
        }
      }
    } else {
      console.log(`[socket] New connection: ${socket.id}`);
      // Initialize socket data for new connections
      socket.data.subscribedAgents = new Set();
    }

    // Join project room from handshake query
    const projectId = socket.handshake.query['projectId'];
    if (typeof projectId === 'string') {
      joinProjectRoom(socket, projectId);
      console.log(`[socket] ${socket.id} joined project:${projectId}`);
    }

    // Subscribe to agent streams
    socket.on('agent:subscribe', (agentId) => {
      joinAgentRoom(socket, agentId);
      console.log(`[socket] ${socket.id} subscribed to agent:${agentId}`);
    });

    // Unsubscribe from agent streams
    socket.on('agent:unsubscribe', (agentId) => {
      leaveAgentRoom(socket, agentId);
      console.log(`[socket] ${socket.id} unsubscribed from agent:${agentId}`);
    });

    // Checkpoint response handling - forward to orchestrator
    // Per CONTEXT.md: idempotency via checkpoint ID + response hash
    socket.on(EVENTS.CHECKPOINT_RESPONSE, (event) => {
      console.log(`[socket] Checkpoint response: ${event.checkpointId}`);

      const result = orchestrator.respondToCheckpoint(
        event.checkpointId,
        event.response
      );

      if (!result.accepted) {
        console.log(
          `[socket] Checkpoint response rejected: ${result.reason}`
        );
        // Could emit error back to client if needed
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] Disconnected: ${socket.id}, reason: ${reason}`);
      // Socket.IO handles room cleanup automatically
      // Connection state recovery will restore rooms on reconnect within the window
    });

    socket.on('error', (error) => {
      // Environment-aware error verbosity per CONTEXT.md
      if (process.env['NODE_ENV'] === 'production') {
        console.error(`[socket] Error on ${socket.id}: ${error.message}`);
      } else {
        console.error(`[socket] Error on ${socket.id}:`, error);
      }
    });
  });

  // Return cleanup function for graceful shutdown
  return () => {
    stopHealthBroadcast();
  };
}
