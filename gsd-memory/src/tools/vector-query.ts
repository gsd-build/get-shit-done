/**
 * Vector query tool for semantic knowledge search
 *
 * Accepts query text, generates embedding, and searches for similar stored items.
 */

import { generateEmbedding } from '../embeddings/transformer.js';
import { vectorStore } from '../knowledge/vector-store.js';

export interface VectorQueryOptions {
  /** Project identifier for index isolation */
  project: string;
  /** Query text to search for */
  query: string;
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.0) */
  minScore?: number;
  /** Optional: filter by knowledge type */
  type?: string;
}

export interface VectorQueryResult {
  /** Item identifier */
  id: string;
  /** Item text content */
  text: string;
  /** Similarity score */
  score: number;
  /** Knowledge type (if specified) */
  type?: string;
  /** Source reference */
  source?: string;
  /** Tags */
  tags?: string[];
  /** Timestamp when stored */
  timestamp?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Query vector store for semantically similar knowledge
 *
 * @param options - Query options including project, query text, and filters
 * @returns Array of similar items sorted by score (highest first)
 */
export async function vectorQuery(options: VectorQueryOptions): Promise<VectorQueryResult[]> {
  const { project, query, topK, minScore, type } = options;

  // Generate embedding from query
  const vector = await generateEmbedding(query);

  // Query vector store
  const results = await vectorStore.query({
    projectId: project,
    vector,
    topK: topK || 5,
    minScore: minScore ?? 0.0,
  });

  // Map results to output format and apply type filter if specified
  const mappedResults = results
    .filter(r => !type || r.metadata.type === type)
    .map(r => ({
      id: r.id,
      text: r.text,
      score: r.score,
      type: r.metadata.type as string | undefined,
      source: r.metadata.source as string | undefined,
      tags: r.metadata.tags as string[] | undefined,
      timestamp: r.metadata.timestamp as string | undefined,
      metadata: r.metadata,
    }));

  return mappedResults;
}
