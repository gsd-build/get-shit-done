import { getAllProjects } from '../registry.js';
import { extractResearch, type Pitfall } from '../extractors/research.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface PitfallResult extends Pitfall {
  project: string;
  phase?: string;
  domain: string;
  source: string;
}

export interface PitfallOptions {
  query?: string;
  project?: string;
  domain?: string;
  limit?: number;
}

/**
 * Search for pitfalls documented across all registered GSD projects
 */
export async function findPitfalls(options: PitfallOptions): Promise<PitfallResult[]> {
  const projects = options.project
    ? getAllProjects().filter(p => p.name === options.project)
    : getAllProjects();

  const allPitfalls: PitfallResult[] = [];

  for (const project of projects) {
    const planningPath = join(project.path, '.planning');
    if (!existsSync(planningPath)) continue;

    // Find all RESEARCH.md files
    const researchFiles = findResearchFiles(planningPath);

    for (const file of researchFiles) {
      try {
        const content = readFileSync(file, 'utf-8');
        const researchData = extractResearch(content);

        // Extract phase from path if present
        const phaseMatch = file.match(/phases\/(\d+-[^/]+)/);
        const phase = phaseMatch ? phaseMatch[1] : undefined;

        for (const pitfall of researchData.pitfalls) {
          allPitfalls.push({
            ...pitfall,
            project: project.name,
            phase,
            domain: researchData.domain,
            source: file
          });
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  }

  // Filter by query if provided
  let filtered = allPitfalls;
  if (options.query) {
    const query = options.query.toLowerCase();
    filtered = allPitfalls.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.prevention.toLowerCase().includes(query)
    );
  }

  // Filter by domain if provided
  if (options.domain) {
    const domain = options.domain.toLowerCase();
    filtered = filtered.filter(p =>
      p.domain.toLowerCase().includes(domain)
    );
  }

  // Apply limit
  const limit = options.limit || 50;
  return filtered.slice(0, limit);
}

/**
 * Recursively find all RESEARCH.md files
 */
function findResearchFiles(dir: string, files: string[] = []): string[] {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.')) {
          findResearchFiles(fullPath, files);
        } else if (entry.toUpperCase().includes('RESEARCH') && entry.endsWith('.md')) {
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
