/**
 * Health Routes
 *
 * GET /api/health/summary - Returns combined Socket.IO and security metrics
 */

import { Hono } from 'hono';
import type { Server } from 'socket.io';
import { success } from '../middleware/envelope.js';
import { collectHealthMetrics } from '../../socket/health.js';
import { getSecurityMetrics } from '../../middleware/security.js';
import type { HealthSummary } from '../schemas/responses.js';

// Module-level state for server start time
const serverStartedAt = new Date().toISOString();

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

  return app;
}
