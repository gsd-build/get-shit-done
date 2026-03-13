/**
 * Async wrapper for gsd-tools phases command
 */
import { readdir } from 'fs/promises';
import { join } from 'path';
import { execGsdTools } from './exec.js';
/**
 * List all phases for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Phase[] with parsed directory information
 */
export async function listPhases(cwd) {
    const result = await execGsdTools(['phases', 'list', '--json'], cwd);
    if (!result.success) {
        const fallback = await listPhasesFromFilesystem(cwd);
        if (fallback.success) {
            return fallback;
        }
        return result;
    }
    return {
        success: true,
        data: parsePhaseDirectories(result.data.directories),
    };
}
async function listPhasesFromFilesystem(cwd) {
    try {
        const phasesDir = join(cwd, '.planning', 'phases');
        const entries = await readdir(phasesDir, { withFileTypes: true });
        const directories = entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
        return { success: true, data: parsePhaseDirectories(directories) };
    }
    catch {
        // Missing .planning/phases or unreadable directory: treat as no phases.
        return { success: true, data: [] };
    }
}
function parsePhaseDirectories(directories) {
    return directories.map((dir) => {
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
            status: 'pending',
            plans: 0,
            completedPlans: 0,
            directory: dir,
        };
    });
}
//# sourceMappingURL=phase.js.map