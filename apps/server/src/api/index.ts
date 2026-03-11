/**
 * REST API with Hono
 *
 * Creates a Hono REST API that integrates with the existing HTTP server
 * alongside Socket.IO. Provides endpoints for projects, phases, and health.
 *
 * Integration pattern:
 * - Hono handles requests starting with /api/*
 * - Socket.IO continues to handle WebSocket upgrades
 * - Both share the same HTTP server
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { Server as HttpServer, IncomingMessage, ServerResponse } from 'http';
import type { Server as SocketServer } from 'socket.io';
import { envelopeMiddleware } from './middleware/envelope.js';
import { errorHandler } from './middleware/errors.js';
import { createHealthRoutes } from './routes/health.js';
import { createProjectRoutes } from './routes/projects.js';
import { createPhasesRoutes } from './routes/phases.js';
import { createAgentRoutes } from './routes/agents.js';
import type { Orchestrator } from '../orchestrator/index.js';

/**
 * API configuration options
 */
export interface ApiConfig {
  /** Directories to scan for GSD projects */
  searchPaths?: string[];
  /** Agent orchestrator for agent lifecycle endpoints */
  orchestrator?: Orchestrator;
}

/**
 * Create and attach the REST API to an existing HTTP server.
 *
 * @param httpServer - Existing HTTP server (shared with Socket.IO)
 * @param io - Socket.IO server instance (for health metrics)
 * @param config - API configuration options
 * @returns Cleanup function
 */
export function createApi(
  httpServer: HttpServer,
  io: SocketServer,
  config: ApiConfig = {}
): () => void {
  // Default search paths: parent directory and home projects
  const searchPaths = config.searchPaths ?? [
    process.cwd(),
    process.env['HOME'] ? `${process.env['HOME']}/Projects` : '',
  ].filter(Boolean);

  // Create Hono app
  const app = new Hono().basePath('/api');

  // Apply CORS middleware (must be before other middleware)
  app.use(
    '*',
    cors({
      origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
      credentials: true,
    })
  );

  // Apply global middleware
  app.use('*', envelopeMiddleware);

  // Set error handler
  app.onError(errorHandler);

  // Mount routes
  app.route('/health', createHealthRoutes(io));
  app.route('/projects', createProjectRoutes(searchPaths));
  // Phases are mounted under /projects for RESTful URLs
  app.route('/projects', createPhasesRoutes(searchPaths));

  // Mount agent routes if orchestrator is provided
  if (config.orchestrator) {
    app.route('/agents', createAgentRoutes(config.orchestrator));
  }

  // 404 handler for unmatched API routes
  app.notFound((c) => {
    return c.json(
      {
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId') ?? 'unknown',
        },
        error: {
          code: 'NOT_FOUND',
          message: `Route ${c.req.method} ${c.req.path} not found`,
        },
      },
      404
    );
  });

  // Store the original request listener
  const originalListeners = httpServer.listeners('request').slice();

  // Create a request handler that routes to Hono or passes through
  const honoFetch = app.fetch.bind(app);

  /**
   * Request handler that routes /api/* to Hono, else passes to original listeners
   */
  function requestHandler(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '/';

    // Route /api/* requests to Hono
    if (url.startsWith('/api')) {
      // Build the full URL for Hono
      const protocol = 'http';
      const host = req.headers.host ?? 'localhost';
      const fullUrl = `${protocol}://${host}${url}`;

      // Collect body for POST/PUT/PATCH/DELETE requests
      const chunks: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      req.on('end', () => {
        const bodyBuffer = Buffer.concat(chunks);

        // Create Request object for Hono with body if present
        const requestInit: RequestInit = {
          method: req.method ?? 'GET',
          headers: Object.entries(req.headers).reduce(
            (acc, [key, value]) => {
              if (value !== undefined) {
                acc[key] = Array.isArray(value) ? value.join(', ') : value;
              }
              return acc;
            },
            {} as Record<string, string>
          ),
        };

        // Add body for methods that may have one
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
          requestInit.body = bodyBuffer;
        }

        const request = new Request(fullUrl, requestInit);

        // Let Hono handle the request (async IIFE for proper await)
        (async () => {
          try {
            const response = await honoFetch(request);
            // Write status and headers
            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            // Write body
            const body = await response.text();
            res.end(body);
          } catch (err) {
            console.error('[api] Error handling request:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                data: null,
                meta: {
                  timestamp: new Date().toISOString(),
                  requestId: 'error',
                },
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Internal server error',
                },
              })
            );
          }
        })();
      });
    } else {
      // Pass through to original listeners (Socket.IO upgrade handling, etc.)
      for (const listener of originalListeners) {
        (listener as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
      }
    }
  }

  // Remove original listeners and add our routing handler
  httpServer.removeAllListeners('request');
  httpServer.on('request', requestHandler);

  console.log('[api] REST API mounted at /api');
  console.log('[api] Routes: /api/health/summary, /api/projects, /api/projects/:id, /api/projects/:id/phases, /api/agents');

  // Return cleanup function
  return () => {
    // Restore original request listeners
    httpServer.removeAllListeners('request');
    for (const listener of originalListeners) {
      httpServer.on('request', listener as (...args: unknown[]) => void);
    }
    console.log('[api] REST API cleaned up');
  };
}

// Re-export types for consumers
export type { ApiEnvelope, PaginationMeta, PaginatedEnvelope } from './middleware/envelope.js';
export { ApiError, ErrorCodes, type ErrorCode } from './middleware/errors.js';
