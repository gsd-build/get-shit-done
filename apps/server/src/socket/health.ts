/**
 * Health metrics collection and broadcast
 *
 * Provides app-level health metrics alongside Socket.IO's built-in heartbeat.
 * Broadcasts connected clients, room counts, uptime, and memory usage.
 */

import type { Server } from 'socket.io';
import type { HealthMetricsEvent } from '@gsd/events';

const startTime = Date.now();

/**
 * Collect current health metrics from the Socket.IO server
 */
export function collectHealthMetrics(io: Server): HealthMetricsEvent {
  const sockets = io.sockets.sockets;
  const connectedClients = sockets.size;

  // Collect room counts
  const roomCounts: Record<string, number> = {};
  const rooms = io.sockets.adapter.rooms;
  rooms.forEach((members, roomName) => {
    // Skip socket ID rooms (each socket auto-joins its own ID room)
    if (!sockets.has(roomName)) {
      roomCounts[roomName] = members.size;
    }
  });

  return {
    connectedClients,
    roomCounts,
    uptime: Date.now() - startTime,
    memoryUsage: process.memoryUsage().heapUsed,
  };
}

/**
 * Start periodic health broadcast to all connected clients.
 *
 * @param io - Socket.IO server instance
 * @param intervalMs - Broadcast interval in milliseconds (default 30000)
 * @returns Cleanup function to stop the broadcast
 */
export function startHealthBroadcast(io: Server, intervalMs = 30000): () => void {
  const timer = setInterval(() => {
    const metrics = collectHealthMetrics(io);
    io.emit('connection:health', metrics);
  }, intervalMs);

  return () => clearInterval(timer);
}
