/**
 * API Error Handler Middleware
 *
 * Handles uncaught errors and returns structured error responses.
 * Environment-aware verbosity: full stack traces in dev, code+message in prod.
 *
 * Per CONTEXT.md locked decision: Environment-aware error verbosity
 */

import type { Context, ErrorHandler } from 'hono';
import type { ApiEnvelope } from './envelope.js';

/**
 * Standard error codes for API errors
 */
export const ErrorCodes = {
  // Client errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INVALID_CURSOR: 'INVALID_CURSOR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  GSD_TOOLS_ERROR: 'GSD_TOOLS_ERROR',
  SPAWN_ERROR: 'SPAWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Custom API error class with code and status
 */
export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Check if we're in production mode
 */
function isProduction(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

/**
 * Error handler for uncaught errors.
 * Returns structured error envelope with environment-aware verbosity.
 */
export const errorHandler: ErrorHandler = (err: Error, c: Context): Response => {
  console.error(`[api] Error:`, err);

  // Handle known API errors
  if (err instanceof ApiError) {
    const envelope: ApiEnvelope<null> = {
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') ?? 'unknown',
      },
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
      },
    };

    return c.json(envelope, err.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError' && 'issues' in err) {
    const envelope: ApiEnvelope<null> = {
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: c.get('requestId') ?? 'unknown',
      },
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: isProduction() ? undefined : (err as { issues: unknown }).issues,
      },
    };

    return c.json(envelope, 400);
  }

  // Handle unknown errors with environment-aware verbosity
  const envelope: ApiEnvelope<null> = {
    data: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: c.get('requestId') ?? 'unknown',
    },
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProduction() ? 'Internal server error' : err.message,
      details: isProduction()
        ? undefined
        : {
            name: err.name,
            stack: err.stack?.split('\n').slice(0, 5),
          },
    },
  };

  return c.json(envelope, 500);
};
