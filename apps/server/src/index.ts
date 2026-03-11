/**
 * @gsd/server - GSD Dashboard Server Entry Point
 *
 * Combined Socket.IO + REST API server with:
 * - Connection state recovery (2-minute window)
 * - Room-based event routing (project:*, agent:*)
 * - REST API for project data and health (Hono)
 * - Graceful shutdown handling
 * - Path security with symlink validation
 */

import { createSocketServer } from './socket/server.js';
import { registerHandlers } from './socket/handlers.js';
import { createSecurityConfig, getSecurityMetrics } from './middleware/security.js';
import { createApi } from './api/index.js';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

// Add project root from environment or current directory
const PROJECT_ROOT = process.env['GSD_PROJECT_ROOT'] ?? process.cwd();

// Project search paths (can be overridden via environment)
const SEARCH_PATHS = process.env['GSD_SEARCH_PATHS']
  ? process.env['GSD_SEARCH_PATHS'].split(':')
  : [PROJECT_ROOT, process.env['HOME'] ? `${process.env['HOME']}/Projects` : ''].filter(
      Boolean
    );

// Security configuration per CONTEXT.md
const securityConfig = createSecurityConfig({
  projectRoot: PROJECT_ROOT,
  symlinkPolicy: 'allow', // Default per CONTEXT.md
});

// Export for use by handlers
export { securityConfig, getSecurityMetrics };

// Create server with connection state recovery
const { httpServer, io } = createSocketServer({ port: PORT });

// Register Socket.IO event handlers
const cleanupSocketHandlers = registerHandlers(io);

// Attach REST API to the HTTP server (before listen)
const cleanupApi = createApi(httpServer, io, {
  searchPaths: SEARCH_PATHS,
});

// Start listening
httpServer.listen(PORT, () => {
  console.log(`[server] GSD Dashboard Server listening on port ${PORT}`);
  console.log(`[server] REST API: http://localhost:${PORT}/api`);
  console.log(`[server] Socket.IO: ws://localhost:${PORT}`);
  console.log(`[server] Security configured for: ${PROJECT_ROOT}`);
  console.log(`[server] Project search paths: ${SEARCH_PATHS.join(', ')}`);
  console.log(`[server] Connection state recovery: 2 minutes`);
});

// Graceful shutdown
function handleShutdown(signal: string): void {
  console.log(`[server] Received ${signal}, shutting down gracefully...`);

  // Run registered cleanup functions
  cleanupApi();
  cleanupSocketHandlers();

  // Close Socket.IO connections
  io.close(() => {
    console.log('[server] Socket.IO connections closed');
    httpServer.close(() => {
      console.log('[server] HTTP server closed');
      process.exit(0);
    });
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('[server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
