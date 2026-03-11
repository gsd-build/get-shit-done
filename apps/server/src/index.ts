/**
 * @gsd/server - GSD Dashboard Server Entry Point
 *
 * Socket.IO server with:
 * - Connection state recovery (2-minute window)
 * - Room-based event routing (project:*, agent:*)
 * - Graceful shutdown handling
 */

import { createSocketServer } from './socket/server.js';
import { registerHandlers } from './socket/handlers.js';

const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

// Create server with connection state recovery
const { httpServer, io } = createSocketServer({ port: PORT });

// Register event handlers
const cleanup = registerHandlers(io);

// Start listening
httpServer.listen(PORT, () => {
  console.log(`[server] Socket.IO server listening on port ${PORT}`);
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
