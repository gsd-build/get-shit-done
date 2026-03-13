/**
 * Project discovery by scanning for .planning directories
 */
import type { Project, GsdResult } from './types.js';
/**
 * Discover GSD projects by scanning for .planning directories
 *
 * @param searchPaths - Array of directories to scan for projects
 * @returns Project[] with id, name, path, and hasPlanning flag
 */
export declare function discoverProjects(searchPaths: string[]): Promise<GsdResult<Project[]>>;
//# sourceMappingURL=project.d.ts.map