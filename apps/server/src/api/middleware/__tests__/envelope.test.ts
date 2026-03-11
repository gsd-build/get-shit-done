import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
  envelopeMiddleware,
  success,
  paginated,
  error,
  type ApiEnvelope,
  type PaginatedEnvelope,
} from '../envelope.js';

describe('envelope middleware', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.use('*', envelopeMiddleware);
  });

  describe('envelopeMiddleware', () => {
    it('sets requestId on context', async () => {
      // Arrange
      let capturedRequestId: string | undefined;
      app.get('/test', (c) => {
        capturedRequestId = c.get('requestId');
        return c.text('ok');
      });

      // Act
      await app.request('/test');

      // Assert
      expect(capturedRequestId).toBeDefined();
      expect(capturedRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('adds X-Request-Id header to response', async () => {
      // Arrange
      app.get('/test', (c) => c.text('ok'));

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.headers.get('X-Request-Id')).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('generates unique requestId for each request', async () => {
      // Arrange
      app.get('/test', (c) => c.text('ok'));

      // Act
      const response1 = await app.request('/test');
      const response2 = await app.request('/test');

      // Assert
      expect(response1.headers.get('X-Request-Id')).not.toBe(
        response2.headers.get('X-Request-Id')
      );
    });
  });

  describe('success helper', () => {
    it('creates envelope with data and meta', async () => {
      // Arrange
      app.get('/test', (c) => {
        return success(c, { id: 1, name: 'test' });
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<{ id: number; name: string }>;

      // Assert
      expect(response.status).toBe(200);
      expect(body.data).toEqual({ id: 1, name: 'test' });
      expect(body.meta.timestamp).toBeDefined();
      expect(body.meta.requestId).toBeDefined();
      expect(body.error).toBeUndefined();
    });

    it('supports 201 status for created resources', async () => {
      // Arrange
      app.post('/test', (c) => {
        return success(c, { id: 'new-resource' }, 201);
      });

      // Act
      const response = await app.request('/test', { method: 'POST' });
      const body = (await response.json()) as ApiEnvelope<{ id: string }>;

      // Assert
      expect(response.status).toBe(201);
      expect(body.data?.id).toBe('new-resource');
    });

    it('handles null data', async () => {
      // Arrange
      app.get('/test', (c) => {
        return success(c, null);
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.data).toBeNull();
    });

    it('handles array data', async () => {
      // Arrange
      app.get('/test', (c) => {
        return success(c, [1, 2, 3]);
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<number[]>;

      // Assert
      expect(body.data).toEqual([1, 2, 3]);
    });
  });

  describe('paginated helper', () => {
    it('creates paginated envelope with items and pagination', async () => {
      // Arrange
      app.get('/test', (c) => {
        return paginated(
          c,
          [{ id: 1 }, { id: 2 }],
          { nextCursor: 'abc123', hasNextPage: true, total: 100 }
        );
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as PaginatedEnvelope<{ id: number }>;

      // Assert
      expect(response.status).toBe(200);
      expect(body.data.items).toHaveLength(2);
      expect(body.data.pagination).toEqual({
        nextCursor: 'abc123',
        hasNextPage: true,
        total: 100,
      });
      expect(body.meta.timestamp).toBeDefined();
    });

    it('handles last page with no next cursor', async () => {
      // Arrange
      app.get('/test', (c) => {
        return paginated(
          c,
          [{ id: 1 }],
          { nextCursor: null, hasNextPage: false }
        );
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as PaginatedEnvelope<{ id: number }>;

      // Assert
      expect(body.data.pagination.nextCursor).toBeNull();
      expect(body.data.pagination.hasNextPage).toBe(false);
    });

    it('handles empty items array', async () => {
      // Arrange
      app.get('/test', (c) => {
        return paginated(c, [], { nextCursor: null, hasNextPage: false });
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as PaginatedEnvelope<unknown>;

      // Assert
      expect(body.data.items).toHaveLength(0);
    });
  });

  describe('error helper', () => {
    it('creates error envelope with code and message', async () => {
      // Arrange
      app.get('/test', (c) => {
        return error(c, 'NOT_FOUND', 'Resource not found', 404);
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(response.status).toBe(404);
      expect(body.data).toBeNull();
      expect(body.error?.code).toBe('NOT_FOUND');
      expect(body.error?.message).toBe('Resource not found');
      expect(body.meta.timestamp).toBeDefined();
    });

    it('includes details when provided', async () => {
      // Arrange
      app.get('/test', (c) => {
        return error(c, 'VALIDATION_ERROR', 'Invalid input', 422, {
          field: 'email',
          issue: 'invalid format',
        });
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.error?.details).toEqual({
        field: 'email',
        issue: 'invalid format',
      });
    });

    it('omits details when undefined', async () => {
      // Arrange
      app.get('/test', (c) => {
        return error(c, 'SERVER_ERROR', 'Something went wrong', 500);
      });

      // Act
      const response = await app.request('/test');
      const body = (await response.json()) as ApiEnvelope<null>;

      // Assert
      expect(body.error?.details).toBeUndefined();
      expect('details' in (body.error ?? {})).toBe(false);
    });

    it('defaults to 500 status', async () => {
      // Arrange
      app.get('/test', (c) => {
        return error(c, 'INTERNAL', 'Unexpected error');
      });

      // Act
      const response = await app.request('/test');

      // Assert
      expect(response.status).toBe(500);
    });

    it('supports various error status codes', async () => {
      // Arrange
      const statusCodes = [400, 401, 403, 404, 409, 422, 429, 500] as const;

      for (const status of statusCodes) {
        app.get(`/test-${status}`, (c) => {
          return error(c, 'TEST_ERROR', `Error ${status}`, status);
        });
      }

      // Act & Assert
      for (const status of statusCodes) {
        const response = await app.request(`/test-${status}`);
        expect(response.status).toBe(status);
      }
    });
  });

  describe('requestId fallback', () => {
    it('uses "unknown" when requestId not set', async () => {
      // Arrange - app without middleware
      const appWithoutMiddleware = new Hono();
      appWithoutMiddleware.get('/test', (c) => {
        return success(c, { test: true });
      });

      // Act
      const response = await appWithoutMiddleware.request('/test');
      const body = (await response.json()) as ApiEnvelope<{ test: boolean }>;

      // Assert
      expect(body.meta.requestId).toBe('unknown');
    });
  });
});
