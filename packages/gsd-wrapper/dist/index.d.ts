/**
 * @gsd/gsd-wrapper - Async TypeScript wrappers for GSD CLI commands
 *
 * This package provides typed async functions that wrap the synchronous
 * gsd-tools.cjs CLI, enabling non-blocking calls with full type safety.
 */
export type { HealthReport, HealthIssue, HealthSummary, ProjectState, Phase, Project, GsdError, GsdResult, } from './types.js';
export { getHealth } from './health.js';
export { getState, getProgress } from './state.js';
export { listPhases } from './phase.js';
export { discoverProjects } from './project.js';
//# sourceMappingURL=index.d.ts.map