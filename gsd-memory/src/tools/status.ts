import { getAllProjects } from '../registry.js';
import { qmd } from '../qmd.js';
import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export interface ProjectStatus {
  name: string;
  path: string;
  exists: boolean;
  hasPlanningDir: boolean;
  qmdCollection?: string;
  qmdAvailable: boolean;
  documentCount: number;
  registeredAt: string;
  lastIndexed?: string;
}

export interface MemoryStatus {
  qmdAvailable: boolean;
  qmdVersion?: string;
  totalProjects: number;
  totalDocuments: number;
  projects: ProjectStatus[];
}

/**
 * Get comprehensive status of GSD memory system
 */
export async function getStatus(): Promise<MemoryStatus> {
  const qmdAvailable = await qmd.isAvailable();
  const projects = getAllProjects();

  let totalDocuments = 0;
  const projectStatuses: ProjectStatus[] = [];

  for (const project of projects) {
    const planningPath = join(project.path, '.planning');
    const exists = existsSync(project.path);
    const hasPlanningDir = existsSync(planningPath);

    // Count documents in .planning directory
    const documentCount = hasPlanningDir ? countMarkdownFiles(planningPath) : 0;
    totalDocuments += documentCount;

    projectStatuses.push({
      name: project.name,
      path: project.path,
      exists,
      hasPlanningDir,
      qmdCollection: project.qmdCollection,
      qmdAvailable: qmdAvailable && !!project.qmdCollection,
      documentCount,
      registeredAt: project.registeredAt,
      lastIndexed: project.lastIndexed
    });
  }

  return {
    qmdAvailable,
    totalProjects: projects.length,
    totalDocuments,
    projects: projectStatuses
  };
}

/**
 * Count markdown files in a directory recursively
 */
function countMarkdownFiles(dir: string): number {
  let count = 0;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory() && !entry.startsWith('.')) {
          count += countMarkdownFiles(fullPath);
        } else if (stat.isFile() && entry.endsWith('.md')) {
          count++;
        }
      } catch {
        // Skip entries that can't be accessed
      }
    }
  } catch {
    // Return 0 if directory can't be read
  }

  return count;
}
