/**
 * Integration test for vector add + query roundtrip
 *
 * Tests the full flow: store knowledge items with embeddings,
 * query for semantically similar items, verify relevance.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { vectorAdd } from '../../src/tools/vector-add.js';
import { vectorQuery } from '../../src/tools/vector-query.js';
import { VectorStore } from '../../src/knowledge/vector-store.js';
import * as vectorStoreModule from '../../src/knowledge/vector-store.js';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('Vector add + query integration', () => {
  let tempDir: string;
  let testStore: VectorStore;
  const testProject = 'integration-test';

  beforeAll(() => {
    // Create temp directory for test isolation
    tempDir = mkdtempSync(join(tmpdir(), 'gsd-memory-test-'));
    testStore = new VectorStore(tempDir);

    // Override the default singleton for this test
    Object.defineProperty(vectorStoreModule, 'vectorStore', {
      value: testStore,
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should complete add + query roundtrip with semantic relevance', async () => {
    // Store 3 different knowledge items
    const decision = await vectorAdd({
      project: testProject,
      text: 'Use TypeScript for type safety and better developer experience',
      type: 'decision',
      source: 'SUMMARY.md',
      tags: ['typescript', 'tooling'],
    });

    const pattern = await vectorAdd({
      project: testProject,
      text: 'Implement repository pattern for data access abstraction',
      type: 'pattern',
      source: 'RESEARCH.md',
      tags: ['architecture', 'patterns'],
    });

    const pitfall = await vectorAdd({
      project: testProject,
      text: 'Avoid mixing async/await with callbacks to prevent callback hell',
      type: 'pitfall',
      source: 'RESEARCH.md',
      tags: ['javascript', 'async'],
    });

    // Verify items were stored successfully
    expect(decision.success).toBe(true);
    expect(pattern.success).toBe(true);
    expect(pitfall.success).toBe(true);
    expect(decision.dimensions).toBe(384);

    // Query for TypeScript-related knowledge
    const results = await vectorQuery({
      project: testProject,
      query: 'What should we use for type checking?',
      topK: 3,
      minScore: 0.0,
    });

    // Verify results returned
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);

    // Verify TypeScript decision is in top results (likely first or second)
    const typescriptResult = results.find(r => r.text.includes('TypeScript'));
    expect(typescriptResult).toBeDefined();
    expect(typescriptResult?.type).toBe('decision');
    expect(typescriptResult?.score).toBeGreaterThan(0.3);

    // Verify metadata preserved
    expect(typescriptResult?.tags).toContain('typescript');
    expect(typescriptResult?.source).toBe('SUMMARY.md');
    expect(typescriptResult?.timestamp).toBeTruthy();
  });

  it('should filter results by type', async () => {
    // Query with type filter
    const patternResults = await vectorQuery({
      project: testProject,
      query: 'design patterns',
      topK: 5,
      type: 'pattern',
    });

    // Verify all results match the type filter
    expect(patternResults.length).toBeGreaterThan(0);
    patternResults.forEach(result => {
      expect(result.type).toBe('pattern');
    });
  });

  it('should respect minScore threshold', async () => {
    // Query with high minScore threshold
    const results = await vectorQuery({
      project: testProject,
      query: 'unrelated random gibberish xyz123',
      topK: 10,
      minScore: 0.7, // High threshold
    });

    // Verify all results meet the threshold
    results.forEach(result => {
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    });
  });

  it('should isolate projects', async () => {
    // Add item to different project
    await vectorAdd({
      project: 'other-project',
      text: 'Use React for UI components',
      type: 'decision',
    });

    // Query should not return items from other project
    const results = await vectorQuery({
      project: testProject,
      query: 'React UI',
      topK: 10,
    });

    // None of the results should contain "React" since we're querying testProject
    const hasReact = results.some(r => r.text.includes('React'));
    expect(hasReact).toBe(false);
  });

  it('should handle async/await query correctly', async () => {
    // Query for async-related pitfalls
    const results = await vectorQuery({
      project: testProject,
      query: 'How to avoid problems with asynchronous code?',
      topK: 3,
    });

    // Verify pitfall about async is in results
    const asyncPitfall = results.find(r => r.text.includes('async/await'));
    expect(asyncPitfall).toBeDefined();
    expect(asyncPitfall?.type).toBe('pitfall');
    expect(asyncPitfall?.tags).toContain('async');
  });
});
