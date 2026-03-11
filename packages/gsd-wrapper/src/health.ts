/**
 * Async wrapper for gsd-tools health command
 */

import { execGsdTools } from './exec.js';
import type { HealthReport, GsdResult } from './types.js';

/**
 * Get health status for a GSD project
 *
 * @param cwd - Project directory path
 * @returns HealthReport with status, issues, and check details
 */
export async function getHealth(cwd: string): Promise<GsdResult<HealthReport>> {
  return execGsdTools<HealthReport>(['health', 'check', '--json'], cwd);
}
