/**
 * Async wrapper for gsd-tools phases command
 */

import { execGsdTools } from './exec.js';
import type { Phase, GsdResult } from './types.js';

/**
 * Raw output structure from gsd-tools phases list --json
 */
interface RawPhasesOutput {
  directories: string[];
  count: number;
  milestone?: string;
}

/**
 * List all phases for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Phase[] with parsed directory information
 */
export async function listPhases(cwd: string): Promise<GsdResult<Phase[]>> {
  const result = await execGsdTools<RawPhasesOutput>(['phases', 'list', '--json'], cwd);

  if (!result.success) return result;

  // Parse directory names into Phase objects
  const phases: Phase[] = result.data.directories.map((dir) => {
    // Directory format: NN-name or NN-name-slug
    const basename = dir.split('/').pop() || dir;
    const match = basename.match(/^(\d+(?:\.\d+)?)-(.+)$/);

    if (!match) {
      return {
        number: '0',
        name: basename,
        slug: basename,
        status: 'pending' as const,
        plans: 0,
        completedPlans: 0,
        directory: dir,
      };
    }

    const [, number, rest] = match;
    return {
      number: number || '0',
      name: rest?.replace(/-/g, ' ') || '',
      slug: rest || '',
      status: 'pending' as const, // Would need to read PLAN.md files for actual status
      plans: 0,
      completedPlans: 0,
      directory: dir,
    };
  });

  return { success: true, data: phases };
}
