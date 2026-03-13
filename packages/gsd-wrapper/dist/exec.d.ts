/**
 * Shared subprocess execution utility for GSD CLI commands
 */
import type { GsdResult } from './types.js';
/**
 * Execute a gsd-tools command and parse JSON output
 *
 * Uses shell redirect to temp file to avoid Node.js process.exit() stdout
 * buffering issues when gsd-tools calls process.exit(0) immediately after
 * process.stdout.write().
 *
 * @param args - Command arguments to pass to gsd-tools
 * @param cwd - Working directory for the command
 * @returns Promise with typed result or error
 */
export declare function execGsdTools<T>(args: string[], cwd: string): Promise<GsdResult<T>>;
//# sourceMappingURL=exec.d.ts.map