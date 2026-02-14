import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vectorQuery } from '../../src/tools/vector-query.js';
import * as transformer from '../../src/embeddings/transformer.js';
import * as vectorStoreModule from '../../src/knowledge/vector-store.js';

// Mock the embedding generation to avoid loading the model
vi.mock('../../src/embeddings/transformer.js', async () => {
  const actual = await vi.importActual('../../src/embeddings/transformer.js');
  return {
    ...actual,
    generateEmbedding: vi.fn(async (text: string) => {
      // Return a mock 384-dim vector
      return Array(384).fill(0.1);
    }),
  };
});

describe('vectorQuery', () => {
  let mockVectorStore: any;
  let originalVectorStore: any;

  beforeEach(() => {
    // Save original
    originalVectorStore = vectorStoreModule.vectorStore;

    // Create mock with sample results
    mockVectorStore = {
      query: vi.fn(async () => [
        {
          id: 'item-1',
          text: 'First matching item',
          score: 0.85,
          metadata: {
            id: 'item-1',
            text: 'First matching item',
            type: 'decision',
            source: 'SUMMARY.md',
            tags: ['typescript'],
            timestamp: '2026-01-01T00:00:00Z',
          },
        },
        {
          id: 'item-2',
          text: 'Second matching item',
          score: 0.72,
          metadata: {
            id: 'item-2',
            text: 'Second matching item',
            type: 'pattern',
            source: 'RESEARCH.md',
            tags: ['architecture'],
            timestamp: '2026-01-02T00:00:00Z',
          },
        },
      ]),
    };

    // Replace the singleton
    Object.defineProperty(vectorStoreModule, 'vectorStore', {
      value: mockVectorStore,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original
    Object.defineProperty(vectorStoreModule, 'vectorStore', {
      value: originalVectorStore,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('should query vector store with defaults', async () => {
    const results = await vectorQuery({
      project: 'test-project',
      query: 'test query',
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('item-1');
    expect(results[0].text).toBe('First matching item');
    expect(results[0].score).toBe(0.85);
    expect(results[0].type).toBe('decision');
    expect(results[0].source).toBe('SUMMARY.md');
    expect(results[0].tags).toEqual(['typescript']);
    expect(results[0].timestamp).toBe('2026-01-01T00:00:00Z');

    // Verify embedding was generated
    expect(transformer.generateEmbedding).toHaveBeenCalledWith('test query');

    // Verify vector store query was called with defaults
    expect(mockVectorStore.query).toHaveBeenCalledOnce();
    const queryCall = mockVectorStore.query.mock.calls[0][0];
    expect(queryCall.projectId).toBe('test-project');
    expect(queryCall.vector).toHaveLength(384);
    expect(queryCall.topK).toBe(5);
    expect(queryCall.minScore).toBe(0.0);
  });

  it('should respect topK and minScore parameters', async () => {
    await vectorQuery({
      project: 'test-project',
      query: 'test query',
      topK: 10,
      minScore: 0.5,
    });

    const queryCall = mockVectorStore.query.mock.calls[0][0];
    expect(queryCall.topK).toBe(10);
    expect(queryCall.minScore).toBe(0.5);
  });

  it('should filter results by type', async () => {
    const results = await vectorQuery({
      project: 'test-project',
      query: 'test query',
      type: 'decision',
    });

    // Should only return items matching the type filter
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('decision');
  });

  it('should return empty array when no results match type filter', async () => {
    const results = await vectorQuery({
      project: 'test-project',
      query: 'test query',
      type: 'pitfall',
    });

    expect(results).toHaveLength(0);
  });

  it('should handle empty results from vector store', async () => {
    mockVectorStore.query = vi.fn(async () => []);

    const results = await vectorQuery({
      project: 'test-project',
      query: 'test query',
    });

    expect(results).toHaveLength(0);
  });

  it('should preserve metadata in results', async () => {
    const results = await vectorQuery({
      project: 'test-project',
      query: 'test query',
    });

    expect(results[0].metadata).toBeTruthy();
    expect(results[0].metadata?.type).toBe('decision');
    expect(results[0].metadata?.source).toBe('SUMMARY.md');
    expect(results[0].metadata?.timestamp).toBe('2026-01-01T00:00:00Z');
  });

  it('should query different projects separately', async () => {
    await vectorQuery({
      project: 'project-a',
      query: 'query for project A',
    });

    await vectorQuery({
      project: 'project-b',
      query: 'query for project B',
    });

    expect(mockVectorStore.query).toHaveBeenCalledTimes(2);
    expect(mockVectorStore.query.mock.calls[0][0].projectId).toBe('project-a');
    expect(mockVectorStore.query.mock.calls[1][0].projectId).toBe('project-b');
  });
});
