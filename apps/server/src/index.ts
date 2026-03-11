/**
 * @gsd/server - GSD Dashboard Server Entry Point
 *
 * Socket.IO server with:
 * - Connection state recovery (2-minute window)
 * - Room-based event routing (project:*, agent:*)
 * - Graceful shutdown handling
 * - Path security with symlink validation
 */

import { createSocketServer } from './socket/server.js';
import { registerHandlers } from './socket/handlers.js';
import { createSecurityConfig, getSecurityMetrics } from './middleware/security.js';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

// Add project root from environment or current directory
const PROJECT_ROOT = process.env['GSD_PROJECT_ROOT'] ?? process.cwd();

// Security configuration per CONTEXT.md
const securityConfig = createSecurityConfig({
  projectRoot: PROJECT_ROOT,
  symlinkPolicy: 'allow', // Default per CONTEXT.md
});

// Export for use by handlers
export { securityConfig, getSecurityMetrics };

// Create server with connection state recovery
const { httpServer, io } = createSocketServer({ port: PORT });

// Register event handlers
const cleanup = registerHandlers(io);

// Start listening
httpServer.listen(PORT, () => {
  console.log(`[server] Socket.IO server listening on port ${PORT}`);
  console.log(`[server] Security configured for: ${PROJECT_ROOT}`);
  console.log(`[server] Connection state recovery: 2 minutes`);
  console.log(`[server] Heartbeat: pingInterval=25000, pingTimeout=20000`);
});

// Graceful shutdown
function handleShutdown(signal: string): void {
  console.log(`[server] Received ${signal}, shutting down gracefully...`);

  // Run registered cleanup functions
  cleanup();

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
