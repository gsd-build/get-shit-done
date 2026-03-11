/**
 * @gsd/gsd-wrapper - Type definitions for GSD wrapper functions
 *
 * These types represent the structured data returned by gsd-tools CLI commands.
 */

/**
 * Health issue from gsd-tools health check
 */
export interface HealthIssue {
  type: string;
  phase: string | null;
  path: string | null;
  branch: string | null;
  age_days: number | null;
  suggested_action: string;
  repairable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Health report summary
 */
export interface HealthSummary {
  orphan_count: number;
  stale_lock_count: number;
  incomplete_count: number;
  sync_issue_count: number;
}

/**
 * Full health report from gsd-tools health check --json
 */
export interface HealthReport {
  status: 'healthy' | 'degraded' | 'error';
  issues: HealthIssue[];
  exit_code: number;
  summary: HealthSummary;
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
