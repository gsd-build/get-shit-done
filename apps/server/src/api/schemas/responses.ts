/**
 * API Response Schemas
 *
 * Defines Zod schemas for API response types.
 * These schemas are used for documentation and can be used for validation.
 */

import { z } from 'zod';

/**
 * Health status enum
 */
export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'error']);

export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Project health information
 */
export const ProjectHealthSchema = z.object({
  status: HealthStatusSchema,
  issues: z.array(z.string()),
  lastCheck: z.string().datetime().optional(),
});

export type ProjectHealth = z.infer<typeof ProjectHealthSchema>;

/**
 * Project progress information
 */
export const ProjectProgressSchema = z.object({
  completedPhases: z.number().int().min(0),
  totalPhases: z.number().int().min(0),
  completedPlans: z.number().int().min(0),
  totalPlans: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

export type ProjectProgress = z.infer<typeof ProjectProgressSchema>;

/**
 * Project summary for list view
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  status: z.enum(['active', 'paused', 'completed', 'unknown']),
  health: ProjectHealthSchema,
  currentPhase: z.string().nullable(),
  progress: ProjectProgressSchema,
  lastActivity: z.string().datetime().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Phase status enum
 */
export const PhaseStatusSchema = z.enum(['not_started', 'in_progress', 'completed', 'blocked']);

export type PhaseStatus = z.infer<typeof PhaseStatusSchema>;

/**
 * Phase information
 */
export const PhaseSchema = z.object({
  number: z.number().int().min(1),
  name: z.string(),
  slug: z.string(),
  status: PhaseStatusSchema,
  plans: z.number().int().min(0),
  completedPlans: z.number().int().min(0),
  description: z.string().optional(),
  dependsOn: z.array(z.number().int()).optional(),
});

export type Phase = z.infer<typeof PhaseSchema>;

/**
 * Socket.IO server metrics
 */
export const SocketMetricsSchema = z.object({
  connectedClients: z.number().int().min(0),
  roomCounts: z.record(z.string(), z.number().int().min(0)),
  uptime: z.number().int().min(0),
  memoryUsage: z.number().int().min(0),
});

export type SocketMetrics = z.infer<typeof SocketMetricsSchema>;

/**
 * Security metrics from audit log
 */
export const SecurityMetricsSchema = z.object({
  pathValidations: z.number().int().min(0),
  blockedAccess: z.number().int().min(0),
  symlinkResolutions: z.number().int().min(0),
  recentBlocked: z.array(
    z.object({
      path: z.string(),
      reason: z.string(),
      timestamp: z.string().datetime(),
    })
  ),
});

export type SecurityMetrics = z.infer<typeof SecurityMetricsSchema>;

/**
 * Combined health summary response
 */
export const HealthSummarySchema = z.object({
  socket: SocketMetricsSchema,
  security: SecurityMetricsSchema,
  server: z.object({
    version: z.string(),
    nodeVersion: z.string(),
    startedAt: z.string().datetime(),
  }),
});

export type HealthSummary = z.infer<typeof HealthSummarySchema>;
