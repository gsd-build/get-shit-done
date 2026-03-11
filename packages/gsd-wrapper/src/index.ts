/**
 * @gsd/gsd-wrapper - Async TypeScript wrappers for GSD CLI commands
 *
 * This package provides typed async functions that wrap the synchronous
 * gsd-tools.cjs CLI, enabling non-blocking calls with full type safety.
 */

// Re-export all types
export type {
  HealthReport,
  HealthCheck,
  ProjectState,
  Phase,
  Project,
  GsdError,
  GsdResult,
} from './types.js';

// Placeholder exports - will be implemented in Task 2
// export { getHealth } from './health.js';
// export { getState } from './state.js';
// export { listPhases } from './phase.js';
// export { discoverProjects } from './project.js';
