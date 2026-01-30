/**
 * Environment validation - file/directory existence checks
 */

import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Check if a path exists (file or directory)
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if .planning directory exists
 */
export async function planningExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning'));
}

/**
 * Check if .planning/PROJECT.md exists
 */
export async function projectExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'PROJECT.md'));
}

/**
 * Check if .planning/ROADMAP.md exists
 */
export async function roadmapExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'ROADMAP.md'));
}

/**
 * Check if .planning/STATE.md exists
 */
export async function stateExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'STATE.md'));
}

/**
 * Check if .planning/config.json exists
 */
export async function configExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'config.json'));
}

/**
 * Check if .git directory or file exists (bare repos use file)
 */
export async function gitRepoExists(basePath: string = process.cwd()): Promise<boolean> {
  const gitDir = path.join(basePath, '.git');
  return exists(gitDir);
}

/**
 * Check if phases directory exists
 */
export async function phasesDirectoryExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'phases'));
}

/**
 * Check if quick tasks directory exists
 */
export async function quickDirectoryExists(basePath: string = process.cwd()): Promise<boolean> {
  return exists(path.join(basePath, '.planning', 'quick'));
}

/**
 * Check if a specific phase directory exists
 * Returns the full path if found, null otherwise
 */
export async function phaseDirectoryExists(
  phase: string,
  basePath: string = process.cwd()
): Promise<string | null> {
  const phasesDir = path.join(basePath, '.planning', 'phases');

  try {
    const entries = await fs.readdir(phasesDir);
    const normalized = phase.padStart(2, '0');

    for (const entry of entries) {
      if (entry.startsWith(`${normalized}-`)) {
        const fullPath = path.join(phasesDir, entry);
        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          return fullPath;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
