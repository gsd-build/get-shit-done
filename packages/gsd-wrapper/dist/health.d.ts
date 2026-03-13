/**
 * Async wrapper for gsd-tools health command
 */
import type { HealthReport, GsdResult } from './types.js';
/**
 * Get health status for a GSD project
 *
 * @param cwd - Project directory path
 * @returns HealthReport with status, issues, and check details
 */
export declare function getHealth(cwd: string): Promise<GsdResult<HealthReport>>;
//# sourceMappingURL=health.d.ts.map