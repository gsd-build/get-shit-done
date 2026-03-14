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

function resolvePhaseNumber(rawPhaseNumber: unknown, index: number): number {
  const parsed = Number.parseInt(String(rawPhaseNumber ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}

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
      number: resolvePhaseNumber(phase.number, index),
      name: phase.name,
      slug: phase.slug,
      status: mapPhaseStatus(phase.status),
      plans: phase.plans,
      completedPlans: phase.completedPlans,
    }));

    return success(c, { phases, total: phases.length });
  });

  app.get('/:id/phases/workflow', async (c) => {
    const id = c.req.param('id');
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
      return error(c, ErrorCodes.PROJECT_NOT_FOUND, `Project '${id}' not found`, 404);
    }

    const phasesResult = await listPhases(project.path);
    if (!phasesResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        phasesResult.error.message,
        500
      );
    }

    const workflow = phasesResult.data.map((phase, index) => {
      const phaseId = String(phase.number ?? index + 1);
      const isCompleted = phase.status === 'complete';
      const isInProgress = phase.status === 'active';
      return {
        id: phaseId,
        label: phase.name,
        wave: Math.max(1, index + 1),
        status: isCompleted
          ? 'complete'
          : isInProgress
            ? 'active'
            : 'assessed',
        dependsOn: index > 0 ? [String(phasesResult.data[index - 1]?.number ?? index)] : [],
      };
    });

    return success(c, workflow);
  });

  app.get('/:id/phases/:phaseId/parallelism', async (c) => {
    const id = c.req.param('id');
    const phaseId = c.req.param('phaseId');
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
      return error(c, ErrorCodes.PROJECT_NOT_FOUND, `Project '${id}' not found`, 404);
    }

    const phasesResult = await listPhases(project.path);
    if (!phasesResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        phasesResult.error.message,
        500
      );
    }

    const targetIndex = phasesResult.data.findIndex(
      (phase, index) => String(phase.number ?? index + 1) === phaseId
    );
    if (targetIndex < 0) {
      return error(c, 'PHASE_NOT_FOUND', `Phase '${phaseId}' not found`, 404);
    }

    const blockers: Array<{
      id: string;
      reason: string;
      dependsOn: string[];
      resolutionHint?: string;
    }> = [];

    if (targetIndex > 0) {
      const previous = phasesResult.data[targetIndex - 1];
      if (!previous) {
        return error(c, 'PHASE_NOT_FOUND', `Phase '${phaseId}' not found`, 404);
      }

      const isPreviousDone = previous.status === 'complete';
      if (!isPreviousDone) {
        blockers.push({
          id: `phase-${phaseId}-dependency`,
          reason: `Phase ${previous.number ?? targetIndex} must complete before parallel start`,
          dependsOn: [String(previous.number ?? targetIndex)],
          resolutionHint: 'Finish upstream dependencies or pause and re-plan safely.',
        });
      }
    }

    return success(c, {
      phaseId,
      allowed: blockers.length === 0,
      blockers,
      assessedAt: new Date().toISOString(),
    });
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
