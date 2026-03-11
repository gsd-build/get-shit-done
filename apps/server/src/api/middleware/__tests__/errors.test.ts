import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { ZodError, z } from 'zod';
import { errorHandler, ApiError, ErrorCodes } from '../errors.js';
import { envelopeMiddleware, type ApiEnvelope } from '../envelope.js';

describe('error handler', () => {
  let app: Hono;
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    app = new Hono();
    app.use('*', envelopeMiddleware);
    app.onError(errorHandler);
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  describe('ApiError handling', () => {
    it('returns structured error for ApiError', async () => {
      // Arrange
      app.get('/test', () => {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'Project not found', 404);
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(404);
      expect(body.data).toBeNull();
      expect(body.error?.code).toBe('NOT_FOUND');
      expect(body.error?.message).toBe('Project not found');
    });

    it('includes details from ApiError', async () => {
      // Arrange
      app.get('/test', () => {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          'Validation failed',
          400,
          { field: 'name', required: true }
        );
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.error?.details).toEqual({ field: 'name', required: true });
    });

    it('uses correct status code from ApiError', async () => {
      // Arrange
      const testCases = [
        { code: ErrorCodes.VALIDATION_ERROR, status: 400 },
        { code: ErrorCodes.NOT_FOUND, status: 404 },
        { code: ErrorCodes.RATE_LIMITED, status: 429 },
        { code: ErrorCodes.INTERNAL_ERROR, status: 500 },
      ] as const;

      for (const { code, status } of testCases) {
        app.get(`/test-${status}`, () => {
          throw new ApiError(code, 'Test error', status);
        });
      }

      // Act & Assert
      for (const { status } of testCases) {
        const response = await app.request(`/test-${status}`);
        expect(response.status).toBe(status);
      }
    });
  });

  describe('ZodError handling', () => {
    it('returns validation error for ZodError in development', async () => {
      // Arrange
      process.env['NODE_ENV'] = 'development';
      app.get('/test', () => {
        const schema = z.object({ name: z.string() });
        schema.parse({ name: 123 }); // Will throw ZodError
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      expect(body.error?.message).toBe('Validation failed');
      expect(body.error?.details).toBeDefined();
    });

    it('hides validation details in production', async () => {
      // Arrange
      process.env['NODE_ENV'] = 'production';
      app.get('/test', () => {
        const schema = z.object({ name: z.string() });
        schema.parse({ name: 123 });
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(400);
      expect(body.error?.code).toBe('VALIDATION_ERROR');
      expect(body.error?.details).toBeUndefined();
    });
  });

  describe('unknown error handling', () => {
    it('returns full error details in development', async () => {
      // Arrange
      process.env['NODE_ENV'] = 'development';
      app.get('/test', () => {
        throw new Error('Something unexpected happened');
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(500);
      expect(body.error?.code).toBe('INTERNAL_ERROR');
      expect(body.error?.message).toBe('Something unexpected happened');
      expect(body.error?.details).toBeDefined();
      expect((body.error?.details as { name: string })?.name).toBe('Error');
      expect((body.error?.details as { stack: string[] })?.stack).toBeDefined();
    });

    it('hides error details in production', async () => {
      // Arrange
      process.env['NODE_ENV'] = 'production';
      app.get('/test', () => {
        throw new Error('Sensitive internal error');
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(500);
      expect(body.error?.code).toBe('INTERNAL_ERROR');
      expect(body.error?.message).toBe('Internal server error');
      expect(body.error?.details).toBeUndefined();
    });

    it('truncates stack trace to 5 lines', async () => {
      // Arrange
      process.env['NODE_ENV'] = 'development';
      app.get('/test', () => {
        throw new Error('Deep error');
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      const stack = (body.error?.details as { stack: string[] })?.stack;
      expect(stack).toBeDefined();
      expect(stack.length).toBeLessThanOrEqual(5);
    });
  });

  describe('ErrorCodes', () => {
    it('defines all expected error codes', () => {
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.PROJECT_NOT_FOUND).toBe('PROJECT_NOT_FOUND');
      expect(ErrorCodes.INVALID_CURSOR).toBe('INVALID_CURSOR');
      expect(ErrorCodes.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCodes.GSD_TOOLS_ERROR).toBe('GSD_TOOLS_ERROR');
      expect(ErrorCodes.SPAWN_ERROR).toBe('SPAWN_ERROR');
    });
  });

  describe('ApiError class', () => {
    it('sets name to ApiError', () => {
      const error = new ApiError(ErrorCodes.NOT_FOUND, 'Not found', 404);
      expect(error.name).toBe('ApiError');
    });

    it('defaults status to 500', () => {
      const error = new ApiError(ErrorCodes.INTERNAL_ERROR, 'Error');
      expect(error.status).toBe(500);
    });

    it('is instanceof Error', () => {
      const error = new ApiError(ErrorCodes.NOT_FOUND, 'Not found', 404);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('meta fields', () => {
    it('includes timestamp in error response', async () => {
      // Arrange
      app.get('/test', () => {
        throw new Error('Test');
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.meta.timestamp).toBeDefined();
      expect(new Date(body.meta.timestamp).getTime()).not.toBeNaN();
    });

    it('includes requestId in error response', async () => {
      // Arrange
      app.get('/test', () => {
        throw new Error('Test');
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.meta.requestId).toBeDefined();
      expect(body.meta.requestId).not.toBe('unknown');
    });
  });
});
