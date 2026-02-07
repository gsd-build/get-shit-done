import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { qmd } from '../../src/qmd.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('QMD wrapper integration', () => {
  let testDir: string;
  let originalIsAvailable: typeof qmd.isAvailable;

  beforeEach(() => {
    // Create temp test directory with some markdown files
    testDir = path.join(os.tmpdir(), `gsd-qmd-test-${Date.now()}`);
    fs.mkdirSync(testDir, { recursive: true });

    // Create test markdown files
    fs.writeFileSync(
      path.join(testDir, 'test1.md'),
      `---
phase: 01
tags: [auth, jwt]
---
# Authentication Module

This module handles JWT authentication and session management.
We use jose for token signing and verification.
`
    );

    fs.writeFileSync(
      path.join(testDir, 'test2.md'),
      `---
phase: 02
tags: [api, rest]
---
# API Layer

RESTful API endpoints for user management.
Authentication is required for all protected routes.
`
    );

    fs.writeFileSync(
      path.join(testDir, 'test3.md'),
      `# Unrelated Content

This file contains unrelated content about database migrations.
`
    );

    originalIsAvailable = qmd.isAvailable.bind(qmd);
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    qmd.isAvailable = originalIsAvailable;
  });

  describe('isAvailable', () => {
    it('returns boolean indicating QMD availability', async () => {
      const available = await qmd.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('findMarkdownFiles', () => {
    it('finds all markdown files recursively', () => {
      const files = qmd.findMarkdownFiles(testDir);
      expect(files.length).toBe(3);
      expect(files.some(f => f.endsWith('test1.md'))).toBe(true);
      expect(files.some(f => f.endsWith('test2.md'))).toBe(true);
      expect(files.some(f => f.endsWith('test3.md'))).toBe(true);
    });

    it('excludes node_modules and hidden directories', () => {
      // Create node_modules with markdown
      const nmDir = path.join(testDir, 'node_modules');
      fs.mkdirSync(nmDir, { recursive: true });
      fs.writeFileSync(path.join(nmDir, 'package.md'), '# Package');

      // Create hidden directory with markdown
      const hiddenDir = path.join(testDir, '.hidden');
      fs.mkdirSync(hiddenDir, { recursive: true });
      fs.writeFileSync(path.join(hiddenDir, 'secret.md'), '# Secret');

      const files = qmd.findMarkdownFiles(testDir);
      expect(files.some(f => f.includes('node_modules'))).toBe(false);
      expect(files.some(f => f.includes('.hidden'))).toBe(false);
    });

    it('handles nested directories', () => {
      const nestedDir = path.join(testDir, 'docs', 'api');
      fs.mkdirSync(nestedDir, { recursive: true });
      fs.writeFileSync(path.join(nestedDir, 'nested.md'), '# Nested');

      const files = qmd.findMarkdownFiles(testDir);
      expect(files.some(f => f.endsWith('nested.md'))).toBe(true);
    });

    it('returns empty array for non-existent directory', () => {
      const files = qmd.findMarkdownFiles('/nonexistent/path');
      expect(files).toEqual([]);
    });
  });

  describe('grepFallback', () => {
    it('finds content matching query', async () => {
      const results = await qmd.grepFallback({
        query: 'authentication',
        paths: [testDir],
        limit: 10
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.source.includes('test1.md'))).toBe(true);
      expect(results.some(r => r.source.includes('test2.md'))).toBe(true);
    });

    it('returns results with relevance scores', async () => {
      const results = await qmd.grepFallback({
        query: 'jwt',
        paths: [testDir]
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result).toHaveProperty('relevance');
        expect(typeof result.relevance).toBe('number');
        expect(result.relevance).toBeGreaterThanOrEqual(0);
        expect(result.relevance).toBeLessThanOrEqual(1);
      }
    });

    it('returns content snippets around matches', async () => {
      const results = await qmd.grepFallback({
        query: 'jwt',
        paths: [testDir]
      });

      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(result).toHaveProperty('content');
        expect(result.content.toLowerCase()).toContain('jwt');
      }
    });

    it('respects limit parameter', async () => {
      const results = await qmd.grepFallback({
        query: 'the', // Common word
        paths: [testDir],
        limit: 2
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('sorts results by relevance', async () => {
      const results = await qmd.grepFallback({
        query: 'authentication',
        paths: [testDir]
      });

      if (results.length > 1) {
        for (let i = 1; i < results.length; i++) {
          expect(results[i - 1].relevance).toBeGreaterThanOrEqual(results[i].relevance);
        }
      }
    });

    it('case insensitive search', async () => {
      const results = await qmd.grepFallback({
        query: 'JWT', // Uppercase
        paths: [testDir]
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.source.includes('test1.md'))).toBe(true);
    });

    it('returns empty array for no matches', async () => {
      const results = await qmd.grepFallback({
        query: 'xyznonexistent123',
        paths: [testDir]
      });

      expect(results).toEqual([]);
    });

    it('marks context as grep', async () => {
      const results = await qmd.grepFallback({
        query: 'authentication',
        paths: [testDir]
      });

      for (const result of results) {
        expect(result.context).toBe('grep');
      }
    });
  });

  describe('search (integration)', () => {
    it('uses grep fallback when QMD unavailable', async () => {
      // Force QMD unavailable
      vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);

      const results = await qmd.search({
        query: 'authentication',
        paths: [testDir]
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toBe('grep');
    });

    it('uses grep fallback when no collection specified', async () => {
      const results = await qmd.search({
        query: 'authentication',
        paths: [testDir]
        // No collection specified
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].context).toBe('grep');
    });
  });

  describe('createCollection', () => {
    it('returns graceful error when QMD unavailable', async () => {
      vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);

      const result = await qmd.createCollection({
        name: 'test-collection',
        paths: [testDir]
      });

      expect(result.success).toBe(false);
      expect(result.reason).toBe('qmd_not_available');
    });
  });

  describe('index', () => {
    it('returns graceful error when QMD unavailable', async () => {
      vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);

      const result = await qmd.index('test-collection');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('qmd_not_available');
    });
  });

  describe('status', () => {
    it('returns available: false when QMD unavailable', async () => {
      vi.spyOn(qmd, 'isAvailable').mockResolvedValue(false);

      const result = await qmd.status('test-collection');

      expect(result.available).toBe(false);
    });
  });
});
