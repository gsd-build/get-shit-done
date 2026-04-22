/**
 * Tests for websearch handler (no network when API key unset).
 */

import { describe, it, expect } from 'vitest';
import { websearch } from './websearch.js';

describe('websearch', () => {
  it('returns available:false when BRAVE_API_KEY is not set', async () => {
    const prev = process.env.BRAVE_API_KEY;
    delete process.env.BRAVE_API_KEY;
    const r = await websearch(['test query'], '/tmp');
    const data = r.data as Record<string, unknown>;
    expect(data.available).toBe(false);
    if (prev !== undefined) process.env.BRAVE_API_KEY = prev;
  });

  it('returns error when query is missing and BRAVE_API_KEY is set', async () => {
    const prev = process.env.BRAVE_API_KEY;
    process.env.BRAVE_API_KEY = 'test-dummy-key';
    try {
      const r = await websearch([], '/tmp');
      const data = r.data as Record<string, unknown>;
      expect(data.available).toBe(false);
      expect(data.error).toBe('Query required');
    } finally {
      if (prev !== undefined) process.env.BRAVE_API_KEY = prev;
      else delete process.env.BRAVE_API_KEY;
    }
  });
});
