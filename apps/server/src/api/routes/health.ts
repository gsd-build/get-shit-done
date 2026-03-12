/**
 * Health Routes
 *
 * GET /api/health/summary - Returns combined Socket.IO and security metrics
 * GET /api/health/socket-room - Verifies realtime channel + room handshake
 */

import { Hono } from 'hono';
import type { Server } from 'socket.io';
import { io as socketClient } from 'socket.io-client';
import { success } from '../middleware/envelope.js';
import { collectHealthMetrics } from '../../socket/health.js';
import { getSecurityMetrics } from '../../middleware/security.js';
import { getAllowedOrigins } from '../../config/cors.js';
import type { HealthSummary } from '../schemas/responses.js';

// Module-level state for server start time
const serverStartedAt = new Date().toISOString();
const SOCKET_PROBE_TIMEOUT_MS = 5000;

interface SocketProbeResult {
  ok: boolean;
  namespace: string;
  room: string;
  socketId?: string;
  connectedClients?: number;
  error?: string;
}

async function probeSocketRoom(c: { req: { url: string } }, io: Server): Promise<SocketProbeResult> {
  const requestUrl = new URL(c.req.url);
  const origin = `${requestUrl.protocol}//${requestUrl.host}`;
  const probeProjectId = `health-probe-${Date.now()}`;
  const roomName = `project:${probeProjectId}`;

  return await new Promise<SocketProbeResult>((resolve) => {
    const client = socketClient(origin, {
      path: '/socket.io',
      // Use long-polling for probe stability across ingress/LB setups.
      // This still validates Socket.IO handshake + room join behavior.
      transports: ['polling'],
      query: { projectId: probeProjectId },
      reconnection: false,
      timeout: SOCKET_PROBE_TIMEOUT_MS,
    });

    const finish = (result: SocketProbeResult): void => {
      client.removeAllListeners();
      client.disconnect();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({
        ok: false,
        namespace: '/',
        room: roomName,
        error: 'SOCKET_PROBE_TIMEOUT',
      });
    }, SOCKET_PROBE_TIMEOUT_MS);

    client.on('connect', () => {
      clearTimeout(timeout);
      const roomMembers = io.sockets.adapter.rooms.get(roomName);
      const clientId = client.id;
      const roomHasClient = Boolean(clientId && roomMembers?.has(clientId));

      finish({
        ok: roomHasClient,
        namespace: '/',
        room: roomName,
        ...(clientId && { socketId: clientId }),
        connectedClients: io.sockets.sockets.size,
        ...(roomHasClient ? {} : { error: 'ROOM_HANDSHAKE_FAILED' }),
      });
    });

    client.on('connect_error', (err) => {
      clearTimeout(timeout);
      finish({
        ok: false,
        namespace: '/',
        room: roomName,
        error: err.message,
      });
    });
  });
}

/**
 * Create health routes
 *
 * @param io - Socket.IO server instance for collecting metrics
 */
export function createHealthRoutes(io: Server): Hono {
  const app = new Hono();

  /**
   * GET /health/summary
   * Returns combined Socket.IO server metrics and security metrics
   */
  app.get('/summary', (c) => {
    // Collect Socket.IO metrics
    const socketMetrics = collectHealthMetrics(io);

    // Get security metrics from audit log
    const securityMetrics = getSecurityMetrics();

    // Build response (securityMetrics matches @gsd/gsd-core SecurityMetrics)
    const summary: HealthSummary = {
      socket: {
        connectedClients: socketMetrics.connectedClients,
        roomCounts: socketMetrics.roomCounts,
        uptime: socketMetrics.uptime,
        memoryUsage: socketMetrics.memoryUsage,
      },
      security: {
        blockedCount: securityMetrics.blockedCount,
        allowedCount: securityMetrics.allowedCount,
        symlinkCount: securityMetrics.symlinkCount,
        deniedPatterns: securityMetrics.deniedPatterns,
      },
      server: {
        version: '0.0.1',
        nodeVersion: process.version,
        startedAt: serverStartedAt,
      },
    };

    return success(c, summary);
  });

  /**
   * GET /health/socket-room
   * Runtime deployment probe for realtime availability:
   * - Socket.IO handshake succeeds
   * - project:* room join succeeds via query.projectId
   */
  app.get('/socket-room', async (c) => {
    const result = await probeSocketRoom(c, io);
    return success(c, {
      ...result,
      corsAllowedOrigins: getAllowedOrigins(),
    });
  });

  return app;
}
