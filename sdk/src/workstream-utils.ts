/**
 * Workstream utility functions for multi-workstream project support.
 *
 * When --ws <name> is provided, all .planning/ paths are routed to
 * .planning/workstreams/<name>/ instead.
 */

import { posix } from 'node:path';
import { validateWorkstreamName } from './workstream-name-policy.js';
export { validateWorkstreamName, toWorkstreamSlug } from './workstream-name-policy.js';

/**
 * Return the relative planning directory path.
 *
 * - Without workstream: `.planning`
 * - With workstream: `.planning/workstreams/<name>`
 *
 * #3589 (security): validates the explicit workstream name against the
 * shared `validateWorkstreamName` policy before path construction. Path
 * traversal segments (`..`, `/`, `\\`) and other invalid identifiers throw
 * synchronously, so every caller — direct SDK use, `planningPaths`,
 * `ContextEngine` — fails closed at the same seam. Env-sourced workstreams
 * are still pre-filtered to `null` by `planningPaths` (the #2791 silent
 * fallback contract), so this guard does NOT change env-sourced behaviour.
 */
export function relPlanningPath(workstream?: string): string {
  if (!workstream) return '.planning';
  if (!validateWorkstreamName(workstream)) {
    throw new Error(
      `Invalid workstream name: ${JSON.stringify(workstream)}. ` +
        `Workstream names must match /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/ and may not contain '..'.`,
    );
  }
  // Use POSIX segments so the same logical path string is used on all platforms (Windows included).
  return posix.join('.planning', 'workstreams', workstream);
}
