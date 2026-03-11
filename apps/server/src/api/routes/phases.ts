/**
 * Phases Routes
 *
 * GET /api/projects/:id/phases - Returns phase list for a project
 */

import { Hono } from 'hono';
import { success, error } from '../middleware/envelope.js';
import { ApiError, ErrorCodes } from '../middleware/errors.js';
import type { Phase as ApiPhase } from '../schemas/responses.js';
import { discoverProjects, listPhases } from '@gsd/gsd-wrapper';

/**
 * Create phases routes
 *
 * @param searchPaths - Directories to scan for GSD projects
 */
export function createPhasesRoutes(searchPaths: string[]): Hono {
  const app = new Hono();

  /**
   * GET /projects/:id/phases
   * Returns list of phases for a project
   */
  app.get('/:id/phases', async (c) => {
    const id = c.req.param('id');

    // First verify project exists
    const projectResult = await discoverProjects(searchPaths);

    if (!projectResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        projectResult.error.message,
        500
      );
    }

    const project = projectResult.data.find((p) => p.id === id);

    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${id}' not found`,
        404
      );
    }

    // Get phases for the project
    const phasesResult = await listPhases(project.path);

    if (!phasesResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        phasesResult.error.message,
        500
      );
    }

    // Convert to API Phase format
    const phases: ApiPhase[] = phasesResult.data.map((phase, index) => ({
      number: parseInt(phase.number, 10) || index + 1,
      name: phase.name,
      slug: phase.slug,
      status: mapPhaseStatus(phase.status),
      plans: phase.plans,
      completedPlans: phase.completedPlans,
    }));

    return success(c, { phases, total: phases.length });
  });

  return app;
}

/**
 * Map GSD phase status to API phase status
 */
function mapPhaseStatus(
  status: string
): 'not_started' | 'in_progress' | 'completed' | 'blocked' {
  switch (status) {
    case 'complete':
    case 'completed':
      return 'completed';
    case 'active':
    case 'in_progress':
      return 'in_progress';
    case 'blocked':
      return 'blocked';
    default:
      return 'not_started';
  }
}
