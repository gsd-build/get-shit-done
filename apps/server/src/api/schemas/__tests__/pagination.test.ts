import { describe, it, expect } from 'vitest';
import {
  encodeCursor,
  decodeCursor,
  paginateItems,
  PaginationQuerySchema,
} from '../pagination.js';

describe('pagination', () => {
  describe('encodeCursor', () => {
    it('encodes id and timestamp to base64url', () => {
      // Arrange
      const id = 'project-123';
      const timestamp = 1710000000000;

      // Act
      const cursor = encodeCursor(id, timestamp);

      // Assert
      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe('string');
      // Should be valid base64url (no +, /, or =)
      expect(cursor).not.toMatch(/[+/=]/);
    });

    it('encodes Date object timestamps', () => {
      // Arrange
      const id = 'project-456';
      const date = new Date('2024-03-10T12:00:00Z');

      // Act
      const cursor = encodeCursor(id, date);

      // Assert
      const decoded = decodeCursor(cursor);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe(id);
      expect(decoded?.ts).toBe(date.getTime());
    });

    it('produces different cursors for different inputs', () => {
      // Arrange
      const ts = Date.now();

      // Act
      const cursor1 = encodeCursor('id-1', ts);
      const cursor2 = encodeCursor('id-2', ts);
      const cursor3 = encodeCursor('id-1', ts + 1);

      // Assert
      expect(cursor1).not.toBe(cursor2);
      expect(cursor1).not.toBe(cursor3);
    });
  });

  describe('decodeCursor', () => {
    it('decodes a valid cursor', () => {
      // Arrange
      const id = 'test-id';
      const ts = 1710000000000;
      const cursor = encodeCursor(id, ts);

      // Act
      const decoded = decodeCursor(cursor);

      // Assert
      expect(decoded).toEqual({ id, ts });
    });

    it('returns null for invalid base64', () => {
      // Arrange
      const invalidCursor = '!!!invalid!!!';

      // Act
      const result = decodeCursor(invalidCursor);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null for valid base64 with invalid JSON', () => {
      // Arrange
      const invalidJson = Buffer.from('not-json', 'utf-8').toString('base64url');

      // Act
      const result = decodeCursor(invalidJson);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null for JSON with wrong shape (missing id)', () => {
      // Arrange
      const wrongShape = Buffer.from(JSON.stringify({ ts: 123 }), 'utf-8').toString('base64url');

      // Act
      const result = decodeCursor(wrongShape);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null for JSON with wrong shape (missing ts)', () => {
      // Arrange
      const wrongShape = Buffer.from(JSON.stringify({ id: 'test' }), 'utf-8').toString('base64url');

      // Act
      const result = decodeCursor(wrongShape);

      // Assert
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(decodeCursor('')).toBeNull();
    });
  });

  describe('paginateItems', () => {
    interface TestItem {
      id: string;
      name: string;
      createdAt: number;
    }

    const getId = (item: TestItem) => item.id;
    const getTimestamp = (item: TestItem) => item.createdAt;

    const createItems = (count: number): TestItem[] =>
      Array.from({ length: count }, (_, i) => ({
        id: `item-${i}`,
        name: `Item ${i}`,
        createdAt: 1710000000000 + i * 1000,
      }));

    it('returns first page without cursor', () => {
      // Arrange
      const items = createItems(10);

      // Act
      const result = paginateItems(items, undefined, 3, getId, getTimestamp);

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.id).toBe('item-0');
      expect(result.hasNextPage).toBe(true);
      expect(result.nextCursor).not.toBeNull();
    });

    it('returns second page with cursor', () => {
      // Arrange
      const items = createItems(10);
      const firstPage = paginateItems(items, undefined, 3, getId, getTimestamp);

      // Act
      const result = paginateItems(items, firstPage.nextCursor!, 3, getId, getTimestamp);

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.id).toBe('item-3');
      expect(result.hasNextPage).toBe(true);
    });

    it('returns last page with no next cursor', () => {
      // Arrange
      const items = createItems(5);

      // Act
      const result = paginateItems(items, undefined, 5, getId, getTimestamp);

      // Assert
      expect(result.items).toHaveLength(5);
      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('handles invalid cursor by starting from beginning', () => {
      // Arrange
      const items = createItems(5);
      const invalidCursor = 'invalid-cursor';

      // Act
      const result = paginateItems(items, invalidCursor, 3, getId, getTimestamp);

      // Assert
      expect(result.items).toHaveLength(3);
      expect(result.items[0]?.id).toBe('item-0');
    });

    it('handles cursor pointing to non-existent item', () => {
      // Arrange
      const items = createItems(5);
      const strangeCursor = encodeCursor('non-existent', Date.now());

      // Act
      const result = paginateItems(items, strangeCursor, 3, getId, getTimestamp);

      // Assert
      expect(result.items[0]?.id).toBe('item-0');
    });

    it('returns empty array for empty input', () => {
      // Arrange
      const items: TestItem[] = [];

      // Act
      const result = paginateItems(items, undefined, 10, getId, getTimestamp);

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.hasNextPage).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('PaginationQuerySchema', () => {
    it('validates valid query with cursor and limit', () => {
      const result = PaginationQuerySchema.safeParse({
        cursor: 'abc123',
        limit: '50',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.cursor).toBe('abc123');
        expect(result.data.limit).toBe(50);
      }
    });

    it('applies default limit when not provided', () => {
      const result = PaginationQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.cursor).toBeUndefined();
      }
    });

    it('rejects limit below minimum', () => {
      const result = PaginationQuerySchema.safeParse({ limit: '0' });
      expect(result.success).toBe(false);
    });

    it('rejects limit above maximum', () => {
      const result = PaginationQuerySchema.safeParse({ limit: '101' });
      expect(result.success).toBe(false);
    });
  });
});
