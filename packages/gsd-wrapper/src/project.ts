/**
 * Project discovery by scanning for .planning directories
 */

import { readdir, access, constants } from 'fs/promises';
import { join, basename } from 'path';
import type { Project, GsdResult } from './types.js';

/**
 * Discover GSD projects by scanning for .planning directories
 *
 * @param searchPaths - Array of directories to scan for projects
 * @returns Project[] with id, name, path, and hasPlanning flag
 */
export async function discoverProjects(
  searchPaths: string[]
): Promise<GsdResult<Project[]>> {
  const projects: Project[] = [];

  for (const searchPath of searchPaths) {
    try {
      const entries = await readdir(searchPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        // Skip hidden directories and common non-project directories
        if (entry.name.startsWith('.')) continue;
        if (entry.name === 'node_modules') continue;

        const projectPath = join(searchPath, entry.name);
        const planningPath = join(projectPath, '.planning');

        try {
          await access(planningPath, constants.R_OK);
          projects.push({
            id: entry.name,
            name: formatProjectName(entry.name),
            path: projectPath,
            hasPlanning: true,
          });
        } catch {
          // No .planning directory - not a GSD project
        }
      }
    } catch {
      // Search path not accessible - skip
    }
  }

  return { success: true, data: projects };
}

/**
 * Format a directory name into a human-readable project name
 */
function formatProjectName(dirName: string): string {
  return dirName
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
