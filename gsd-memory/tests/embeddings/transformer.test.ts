import { describe, it, expect } from 'vitest';
import { generateEmbedding, generateEmbeddings, EMBEDDING_DIMENSIONS } from '../../src/embeddings/transformer.js';

describe('Embeddings - Transformer', () => {
  it('should generate embedding of correct dimension', async () => {
    const embedding = await generateEmbedding('hello world');

    expect(embedding).toBeInstanceOf(Array);
    expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
  }, 30000); // Allow time for model download on first run

  it('should generate embeddings with normalized values', async () => {
    const embedding = await generateEmbedding('test text');

    // All values should be numbers between -1 and 1 (normalized)
    for (const value of embedding) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThanOrEqual(1);
    }
  }, 30000);

  it('should generate embeddings for multiple texts', async () => {
    const texts = ['first text', 'second text', 'third text'];
    const embeddings = await generateEmbeddings(texts);

    expect(embeddings).toHaveLength(3);
    for (const embedding of embeddings) {
      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
    }
  }, 30000);

  it('should generate similar embeddings for similar texts', async () => {
    const text1 = 'The quick brown fox jumps over the lazy dog';
    const text2 = 'A fast brown fox leaps over a sleepy dog';

    const [emb1, emb2] = await generateEmbeddings([text1, text2]);

    // Calculate cosine similarity
    const dotProduct = emb1.reduce((sum, val, i) => sum + val * emb2[i], 0);
    const magnitude1 = Math.sqrt(emb1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(emb2.reduce((sum, val) => sum + val * val, 0));
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    // Similar texts should have high cosine similarity (> 0.5)
    expect(cosineSimilarity).toBeGreaterThan(0.5);
  }, 30000);

  it('should generate different embeddings for different texts', async () => {
    const text1 = 'Machine learning is a subset of artificial intelligence';
    const text2 = 'Pizza is a traditional Italian dish';

    const [emb1, emb2] = await generateEmbeddings([text1, text2]);

    // Calculate cosine similarity
    const dotProduct = emb1.reduce((sum, val, i) => sum + val * emb2[i], 0);
    const magnitude1 = Math.sqrt(emb1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(emb2.reduce((sum, val) => sum + val * val, 0));
    const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

    // Unrelated texts should have lower cosine similarity
    expect(cosineSimilarity).toBeLessThan(0.5);
  }, 30000);
});
