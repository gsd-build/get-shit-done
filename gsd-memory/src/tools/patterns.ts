import { getAllProjects } from '../registry.js';
import { extractSummary } from '../extractors/summary.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface PatternResult {
  pattern: string;
  project: string;
  phase: string;
  source: string;
  date?: string;
  tags?: string[];
}

export interface PatternOptions {
  query?: string;
  project?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Search for patterns established across all registered GSD projects
 */
export async function findPatterns(options: PatternOptions): Promise<PatternResult[]> {
  const projects = options.project
    ? getAllProjects().filter(p => p.name === options.project)
    : getAllProjects();

  const allPatterns: PatternResult[] = [];

  for (const project of projects) {
    const phasesPath = join(project.path, '.planning', 'phases');
    if (!existsSync(phasesPath)) continue;

    // Find all SUMMARY.md files and extract patterns
    const summaryFiles = findSummaryFiles(phasesPath);

    for (const file of summaryFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const summaryData = extractSummary(content);

        for (const pattern of summaryData.patterns) {
          allPatterns.push({
            pattern,
            project: project.name,
            phase: summaryData.phase,
            source: file,
            date: summaryData.completed,
            tags: summaryData.tags
          });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  }

  // Filter by query if provided
  let filtered = allPatterns;
  if (options.query) {
    const query = options.query.toLowerCase();
    filtered = allPatterns.filter(p =>
      p.pattern.toLowerCase().includes(query)
    );
  }

  // Filter by tags if provided
  if (options.tags && options.tags.length > 0) {
    const tags = options.tags.map(t => t.toLowerCase());
    filtered = filtered.filter(p =>
      p.tags?.some(t => tags.includes(t.toLowerCase()))
    );
  }

  // Apply limit
  const limit = options.limit || 50;
  return filtered.slice(0, limit);
}

/**
 * Recursively find all SUMMARY.md files
 */
function findSummaryFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          findSummaryFiles(fullPath, files);
        } else if (entry.toUpperCase().includes('SUMMARY') && entry.endsWith('.md')) {
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
}
