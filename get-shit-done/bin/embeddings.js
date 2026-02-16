/**
 * Local embedding generation using transformers.js with Nomic Embed model
 * Provides offline semantic similarity without API dependencies or costs
 */

let embeddingPipeline = null;

/**
 * Initialize embedding pipeline with lazy loading
 * @returns {Promise<Object>} The embedding pipeline
 */
async function initEmbeddings() {
  if (embeddingPipeline) return embeddingPipeline;

  const { pipeline, env } = require('@xenova/transformers');
  env.allowLocalModels = true;
  env.allowRemoteModels = true;

  embeddingPipeline = await pipeline(
    'feature-extraction',
    'nomic-ai/nomic-embed-text-v1.5',
    { quantized: true }
  );

  return embeddingPipeline;
}

/**
 * Generate embedding for text (512 dimensions with Matryoshka)
 * @param {string} text - Text to embed
 * @returns {Promise<Float32Array|null>} 512-dim embedding or null on error
 */
async function generateEmbedding(text) {
  try {
    const pipe = await initEmbeddings();
    const output = await pipe(text, {
      pooling: 'mean',
      normalize: true  // L2 normalization
    });

    // Extract as Float32Array, truncate to 512 dims
    let embedding = output.data;
    if (embedding.length > 512) {
      embedding = new Float32Array(embedding.slice(0, 512));
    }

    return embedding;
  } catch (err) {
    console.warn('Embedding generation failed:', err.message);
    return null;  // Graceful degradation
  }
}

/**
 * Check if embeddings are available
 * @returns {Promise<Object>} Availability status with optional reason
 */
async function isEmbeddingsAvailable() {
  try {
    await initEmbeddings();
    return { available: true };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

/**
 * Generate embeddings for multiple texts in batches
 * @param {string[]} texts - Array of texts to embed
 * @returns {Promise<Array<Float32Array|null>>} Array of 512-dim embeddings
 */
async function generateEmbeddingBatch(texts) {
  if (!texts || texts.length === 0) return [];

  try {
    const pipe = await initEmbeddings();
    const results = [];

    // Process in batches of 10 to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      for (const text of batch) {
        const output = await pipe(text, {
          pooling: 'mean',
          normalize: true
        });

        let embedding = output.data;
        if (embedding.length > 512) {
          embedding = new Float32Array(embedding.slice(0, 512));
        }
        results.push(embedding);
      }
    }

    return results;
  } catch (err) {
    console.warn('Batch embedding failed:', err.message);
    return texts.map(() => null);
  }
}

// Simple in-memory cache for repeated queries
const embeddingCache = new Map();
const CACHE_MAX_SIZE = 1000;

/**
 * Generate embedding with caching for repeated text
 * @param {string} text - Text to embed
 * @returns {Promise<Float32Array|null>} Cached or newly generated 512-dim embedding
 */
async function generateEmbeddingCached(text) {
  if (embeddingCache.has(text)) {
    return embeddingCache.get(text);
  }

  const embedding = await generateEmbedding(text);

  if (embedding && embeddingCache.size < CACHE_MAX_SIZE) {
    embeddingCache.set(text, embedding);
  }

  return embedding;
}

/**
 * Clear the embedding cache
 */
function clearEmbeddingCache() {
  embeddingCache.clear();
}

module.exports = {
  generateEmbedding,
  initEmbeddings,
  isEmbeddingsAvailable,
  generateEmbeddingBatch,
  generateEmbeddingCached,
  clearEmbeddingCache
};
