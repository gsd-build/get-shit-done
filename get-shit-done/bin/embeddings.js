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

module.exports = {
  generateEmbedding,
  initEmbeddings,
  isEmbeddingsAvailable
};
