/**
 * Frontend types matching backend API types from Phase 14.
 *
 * These types are used throughout the dashboard components and hooks.
 */

/** Health status values matching backend */
export type HealthStatus = 'healthy' | 'degraded' | 'error';

/** Project status values matching backend */
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'unknown';

/** Health information for a project */
export interface ProjectHealth {
  status: HealthStatus;
  issues: string[];
  lastCheck?: string;
}

/** Progress information for a project */
export interface ProjectProgress {
  completedPhases: number;
  totalPhases: number;
  completedPlans: number;
  totalPlans: number;
  percentage: number;
}

/** Project entity matching backend schema */
export interface Project {
  id: string;
  name: string;
  path: string;
  status: ProjectStatus;
  health: ProjectHealth;
  currentPhase: string | null;
  progress: ProjectProgress;
  lastActivity?: string;
  orchestration?: {
    pausedRuns: number;
    pausedRunNames: string[];
    hasPausedRuns: boolean;
  };
}

/** API envelope meta information */
export interface ApiMeta {
  timestamp: string;
  requestId: string;
  total?: number;
  hasNextPage?: boolean;
}

/** API error structure */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

/** Generic API envelope for all responses */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta: ApiMeta;
  error?: ApiError;
}

/** Projects response type */
export type ProjectsResponse = ApiEnvelope<Project[]>;
