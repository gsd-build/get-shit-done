/**
 * Async wrapper for gsd-tools state command
 */
import { execGsdTools } from './exec.js';
/**
 * Parse progress info from STATE.md frontmatter
 */
function parseProgress(stateRaw) {
    // Look for progress section in YAML frontmatter
    const frontmatterMatch = stateRaw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
        return { total: 0, completed: 0 };
    }
    const frontmatter = frontmatterMatch[1];
    // Parse total_plans and completed_plans
    const totalMatch = frontmatter.match(/total_plans:\s*(\d+)/);
    const completedMatch = frontmatter.match(/completed_plans:\s*(\d+)/);
    return {
        total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
        completed: completedMatch ? parseInt(completedMatch[1], 10) : 0,
    };
}
/**
 * Parse current phase from STATE.md
 */
function parsePhase(stateRaw) {
    const match = stateRaw.match(/\*\*Phase:\*\*\s*(.+)/);
    return match ? match[1].trim() : '';
}
/**
 * Parse current plan from STATE.md
 */
function parsePlan(stateRaw) {
    const match = stateRaw.match(/\*\*Plan:\*\*\s*(.+)/);
    return match ? match[1].trim() : '';
}
/**
 * Parse status from STATE.md frontmatter
 */
function parseStatus(stateRaw) {
    const frontmatterMatch = stateRaw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch)
        return 'pending';
    const frontmatter = frontmatterMatch[1];
    const statusMatch = frontmatter.match(/status:\s*(\w+)/);
    if (!statusMatch)
        return 'pending';
    const status = statusMatch[1].toLowerCase();
    if (status === 'completed' || status === 'complete')
        return 'complete';
    if (status === 'active' || status === 'in_progress')
        return 'active';
    return 'pending';
}
/**
 * Parse milestone from STATE.md frontmatter
 */
function parseMilestone(stateRaw) {
    const frontmatterMatch = stateRaw.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch)
        return undefined;
    const frontmatter = frontmatterMatch[1];
    const milestoneMatch = frontmatter.match(/milestone:\s*(.+)/);
    return milestoneMatch ? milestoneMatch[1].trim() : undefined;
}
/**
 * Parse last activity from STATE.md
 */
function parseLastActivity(stateRaw) {
    const match = stateRaw.match(/\*\*Last activity:\*\*\s*(.+)/);
    return match ? match[1].trim() : undefined;
}
/**
 * Get current state for a GSD project
 *
 * @param cwd - Project directory path
 * @returns ProjectState with phase, plan, status, and progress
 */
export async function getState(cwd) {
    const result = await execGsdTools(['state', '--json'], cwd);
    if (!result.success)
        return result;
    const { state_raw } = result.data;
    const progress = parseProgress(state_raw);
    return {
        success: true,
        data: {
            phase: parsePhase(state_raw),
            plan: parsePlan(state_raw),
            status: parseStatus(state_raw),
            progress: {
                ...progress,
                percentage: progress.total > 0
                    ? Math.round((progress.completed / progress.total) * 100)
                    : 0,
            },
            lastActivity: parseLastActivity(state_raw),
            milestone: parseMilestone(state_raw),
        },
    };
}
/**
 * Get just the progress percentage for a GSD project
 *
 * @param cwd - Project directory path
 * @returns Progress percentage (0-100) or null on error
 */
export async function getProgress(cwd) {
    const result = await getState(cwd);
    if (!result.success)
        return null;
    return result.data.progress.percentage;
}
//# sourceMappingURL=state.js.map