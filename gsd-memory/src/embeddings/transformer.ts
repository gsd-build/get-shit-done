/**
 * Local embedding generation using Hugging Face Transformers.js
 *
 * This module provides local embedding generation without requiring API keys.
 * Uses the Xenova/all-MiniLM-L6-v2 model which produces 384-dimensional embeddings.
 */

/**
 * Dimension of the embedding vectors produced by the model
 */
export const EMBEDDING_DIMENSIONS = 384;

/**
 * Lazy-loaded singleton pipeline to avoid re-initialization
 */
let extractor: any = null;

/**
 * Get or initialize the feature extraction pipeline
 * @returns Initialized pipeline for feature extraction
 */
async function getExtractor() {
  if (!extractor) {
    const { pipeline } = await import('@huggingface/transformers');
    extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'fp32',
    } as any);
  }
  return extractor;
}

/**
 * Generate embedding vector for a single text
 * @param text - Input text to embed
 * @returns Normalized embedding vector of length 384
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const ext = await getExtractor();
  const result = await ext(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

/**
 * Generate embedding vectors for multiple texts
 * @param texts - Array of input texts to embed
 * @returns Array of normalized embedding vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return Promise.all(texts.map(t => generateEmbedding(t)));
}
