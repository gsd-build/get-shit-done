/**
 * Workstream utility functions for multi-workstream project support.
 *
 * When --ws <name> is provided, all .planning/ paths are routed to
 * .planning/workstreams/<name>/ instead.
 */

import { posix } from 'node:path';

/**
 * Validate a workstream name.
 * Allowed: alphanumeric, hyphens, underscores, dots.
 * Disallowed: empty, spaces, slashes, special chars, path traversal.
 */
export function validateWorkstreamName(name: string): boolean {
  if (!name || name.length === 0) return false;
  // Only allow alphanumeric, hyphens, underscores, dots
  // Must not be ".." or start with ".." (path traversal)
  if (name === '..' || name.startsWith('../')) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name);
}

/**
 * Return the relative planning directory path.
 *
 * - Without workstream: `.planning`
 * - With workstream: `.planning/workstreams/<name>`
 */
export function relPlanningPath(workstream?: string): string {
  if (!workstream) return '.planning';
  // Use POSIX segments so the same logical path string is used on all platforms (Windows included).
  return posix.join('.planning', 'workstreams', workstream);
}
