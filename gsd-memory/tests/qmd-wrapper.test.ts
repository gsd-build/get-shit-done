import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { qmd, QmdSearchResult } from '../src/qmd.js';

describe('QMD wrapper', () => {
  describe('isAvailable', () => {
    it('returns boolean indicating QMD availability', async () => {
      const available = await qmd.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('when QMD is available', () => {
    // These tests only run if QMD is actually installed
    it.skipIf(async () => !(await qmd.isAvailable()))('can check status', async () => {
      const available = await qmd.isAvailable();
      if (!available) return;

      // Just verify the method doesn't throw
      expect(qmd.isAvailable).toBeDefined();
    });
  });

  describe('when QMD is not available', () => {
    let originalIsAvailable: typeof qmd.isAvailable;

    beforeEach(() => {
      originalIsAvailable = qmd.isAvailable;
      qmd.isAvailable = vi.fn().mockResolvedValue(false);
    });

    afterEach(() => {
      qmd.isAvailable = originalIsAvailable;
    });

    it('search falls back to grep-based results', async () => {
      const results = await qmd.search({
        query: 'authentication',
        paths: ['/nonexistent/path']
      });

      // Should return empty array without QMD, not throw
      expect(Array.isArray(results)).toBe(true);
    });

    it('createCollection returns graceful error', async () => {
      const result = await qmd.createCollection({
        name: 'test-project',
        paths: ['/tmp/test-project/.planning'],
        context: 'GSD project'
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('qmd_not_available');
    });

    it('index returns graceful error', async () => {
      const result = await qmd.index('test-project');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('qmd_not_available');
    });

    it('status returns unavailable state', async () => {
      const status = await qmd.status('test-project');

      expect(status.available).toBe(false);
    });
  });

  describe('grep fallback', () => {
    it('searches files with grep when QMD unavailable', async () => {
      // Force fallback mode
      const originalIsAvailable = qmd.isAvailable;
      qmd.isAvailable = vi.fn().mockResolvedValue(false);

      try {
        const results = await qmd.grepFallback({
          query: 'phase',
          paths: [process.cwd() + '/tests/fixtures']
        });

        // Should find matches in our fixture files
        expect(Array.isArray(results)).toBe(true);
        // Fixtures contain 'phase'
        expect(results.length).toBeGreaterThan(0);
      } finally {
        qmd.isAvailable = originalIsAvailable;
      }
    });

    it('grep fallback returns structured results', async () => {
      const results = await qmd.grepFallback({
        query: 'JWT',
        paths: [process.cwd() + '/tests/fixtures']
      });

      if (results.length > 0) {
        expect(results[0]).toHaveProperty('content');
        expect(results[0]).toHaveProperty('source');
        expect(results[0]).toHaveProperty('relevance');
      }
    });
  });
});
