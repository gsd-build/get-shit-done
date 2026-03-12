/**
 * Async wrapper for gsd-tools phases command
 */
import { execGsdTools } from './exec.js';
/**
 * List all phases for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Phase[] with parsed directory information
 */
export async function listPhases(cwd) {
    const result = await execGsdTools(['phases', 'list', '--json'], cwd);
    if (!result.success)
        return result;
    // Parse directory names into Phase objects
    const phases = result.data.directories.map((dir) => {
        // Directory format: NN-name or NN-name-slug
        const basename = dir.split('/').pop() || dir;
        const match = basename.match(/^(\d+(?:\.\d+)?)-(.+)$/);
        if (!match) {
            return {
                number: '0',
                name: basename,
                slug: basename,
                status: 'pending',
                plans: 0,
                completedPlans: 0,
                directory: dir,
            };
        }
        const [, number, rest] = match;
        return {
            number: number || '0',
            name: rest?.replace(/-/g, ' ') || '',
            slug: rest || '',
            status: 'pending', // Would need to read PLAN.md files for actual status
            plans: 0,
            completedPlans: 0,
            directory: dir,
        };
    });
    return { success: true, data: phases };
}
//# sourceMappingURL=phase.js.map