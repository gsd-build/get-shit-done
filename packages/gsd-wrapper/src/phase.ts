/**
 * Async wrapper for gsd-tools phases command
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
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

  if (!result.success) {
    const fallback = await listPhasesFromFilesystem(cwd);
    if (fallback.success) {
      return fallback;
    }
    return result;
  }

  return {
    success: true,
    data: parsePhaseDirectories(result.data.directories),
  };
}

async function listPhasesFromFilesystem(cwd: string): Promise<GsdResult<Phase[]>> {
  try {
    const phasesDir = join(cwd, '.planning', 'phases');
    const entries = await readdir(phasesDir, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    return { success: true, data: parsePhaseDirectories(directories) };
  } catch {
    // Missing .planning/phases or unreadable directory: treat as no phases.
    return { success: true, data: [] };
  }
}

function parsePhaseDirectories(directories: string[]): Phase[] {
  return directories.map((dir) => {
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
      status: 'pending' as const,
      plans: 0,
      completedPlans: 0,
      directory: dir,
    };
  });
}
