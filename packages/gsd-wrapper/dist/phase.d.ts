/**
 * Async wrapper for gsd-tools phases command
 */
import type { Phase, GsdResult } from './types.js';
/**
 * List all phases for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Phase[] with parsed directory information
 */
export declare function listPhases(cwd: string): Promise<GsdResult<Phase[]>>;
//# sourceMappingURL=phase.d.ts.map