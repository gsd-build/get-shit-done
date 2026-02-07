import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vectorAdd } from '../../src/tools/vector-add.js';
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

describe('vectorAdd', () => {
  let mockVectorStore: any;
  let originalVectorStore: any;

  beforeEach(() => {
    // Save original
    originalVectorStore = vectorStoreModule.vectorStore;

    // Create mock
    mockVectorStore = {
      add: vi.fn(async () => ({ success: true })),
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

  it('should add knowledge with minimal options', async () => {
    const result = await vectorAdd({
      project: 'test-project',
      text: 'Test knowledge item',
    });

    expect(result.success).toBe(true);
    expect(result.project).toBe('test-project');
    expect(result.dimensions).toBe(384);
    expect(result.id).toBeTruthy();
    expect(typeof result.id).toBe('string');

    // Verify embedding was generated
    expect(transformer.generateEmbedding).toHaveBeenCalledWith('Test knowledge item');

    // Verify vector store add was called
    expect(mockVectorStore.add).toHaveBeenCalledOnce();
    const addCall = mockVectorStore.add.mock.calls[0][0];
    expect(addCall.projectId).toBe('test-project');
    expect(addCall.text).toBe('Test knowledge item');
    expect(addCall.vector).toHaveLength(384);
    expect(addCall.metadata.timestamp).toBeTruthy();
  });

  it('should add knowledge with full metadata', async () => {
    const result = await vectorAdd({
      project: 'test-project',
      text: 'Decision: use TypeScript for type safety',
      type: 'decision',
      source: '.planning/phases/01/SUMMARY.md',
      tags: ['typescript', 'tooling'],
      metadata: { phase: '01', custom: 'value' },
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeTruthy();

    // Verify metadata was passed through
    expect(mockVectorStore.add).toHaveBeenCalledOnce();
    const addCall = mockVectorStore.add.mock.calls[0][0];
    expect(addCall.metadata.type).toBe('decision');
    expect(addCall.metadata.source).toBe('.planning/phases/01/SUMMARY.md');
    expect(addCall.metadata.tags).toEqual(['typescript', 'tooling']);
    expect(addCall.metadata.phase).toBe('01');
    expect(addCall.metadata.custom).toBe('value');
    expect(addCall.metadata.timestamp).toBeTruthy();
  });

  it('should generate unique IDs for multiple items', async () => {
    const result1 = await vectorAdd({
      project: 'test-project',
      text: 'First item',
    });

    const result2 = await vectorAdd({
      project: 'test-project',
      text: 'Second item',
    });

    expect(result1.id).not.toBe(result2.id);
  });

  it('should handle different projects separately', async () => {
    await vectorAdd({
      project: 'project-a',
      text: 'Item in project A',
    });

    await vectorAdd({
      project: 'project-b',
      text: 'Item in project B',
    });

    expect(mockVectorStore.add).toHaveBeenCalledTimes(2);
    expect(mockVectorStore.add.mock.calls[0][0].projectId).toBe('project-a');
    expect(mockVectorStore.add.mock.calls[1][0].projectId).toBe('project-b');
  });
});
