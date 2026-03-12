/**
 * Async wrapper for gsd-tools health command
 */
import { execGsdTools } from './exec.js';
/**
 * Get health status for a GSD project
 *
 * @param cwd - Project directory path
 * @returns HealthReport with status, issues, and check details
 */
export async function getHealth(cwd) {
    return execGsdTools(['health', 'check', '--json'], cwd);
}
//# sourceMappingURL=health.js.map