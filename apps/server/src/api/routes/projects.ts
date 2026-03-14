/**
 * Project Routes
 *
 * GET /api/projects - Returns paginated list of GSD projects with health status
 * GET /api/projects/:id - Returns single project with full details
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { success, paginated, error } from '../middleware/envelope.js';
import { ApiError, ErrorCodes } from '../middleware/errors.js';
import { PaginationQuerySchema, paginateItems } from '../schemas/pagination.js';
import type { Project, ProjectHealth, ProjectProgress } from '../schemas/responses.js';
import {
  discoverProjects,
  getState,
  getHealth,
  type Project as GsdProject,
} from '@gsd/gsd-wrapper';

/**
 * Full project response combining discovery + state + health
 */
interface ProjectResponse extends Project {
  /** Timestamp when project was discovered/loaded */
  discoveredAt: string;
}

/**
 * Convert GSD project + state + health to API Project format
 */
async function enrichProject(project: GsdProject): Promise<ProjectResponse> {
  const discoveredAt = new Date().toISOString();

  // Get state (phase, plan, progress)
  const stateResult = await getState(project.path);
  const healthResult = await getHealth(project.path);

  // Build health info (default to 'error' if health check fails)
  let healthStatus: 'healthy' | 'degraded' | 'error' = 'error';
  let healthIssues: string[] = [];

  if (healthResult.success) {
    healthStatus = healthResult.data.status;
    healthIssues = healthResult.data.issues.map((i) => i.suggested_action);
  }

  const health: ProjectHealth = {
    status: healthStatus,
    issues: healthIssues,
    lastCheck: discoveredAt,
  };

  // Build progress info
  const progress: ProjectProgress = {
    completedPhases: 0,
    totalPhases: 0,
    completedPlans: 0,
    totalPlans: 0,
    percentage: 0,
  };

  let currentPhase: string | null = null;
  let status: 'active' | 'paused' | 'completed' | 'unknown' = 'unknown';
  let pausedRuns = 0;
  let pausedRunNames: string[] = [];

  if (stateResult.success) {
    currentPhase = stateResult.data.phase;
    progress.percentage = stateResult.data.progress.percentage;
    progress.completedPlans = stateResult.data.progress.completed;
    progress.totalPlans = stateResult.data.progress.total;

    // Map GSD status to project status
    const stateStatus = String(stateResult.data.status);
    switch (stateStatus) {
      case 'active':
        status = 'active';
        break;
      case 'paused':
        status = 'paused';
        break;
      case 'complete':
        status = 'completed';
        break;
      default:
        status = 'active';
    }

    if (status === 'paused') {
      pausedRuns = 1;
      pausedRunNames = [stateResult.data.phase || project.name];
    }
  }

  return {
    id: project.id,
    name: project.name,
    path: project.path,
    status,
    health,
    currentPhase,
    progress,
    lastActivity: stateResult.success ? stateResult.data.lastActivity : undefined,
    orchestration: {
      pausedRuns,
      pausedRunNames,
      hasPausedRuns: pausedRuns > 0,
    },
    discoveredAt,
  };
}

/**
 * Create project routes
 *
 * @param searchPaths - Directories to scan for GSD projects
 */
export function createProjectRoutes(searchPaths: string[]): Hono {
  const app = new Hono();

  /**
   * GET /projects
   * Returns paginated list of projects with embedded health status
   */
  app.get(
    '/',
    zValidator('query', PaginationQuerySchema),
    async (c) => {
      const query = c.req.valid('query');

      // Discover all projects
      const result = await discoverProjects(searchPaths);

      if (!result.success) {
        throw new ApiError(
          ErrorCodes.GSD_TOOLS_ERROR,
          result.error.message,
          500
        );
      }

      // Enrich each project with state and health (in parallel)
      const enrichedProjects = await Promise.all(
        result.data.map((p) => enrichProject(p))
      );

      // Sort by name for consistent ordering
      enrichedProjects.sort((a, b) => a.name.localeCompare(b.name));

      // Apply pagination
      const paginated_ = paginateItems(
        enrichedProjects,
        query.cursor,
        query.limit,
        (p) => p.id,
        (p) => new Date(p.discoveredAt).getTime()
      );

      return paginated(c, paginated_.items, {
        nextCursor: paginated_.nextCursor,
        hasNextPage: paginated_.hasNextPage,
        total: enrichedProjects.length,
      });
    }
  );

  /**
   * GET /projects/:id
   * Returns single project with full details
   */
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    // Discover all projects and find the matching one
    const result = await discoverProjects(searchPaths);

    if (!result.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        result.error.message,
        500
      );
    }

    const project = result.data.find((p) => p.id === id);

    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${id}' not found`,
        404
      );
    }

    const enrichedProject = await enrichProject(project);
    return success(c, enrichedProject);
  });

  return app;
}
