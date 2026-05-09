/**
 * Workstream utility functions for multi-workstream project support.
 *
 * When --ws <name> is provided, all .planning/ paths are routed to
 * .planning/workstreams/<name>/ instead.
 */

import { posix } from 'node:path';
export { validateWorkstreamName, toWorkstreamSlug } from './workstream-name-policy.js';

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
