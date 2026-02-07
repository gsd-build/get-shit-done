import { getAllProjects } from '../registry.js';
import { extractSummary, type SummaryData } from '../extractors/summary.js';
import { extractProject, type ProjectData } from '../extractors/project.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface DecisionResult {
  decision: string;
  rationale?: string;
  project: string;
  phase?: string;
  source: string;
  date?: string;
  tags?: string[];
}

export interface DecisionOptions {
  query?: string;
  project?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Search for decisions across all registered GSD projects
 */
export async function findDecisions(options: DecisionOptions): Promise<DecisionResult[]> {
  const projects = options.project
    ? getAllProjects().filter(p => p.name === options.project)
    : getAllProjects();

  const allDecisions: DecisionResult[] = [];

  for (const project of projects) {
    const planningPath = join(project.path, '.planning');
    if (!existsSync(planningPath)) continue;

    // Extract decisions from PROJECT.md
    const projectDecisions = extractProjectDecisions(planningPath, project.name);
    allDecisions.push(...projectDecisions);

    // Extract decisions from all SUMMARY.md files
    const summaryDecisions = extractSummaryDecisions(planningPath, project.name);
    allDecisions.push(...summaryDecisions);
  }

  // Filter by query if provided
  let filtered = allDecisions;
  if (options.query) {
    const query = options.query.toLowerCase();
    filtered = allDecisions.filter(d =>
      d.decision.toLowerCase().includes(query) ||
      d.rationale?.toLowerCase().includes(query)
    );
  }

  // Filter by tags if provided
  if (options.tags && options.tags.length > 0) {
    const tags = options.tags.map(t => t.toLowerCase());
    filtered = filtered.filter(d =>
      d.tags?.some(t => tags.includes(t.toLowerCase()))
    );
  }

  // Apply limit
  const limit = options.limit || 50;
  return filtered.slice(0, limit);
}

/**
 * Extract decisions from PROJECT.md
 */
function extractProjectDecisions(planningPath: string, projectName: string): DecisionResult[] {
  const projectPath = join(planningPath, 'PROJECT.md');
  if (!existsSync(projectPath)) return [];

  try {
    const content = readFileSync(projectPath, 'utf-8');
    const projectData = extractProject(content);

    return projectData.decisions.map(d => ({
      decision: d.decision,
      rationale: d.rationale,
      project: projectName,
      source: projectPath
    }));
  } catch {
    return [];
  }
}

/**
 * Extract decisions from all SUMMARY.md files in a project
 */
function extractSummaryDecisions(planningPath: string, projectName: string): DecisionResult[] {
  const decisions: DecisionResult[] = [];
  const phasesPath = join(planningPath, 'phases');

  if (!existsSync(phasesPath)) return decisions;

  // Find all SUMMARY.md files
  const summaryFiles = findSummaryFiles(phasesPath);

  for (const file of summaryFiles) {
    try {
      const content = readFileSync(file, 'utf-8');
      const summaryData = extractSummary(content);

      for (const decision of summaryData.decisions) {
        decisions.push({
          decision: decision.decision,
          project: projectName,
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

  return decisions;
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
