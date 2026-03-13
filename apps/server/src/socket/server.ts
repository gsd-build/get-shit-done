/**
 * Socket.IO server with connection state recovery
 *
 * Connection state recovery allows clients to reconnect within the
 * maxDisconnectionDuration window without losing their room subscriptions
 * or missing events (Socket.IO buffers events for disconnected clients).
 *
 * Per CONTEXT.md locked decisions:
 * - 2-minute disconnection recovery window
 * - Heartbeat: pingInterval=25000, pingTimeout=20000
 * - CORS configured for dashboard origin
 */

import { Server } from 'socket.io';
import { createServer, type Server as HttpServer } from 'http';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@gsd/events';
import { getAllowedOrigins, isOriginAllowed } from '../config/cors.js';

export interface ServerConfig {
  port: number;
  maxDisconnectionDuration?: number; // Default 2 minutes per CONTEXT.md
  pingInterval?: number; // Default 25000
  pingTimeout?: number; // Default 20000
  corsOrigin?: string; // Backward-compatible single origin override
}

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Create a Socket.IO server with typed events and connection state recovery.
 *
 * @param config - Server configuration
 * @returns HTTP server and typed Socket.IO instance
 */
export function createSocketServer(config: ServerConfig): {
  httpServer: HttpServer;
  io: TypedServer;
} {
  const httpServer = createServer();
  const allowedOrigins = config.corsOrigin ? [config.corsOrigin] : getAllowedOrigins();

  const io: TypedServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    connectionStateRecovery: {
      maxDisconnectionDuration: config.maxDisconnectionDuration ?? 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    pingInterval: config.pingInterval ?? 25000,
    pingTimeout: config.pingTimeout ?? 20000,
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin denied: ${origin}`), false);
      },
      credentials: true,
    },
  });

  return { httpServer, io };
}
