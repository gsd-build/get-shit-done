/**
 * @gsd/gsd-wrapper - Type definitions for GSD wrapper functions
 *
 * These types represent the structured data returned by gsd-tools CLI commands.
 */

/**
 * Health check result from gsd-tools health
 */
export interface HealthCheck {
  passed: boolean;
  message?: string | undefined;
}

/**
 * Full health report from gsd-tools health --json
 */
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'error';
  issues: string[];
  checks: Record<string, HealthCheck>;
}

/**
 * Project state from gsd-tools state --json
 */
export interface ProjectState {
  phase: string;
  plan: string;
  status: 'pending' | 'active' | 'complete';
  progress: {
    total: number;
    completed: number;
    percentage: number;
  };
  lastActivity?: string | undefined;
  milestone?: string | undefined;
}

/**
 * Phase information from gsd-tools phases list
 */
export interface Phase {
  number: string;
  name: string;
  slug: string;
  status: 'pending' | 'active' | 'complete';
  plans: number;
  completedPlans: number;
  directory: string;
}

/**
 * Project discovered via filesystem scan
 */
export interface Project {
  id: string; // basename of path
  name: string;
  path: string;
  hasPlanning: boolean;
}

/**
 * Wrapper error structure
 */
export interface GsdError {
  code: string;
  message: string;
  command?: string | undefined;
  stderr?: string | undefined;
}

/**
 * Result type for all wrapper functions
 * Discriminated union for type-safe error handling
 */
export type GsdResult<T> =
  | { success: true; data: T }
  | { success: false; error: GsdError };
