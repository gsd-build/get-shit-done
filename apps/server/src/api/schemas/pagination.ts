/**
 * Pagination Schemas and Utilities
 *
 * Provides cursor-based pagination for list endpoints.
 * Cursor is base64-encoded JSON: { id, ts }
 */

import { z } from 'zod';

/**
 * Pagination query parameters schema
 */
export const PaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/**
 * Cursor payload structure
 */
interface CursorPayload {
  id: string;
  ts: number;
}

/**
 * Encode a cursor from id and timestamp
 *
 * @param id - Resource identifier
 * @param timestamp - Timestamp for ordering (Date or epoch ms)
 * @returns Base64-encoded cursor string
 */
export function encodeCursor(id: string, timestamp: Date | number): string {
  const ts = typeof timestamp === 'number' ? timestamp : timestamp.getTime();
  const payload: CursorPayload = { id, ts };
  // Use btoa for base64 encoding (available in Node.js 16+)
  return Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
}

/**
 * Decode a cursor string
 *
 * @param cursor - Base64-encoded cursor string
 * @returns Decoded cursor payload or null if invalid
 */
export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as unknown;

    // Validate shape
    if (
      typeof payload === 'object' &&
      payload !== null &&
      'id' in payload &&
      'ts' in payload &&
      typeof (payload as CursorPayload).id === 'string' &&
      typeof (payload as CursorPayload).ts === 'number'
    ) {
      return payload as CursorPayload;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Apply cursor-based pagination to an array of items
 *
 * @param items - Array of items with id and timestamp fields
 * @param cursor - Optional cursor to start from
 * @param limit - Number of items to return
 * @param getId - Function to extract id from item
 * @param getTimestamp - Function to extract timestamp from item
 * @returns Paginated items with next cursor
 */
export function paginateItems<T>(
  items: T[],
  cursor: string | undefined,
  limit: number,
  getId: (item: T) => string,
  getTimestamp: (item: T) => Date | number
): {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
} {
  let startIndex = 0;

  // If cursor provided, find the starting position
  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      // Find index of item after the cursor
      startIndex = items.findIndex((item) => {
        const id = getId(item);
        const ts = getTimestamp(item);
        const itemTs = typeof ts === 'number' ? ts : ts.getTime();
        return id === decoded.id && itemTs === decoded.ts;
      });

      // Start after the cursor item
      if (startIndex !== -1) {
        startIndex += 1;
      } else {
        // Cursor not found, start from beginning
        startIndex = 0;
      }
    }
  }

  // Get the page of items
  const pageItems = items.slice(startIndex, startIndex + limit);
  const hasNextPage = startIndex + limit < items.length;

  // Create next cursor from last item
  let nextCursor: string | null = null;
  if (hasNextPage && pageItems.length > 0) {
    const lastItem = pageItems[pageItems.length - 1];
    if (lastItem) {
      nextCursor = encodeCursor(getId(lastItem), getTimestamp(lastItem));
    }
  }

  return {
    items: pageItems,
    nextCursor,
    hasNextPage,
  };
}
