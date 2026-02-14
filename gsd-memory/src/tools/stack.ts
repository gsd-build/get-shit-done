import { getAllProjects } from '../registry.js';
import { extractSummary, type TechStackEntry } from '../extractors/summary.js';
import { extractResearch } from '../extractors/research.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface StackResult {
  library: string;
  version?: string;
  purpose?: string;
  project: string;
  phase?: string;
  source: string;
  sourceType: 'summary' | 'research';
}

export interface StackOptions {
  query?: string;
  project?: string;
  limit?: number;
}

/**
 * Search for tech stack entries across all registered GSD projects
 */
export async function findStack(options: StackOptions): Promise<StackResult[]> {
  const projects = options.project
    ? getAllProjects().filter(p => p.name === options.project)
    : getAllProjects();

  const allStack: StackResult[] = [];

  for (const project of projects) {
    const planningPath = join(project.path, '.planning');
    if (!existsSync(planningPath)) continue;

    // Extract from SUMMARY.md files
    const summaryStack = extractFromSummaries(planningPath, project.name);
    allStack.push(...summaryStack);

    // Extract from RESEARCH.md files
    const researchStack = extractFromResearch(planningPath, project.name);
    allStack.push(...researchStack);
  }

  // Filter by query if provided
  let filtered = allStack;
  if (options.query) {
    const query = options.query.toLowerCase();
    filtered = allStack.filter(s =>
      s.library.toLowerCase().includes(query) ||
      s.purpose?.toLowerCase().includes(query)
    );
  }

  // Deduplicate by library name within each project
  const seen = new Set<string>();
  const deduplicated = filtered.filter(s => {
    const key = `${s.project}:${s.library}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Apply limit
  const limit = options.limit || 100;
  return deduplicated.slice(0, limit);
}

/**
 * Extract tech stack from all SUMMARY.md files
 */
function extractFromSummaries(planningPath: string, projectName: string): StackResult[] {
  const stack: StackResult[] = [];
  const phasesPath = join(planningPath, 'phases');

  if (!existsSync(phasesPath)) return stack;

  const summaryFiles = findFiles(phasesPath, 'SUMMARY');

  for (const file of summaryFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const summaryData = extractSummary(content);

      // Extract phase from path
      const phaseMatch = file.match(/phases\/(\d+-[^/]+)/);
      const phase = phaseMatch ? phaseMatch[1] : undefined;

      for (const entry of summaryData.techStack) {
        stack.push({
          library: entry.library,
          version: entry.version,
          purpose: entry.purpose,
          project: projectName,
          phase,
          source: file,
          sourceType: 'summary'
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return stack;
}

/**
 * Extract tech stack from all RESEARCH.md files
 */
function extractFromResearch(planningPath: string, projectName: string): StackResult[] {
  const stack: StackResult[] = [];

  const researchFiles = findFiles(planningPath, 'RESEARCH');

  for (const file of researchFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const researchData = extractResearch(content);

      // Extract phase from path
      const phaseMatch = file.match(/phases\/(\d+-[^/]+)/);
      const phase = phaseMatch ? phaseMatch[1] : undefined;

      for (const entry of researchData.standardStack) {
        stack.push({
          library: entry.library,
          version: entry.version,
          purpose: entry.purpose,
          project: projectName,
          phase,
          source: file,
          sourceType: 'research'
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return stack;
}

/**
 * Recursively find files matching a pattern
 */
function findFiles(dir: string, pattern: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.')) {
          findFiles(fullPath, pattern, files);
        } else if (entry.toUpperCase().includes(pattern) && entry.endsWith('.md')) {
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
