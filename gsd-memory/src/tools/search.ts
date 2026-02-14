import { qmd, QmdSearchResult } from '../qmd.js';
import { getAllProjects } from '../registry.js';
import { extractFrontmatter } from '../extractors/frontmatter.js';
import { readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';

export interface SearchResult {
  content: string;
  source: string;
  project: string;
  phase?: string;
  relevance: number;
  documentType?: 'summary' | 'research' | 'project' | 'plan' | 'other';
}

export interface SearchOptions {
  query: string;
  project?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Search across all registered GSD projects
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const projects = options.project
    ? getAllProjects().filter(p => p.name === options.project)
    : getAllProjects();

  if (projects.length === 0) {
    return [];
  }

  const allResults: SearchResult[] = [];

  for (const project of projects) {
    const planningPath = join(project.path, '.planning');

    if (!existsSync(planningPath)) continue;

    // Search using QMD or grep fallback
    const searchResults = await qmd.search({
      query: options.query,
      paths: [planningPath],
      collection: project.qmdCollection,
      limit: options.limit || 20
    });

    // Enrich results with GSD context
    for (const result of searchResults) {
      const enriched = enrichResult(result, project.name);
      allResults.push(enriched);
    }
  }

  // Sort by relevance
  allResults.sort((a, b) => b.relevance - a.relevance);

  // Apply limit
  const limit = options.limit || 20;
  return allResults.slice(0, limit);
}

/**
 * Enrich a search result with GSD-specific context
 */
function enrichResult(result: QmdSearchResult, projectName: string): SearchResult {
  const enriched: SearchResult = {
    content: result.content,
    source: result.source,
    project: projectName,
    relevance: result.relevance,
    documentType: getDocumentType(result.source)
  };

  // Try to extract phase from frontmatter or path
  enriched.phase = extractPhase(result.source);

  return enriched;
}

/**
 * Determine document type from file path/name
 */
function getDocumentType(source: string): SearchResult['documentType'] {
  const filename = basename(source).toUpperCase();

  if (filename.includes('SUMMARY')) return 'summary';
  if (filename.includes('RESEARCH')) return 'research';
  if (filename.includes('PROJECT')) return 'project';
  if (filename.includes('PLAN')) return 'plan';

  return 'other';
}

/**
 * Extract phase identifier from file path or content
 */
function extractPhase(source: string): string | undefined {
  // Try to get from path: .planning/phases/01-foundation/...
  const pathMatch = source.match(/phases\/(\d+-[^/]+)/);
  if (pathMatch) return pathMatch[1];

  // Try to get from frontmatter
  try {
    if (existsSync(source)) {
      const content = readFileSync(source, 'utf-8');
      const frontmatter = extractFrontmatter(content);
      if (frontmatter.phase) return String(frontmatter.phase);
    }
  } catch {
    // Ignore errors reading file
  }

  return undefined;
}
