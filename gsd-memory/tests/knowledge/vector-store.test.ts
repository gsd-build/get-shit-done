import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { VectorStore } from '../../src/knowledge/vector-store.js';
import { generateEmbedding } from '../../src/embeddings/transformer.js';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('Knowledge - VectorStore', () => {
  let testDir: string;
  let store: VectorStore;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDir = await mkdtemp(join(tmpdir(), 'gsd-test-'));
    store = new VectorStore(testDir);
  });

  afterAll(async () => {
    // Clean up test directories
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should add and query items successfully', async () => {
    const projectId = 'test-project';
    const text = 'Machine learning is a subset of artificial intelligence';
    const vector = await generateEmbedding(text);

    // Add item
    const addResult = await store.add({
      projectId,
      id: 'item-1',
      text,
      vector,
      metadata: { category: 'ai' },
    });

    expect(addResult.success).toBe(true);

    // Query for the same item
    const queryVector = await generateEmbedding(text);
    const results = await store.query({
      projectId,
      vector: queryVector,
      topK: 5,
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('item-1');
    expect(results[0].text).toBe(text);
    expect(results[0].score).toBeGreaterThan(0.9); // Should be very similar to itself
    expect(results[0].metadata.category).toBe('ai');
  }, 60000);

  it('should return results sorted by score', async () => {
    const projectId = 'test-project';

    // Add multiple items
    const items = [
      { id: 'doc-1', text: 'The quick brown fox jumps over the lazy dog' },
      { id: 'doc-2', text: 'A fast brown fox leaps over a sleepy dog' },
      { id: 'doc-3', text: 'Pizza is a traditional Italian dish' },
    ];

    for (const item of items) {
      const vector = await generateEmbedding(item.text);
      await store.add({
        projectId,
        id: item.id,
        text: item.text,
        vector,
      });
    }

    // Query with text similar to first two items
    const queryVector = await generateEmbedding('quick brown fox');
    const results = await store.query({
      projectId,
      vector: queryVector,
      topK: 3,
    });

    // Should get at least 2 results (fox-related documents)
    expect(results.length).toBeGreaterThanOrEqual(2);
    // Results should be sorted by score (highest first)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
    }

    // First two results should be the fox-related documents
    const topIds = [results[0].id, results[1].id];
    expect(topIds).toContain('doc-1');
    expect(topIds).toContain('doc-2');
  }, 90000);

  it('should filter results by minScore', async () => {
    const projectId = 'test-project';

    // Add items
    const items = [
      { id: 'doc-1', text: 'Machine learning is amazing' },
      { id: 'doc-2', text: 'Deep learning is powerful' },
      { id: 'doc-3', text: 'Pizza tastes delicious' },
    ];

    for (const item of items) {
      const vector = await generateEmbedding(item.text);
      await store.add({
        projectId,
        id: item.id,
        text: item.text,
        vector,
      });
    }

    // Query with high minScore
    const queryVector = await generateEmbedding('machine learning');
    const results = await store.query({
      projectId,
      vector: queryVector,
      topK: 10,
      minScore: 0.5, // Only return items with similarity > 0.5
    });

    // Should get ML-related items, but not pizza
    expect(results.length).toBeLessThan(3);
    expect(results.every(r => r.score >= 0.5)).toBe(true);
  }, 90000);

  it('should return empty array for empty index', async () => {
    const projectId = 'empty-project';
    const queryVector = await generateEmbedding('test query');

    const results = await store.query({
      projectId,
      vector: queryVector,
      topK: 5,
    });

    expect(results).toHaveLength(0);
  }, 60000);

  it('should maintain separate indices for different projects', async () => {
    const project1 = 'project-1';
    const project2 = 'project-2';

    // Add item to project 1
    const vector1 = await generateEmbedding('Project 1 data');
    await store.add({
      projectId: project1,
      id: 'item-1',
      text: 'Project 1 data',
      vector: vector1,
    });

    // Add item to project 2
    const vector2 = await generateEmbedding('Project 2 data');
    await store.add({
      projectId: project2,
      id: 'item-2',
      text: 'Project 2 data',
      vector: vector2,
    });

    // Query project 1
    const results1 = await store.query({
      projectId: project1,
      vector: vector1,
      topK: 10,
    });

    // Query project 2
    const results2 = await store.query({
      projectId: project2,
      vector: vector2,
      topK: 10,
    });

    // Each project should only see its own items
    expect(results1).toHaveLength(1);
    expect(results1[0].id).toBe('item-1');

    expect(results2).toHaveLength(1);
    expect(results2[0].id).toBe('item-2');
  }, 90000);
});
