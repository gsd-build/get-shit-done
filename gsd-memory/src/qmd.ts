import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const execAsync = promisify(exec);

export interface QmdSearchResult {
  content: string;
  source: string;
  relevance: number;
  context?: string;
}

export interface QmdSearchOptions {
  query: string;
  paths: string[];
  limit?: number;
  collection?: string;
}

export interface QmdCollectionOptions {
  name: string;
  paths: string[];
  context?: string;
}

export interface QmdResult {
  success: boolean;
  reason?: string;
  data?: unknown;
}

export interface QmdStatus {
  available: boolean;
  collection?: string;
  documentCount?: number;
  lastIndexed?: string;
}

/**
 * QMD wrapper - provides semantic search when QMD is available,
 * falls back to grep-based search otherwise
 */
export const qmd = {
  /**
   * Check if QMD is installed and available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('which qmd');
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Search for content using QMD or grep fallback
   */
  async search(options: QmdSearchOptions): Promise<QmdSearchResult[]> {
    const available = await this.isAvailable();

    if (available && options.collection) {
      return this.qmdSearch(options);
    }

    return this.grepFallback(options);
  },

  /**
   * Search using QMD (when available)
   */
  async qmdSearch(options: QmdSearchOptions): Promise<QmdSearchResult[]> {
    try {
      const limit = options.limit || 10;
      const { stdout } = await execAsync(
        `qmd query "${options.query}" --collection "${options.collection}" --limit ${limit} --json`
      );

      const parsed = JSON.parse(stdout);
      return (parsed.results || []).map((r: { content: string; source: string; score: number }) => ({
        content: r.content,
        source: r.source,
        relevance: r.score || 0.5,
        context: 'qmd'
      }));
    } catch {
      // Fall back to grep if QMD search fails
      return this.grepFallback(options);
    }
  },

  /**
   * Grep-based fallback search
   */
  async grepFallback(options: QmdSearchOptions): Promise<QmdSearchResult[]> {
    const results: QmdSearchResult[] = [];
    const limit = options.limit || 20;

    for (const searchPath of options.paths) {
      try {
        const files = this.findMarkdownFiles(searchPath);

        for (const file of files) {
          try {
            const content = readFileSync(file, 'utf-8');
            const query = options.query.toLowerCase();

            // Simple relevance: count matches
            const matches = (content.toLowerCase().match(new RegExp(query, 'g')) || []).length;

            if (matches > 0) {
              // Extract context around first match
              const lowerContent = content.toLowerCase();
              const matchIndex = lowerContent.indexOf(query);
              const start = Math.max(0, matchIndex - 100);
              const end = Math.min(content.length, matchIndex + query.length + 100);
              const snippet = content.slice(start, end);

              results.push({
                content: snippet,
                source: file,
                relevance: Math.min(1, matches * 0.1),
                context: 'grep'
              });
            }
          } catch {
            // Skip files that can't be read
          }
        }
      } catch {
        // Skip paths that can't be accessed
      }
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  },

  /**
   * Find all markdown files in a directory recursively
   */
  findMarkdownFiles(dir: string, files: string[] = []): string[] {
    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);

          if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
            this.findMarkdownFiles(fullPath, files);
          } else if (stat.isFile() && entry.endsWith('.md')) {
            files.push(fullPath);
          }
        } catch {
          // Skip entries that can't be accessed
        }
      }
    } catch {
      // Return empty if directory can't be read
    }

    return files;
  },

  /**
   * Create a QMD collection for a project
   */
  async createCollection(options: QmdCollectionOptions): Promise<QmdResult> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        success: false,
        reason: 'qmd_not_available'
      };
    }

    try {
      const paths = options.paths.join(' ');
      const contextArg = options.context ? `--context "${options.context}"` : '';

      await execAsync(
        `qmd add "${options.name}" ${paths} ${contextArg}`
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        reason: 'create_failed',
        data: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Trigger reindexing of a collection
   */
  async index(collectionName: string): Promise<QmdResult> {
    const available = await this.isAvailable();

    if (!available) {
      return {
        success: false,
        reason: 'qmd_not_available'
      };
    }

    try {
      await execAsync(`qmd update "${collectionName}"`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        reason: 'index_failed',
        data: error instanceof Error ? error.message : String(error)
      };
    }
  },

  /**
   * Get status of a collection
   */
  async status(collectionName: string): Promise<QmdStatus> {
    const available = await this.isAvailable();

    if (!available) {
      return { available: false };
    }

    try {
      const { stdout } = await execAsync(`qmd status "${collectionName}" --json`);
      const parsed = JSON.parse(stdout);

      return {
        available: true,
        collection: collectionName,
        documentCount: parsed.documentCount || 0,
        lastIndexed: parsed.lastIndexed
      };
    } catch {
      return {
        available: true,
        collection: collectionName,
        documentCount: 0
      };
    }
  }
};
