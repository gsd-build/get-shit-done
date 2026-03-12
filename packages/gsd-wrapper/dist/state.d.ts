/**
 * Async wrapper for gsd-tools state command
 */
import type { ProjectState, GsdResult } from './types.js';
/**
 * Get current state for a GSD project
 *
 * @param cwd - Project directory path
 * @returns ProjectState with phase, plan, status, and progress
 */
export declare function getState(cwd: string): Promise<GsdResult<ProjectState>>;
/**
 * Get just the progress percentage for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Progress percentage (0-100) or null on error
 */
export declare function getProgress(cwd: string): Promise<number | null>;
//# sourceMappingURL=state.d.ts.map