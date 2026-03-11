/**
 * API Response Envelope Middleware
 *
 * Wraps all JSON responses in a standard envelope format:
 * { data: T, meta: { timestamp: string, requestId: string }, error?: { code: string, message: string, details?: unknown } }
 *
 * Per CONTEXT.md locked decision: All responses use envelope format
 */

import type { Context, MiddlewareHandler } from 'hono';

/**
 * Standard API envelope response format
 */
export interface ApiEnvelope<T = unknown> {
  data: T | null;
  meta: {
    timestamp: string;
    requestId: string;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Pagination metadata for list responses
 */
export interface PaginationMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
  total?: number;
}

/**
 * Paginated envelope response
 */
export interface PaginatedEnvelope<T> extends ApiEnvelope<{ items: T[]; pagination: PaginationMeta }> {
  data: {
    items: T[];
    pagination: PaginationMeta;
  };
}

// Type declaration for Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string;
  }
}

/**
 * Middleware that adds requestId to context for all requests.
 * Use success() and error() helpers for envelope responses.
 */
export const envelopeMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set('requestId', requestId);

  // Add requestId to response headers for debugging
  c.header('X-Request-Id', requestId);

  await next();
};

/**
 * Create a success envelope response
 */
export function success<T>(
  c: Context,
  data: T,
  status: 200 | 201 = 200
): Response {
  const envelope: ApiEnvelope<T> = {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') ?? 'unknown',
    },
  };

  return c.json(envelope, status);
}

/**
 * Create a paginated success envelope response
 */
export function paginated<T>(
  c: Context,
  items: T[],
  pagination: PaginationMeta,
  status: 200 = 200
): Response {
  const envelope: PaginatedEnvelope<T> = {
    data: {
      items,
      pagination,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') ?? 'unknown',
    },
  };

  return c.json(envelope, status);
}

/**
 * Create an error envelope response
 */
export function error(
  c: Context,
  code: string,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 = 500,
  details?: unknown
): Response {
  const envelope: ApiEnvelope<null> = {
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') ?? 'unknown',
    },
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
    },
  };

  return c.json(envelope, status);
}
