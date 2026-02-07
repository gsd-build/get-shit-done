/**
 * Vector store wrapper for Vectra LocalIndex
 *
 * Provides persistent file-based vector storage with per-project isolation.
 * Uses Vectra's LocalIndex for efficient vector similarity search.
 */

import { LocalIndex } from 'vectra';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Default base directory for knowledge base storage
 */
const KNOWLEDGE_BASE_DIR = join(homedir(), '.gsd', 'knowledge');

/**
 * Options for adding items to the vector store
 */
export interface AddOptions {
  /** Project identifier for index isolation */
  projectId: string;
  /** Unique identifier for the item */
  id: string;
  /** Text content of the item */
  text: string;
  /** Embedding vector */
  vector: number[];
  /** Optional additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for querying the vector store
 */
export interface QueryOptions {
  /** Project identifier for index isolation */
  projectId: string;
  /** Query vector for similarity search */
  vector: number[];
  /** Number of results to return (default: 5) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.0) */
  minScore?: number;
}

/**
 * Result from a vector similarity query
 */
export interface QueryResult {
  /** Item identifier */
  id: string;
  /** Item text content */
  text: string;
  /** Similarity score */
  score: number;
  /** Item metadata */
  metadata: Record<string, unknown>;
}

/**
 * Vector store for persistent vector storage and similarity search
 *
 * Maintains per-project indices in the file system. Each project has its own
 * isolated index stored in ~/.gsd/knowledge/<projectId>/ by default.
 */
export class VectorStore {
  private indices: Map<string, LocalIndex> = new Map();
  private basePath: string;

  /**
   * Create a new VectorStore instance
   * @param basePath - Optional custom base path for storage (default: ~/.gsd/knowledge)
   */
  constructor(basePath?: string) {
    this.basePath = basePath || KNOWLEDGE_BASE_DIR;
  }

  /**
   * Get or create a LocalIndex for a project
   * @param projectId - Project identifier
   * @returns LocalIndex instance for the project
   */
  async getIndex(projectId: string): Promise<LocalIndex> {
    if (this.indices.has(projectId)) {
      return this.indices.get(projectId)!;
    }

    const indexPath = join(this.basePath, projectId);
    const index = new LocalIndex(indexPath);

    if (!(await index.isIndexCreated())) {
      await index.createIndex();
    }

    this.indices.set(projectId, index);
    return index;
  }

  /**
   * Add an item to the vector store
   * @param options - Add options including projectId, id, text, vector, and metadata
   * @returns Success indicator
   */
  async add(options: AddOptions): Promise<{ success: boolean }> {
    const index = await this.getIndex(options.projectId);

    await index.insertItem({
      vector: options.vector,
      metadata: {
        id: options.id,
        text: options.text,
        ...options.metadata,
      },
    });

    return { success: true };
  }

  /**
   * Query the vector store for similar items
   * @param options - Query options including projectId, vector, topK, and minScore
   * @returns Array of similar items sorted by score (highest first)
   */
  async query(options: QueryOptions): Promise<QueryResult[]> {
    const index = await this.getIndex(options.projectId);

    if (!(await index.isIndexCreated())) {
      return [];
    }

    // Vectra 0.12.3 requires a query string for BM25 search
    // We pass empty string since we're only doing vector similarity
    const results = await index.queryItems(
      options.vector,
      '', // Empty query string (BM25 not used)
      options.topK || 5
    );

    const minScore = options.minScore ?? 0.0;

    return results
      .filter(r => r.score >= minScore)
      .map(r => ({
        id: r.item.metadata.id as string,
        text: r.item.metadata.text as string,
        score: r.score,
        metadata: r.item.metadata as Record<string, unknown>,
      }));
  }
}

/**
 * Default singleton instance for convenience
 */
export const vectorStore = new VectorStore();
