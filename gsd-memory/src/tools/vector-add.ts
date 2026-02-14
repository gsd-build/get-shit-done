/**
 * Vector add tool for storing knowledge with embeddings
 *
 * Accepts text and metadata, generates embedding, and stores in vector database.
 */

import { generateEmbedding } from '../embeddings/transformer.js';
import { vectorStore } from '../knowledge/vector-store.js';
import { randomUUID } from 'crypto';
import { EMBEDDING_DIMENSIONS } from '../embeddings/transformer.js';

export interface VectorAddOptions {
  /** Project identifier for index isolation */
  project: string;
  /** Text content to store */
  text: string;
  /** Optional: type of knowledge (e.g., 'decision', 'pattern', 'pitfall') */
  type?: string;
  /** Optional: source reference (file path, URL, etc.) */
  source?: string;
  /** Optional: tags for categorization */
  tags?: string[];
  /** Optional: additional metadata */
  metadata?: Record<string, unknown>;
}

export interface VectorAddResult {
  /** Success indicator */
  success: boolean;
  /** Generated ID for the stored item */
  id: string;
  /** Project identifier */
  project: string;
  /** Embedding dimensions (always 384) */
  dimensions: number;
}

/**
 * Add knowledge to vector store with auto-generated embedding
 *
 * @param options - Add options including project, text, and optional metadata
 * @returns Result with success status, generated ID, and dimensions
 */
export async function vectorAdd(options: VectorAddOptions): Promise<VectorAddResult> {
  const { project, text, type, source, tags, metadata } = options;

  // Generate embedding from text
  const vector = await generateEmbedding(text);

  // Generate unique ID
  const id = randomUUID();

  // Prepare metadata
  const fullMetadata: Record<string, unknown> = {
    type,
    source,
    tags,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  // Store in vector database
  await vectorStore.add({
    projectId: project,
    id,
    text,
    vector,
    metadata: fullMetadata,
  });

  return {
    success: true,
    id,
    project,
    dimensions: EMBEDDING_DIMENSIONS,
  };
}
