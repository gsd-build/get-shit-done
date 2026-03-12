/**
 * Execute Routes
 *
 * POST /api/projects/:id/execute - Start phase execution
 *
 * Reads plan files from a phase directory and starts agents for each plan.
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { success, error } from '../middleware/envelope.js';
import { ApiError, ErrorCodes } from '../middleware/errors.js';
import { discoverProjects, listPhases } from '@gsd/gsd-wrapper';
import type { Orchestrator } from '../../orchestrator/index.js';

/**
 * Schema for starting phase execution
 */
const StartExecutionSchema = z.object({
  phaseNumber: z.number().int().min(1),
});

/**
 * Extract objective from plan content
 */
function extractObjective(content: string): string {
  const objectiveMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
  if (objectiveMatch && objectiveMatch[1]) {
    return objectiveMatch[1].trim();
  }
  // Fallback: use first paragraph after frontmatter
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, '');
  const firstPara = withoutFrontmatter.split('\n\n')[0] ?? '';
  return firstPara.trim() || 'Execute plan tasks';
}

/**
 * Extract task name from plan filename or content
 */
function extractTaskName(filename: string, content: string): string {
  // Try to extract from frontmatter
  const nameMatch = content.match(/^name:\s*(.+)$/m);
  if (nameMatch && nameMatch[1]) {
    return nameMatch[1].trim().replace(/['"]/g, '');
  }
  // Fallback: use filename
  return filename.replace(/\.md$/, '').replace(/-/g, ' ');
}

/**
 * Generate system prompt for plan execution
 */
function generateSystemPrompt(planContent: string): string {
  return `You are a software development agent executing a GSD (Get Shit Done) plan.
Your role is to implement the tasks defined in the plan accurately and completely.

Follow these guidelines:
1. Read and understand each task before starting
2. Implement tasks in order unless dependencies allow parallel work
3. Verify your work after each task
4. Report progress clearly

Plan content:
${planContent}`;
}

/**
 * Generate user prompt for plan execution
 */
function generateUserPrompt(objective: string): string {
  return `Execute the plan to achieve this objective:

${objective}

Start with the first task and proceed through all tasks in order.
Verify each task before moving to the next.`;
}

/**
 * Create execute routes with orchestrator dependency
 *
 * @param searchPaths - Directories to scan for GSD projects
 * @param orchestrator - Agent orchestrator instance
 * @returns Hono router for execute endpoints
 */
export function createExecuteRoutes(
  searchPaths: string[],
  orchestrator: Orchestrator
) {
  const app = new Hono();

  /**
   * POST /projects/:id/execute - Start phase execution
   *
   * Request body:
   * - phaseNumber: number - Phase number to execute
   *
   * Response: { data: { agents: [{ agentId, planId, taskName }] }, meta: {...} }
   */
  app.post(
    '/:id/execute',
    zValidator('json', StartExecutionSchema),
    async (c) => {
      const projectId = c.req.param('id');
      const { phaseNumber } = c.req.valid('json');
      console.log(`[execute] Starting execution for project ${projectId}, phase ${phaseNumber}`);

      // Find project
      const projectResult = await discoverProjects(searchPaths);
      if (!projectResult.success) {
        throw new ApiError(
          ErrorCodes.GSD_TOOLS_ERROR,
          projectResult.error.message,
          500
        );
      }

      const project = projectResult.data.find((p) => p.id === projectId);
      if (!project) {
        return error(
          c,
          ErrorCodes.PROJECT_NOT_FOUND,
          `Project '${projectId}' not found`,
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

      // Find the requested phase
      const phase = phasesResult.data.find(
        (p) => parseInt(p.number, 10) === phaseNumber
      );
      if (!phase) {
        return error(
          c,
          'PHASE_NOT_FOUND',
          `Phase ${phaseNumber} not found in project`,
          404
        );
      }

      // Read plan files from phase directory
      // Use phase.directory if it's absolute, otherwise construct path with number prefix
      const phaseDir = phase.directory.startsWith('/')
        ? phase.directory
        : join(project.path, '.planning', 'phases', phase.directory);
      let planFiles: string[];

      try {
        const files = readdirSync(phaseDir);
        planFiles = files.filter(
          (f) => f.match(/^\d+-\d+-PLAN\.md$/) || f.match(/^\d+-PLAN\.md$/)
        );
      } catch (err) {
        return error(
          c,
          'PHASE_DIR_NOT_FOUND',
          `Phase directory not found: ${phaseDir}`,
          404
        );
      }

      if (planFiles.length === 0) {
        return error(
          c,
          'NO_PLANS_FOUND',
          `No plan files found in phase ${phaseNumber}`,
          404
        );
      }

      // Sort plan files by number
      planFiles.sort((a, b) => {
        const partsA = a.split('-');
        const partsB = b.split('-');
        const numA = parseInt(partsA[1] ?? partsA[0] ?? '0', 10);
        const numB = parseInt(partsB[1] ?? partsB[0] ?? '0', 10);
        return numA - numB;
      });

      // Start agents for each plan
      const startedAgents: Array<{
        agentId: string;
        planId: string;
        taskName: string;
      }> = [];

      for (const planFile of planFiles) {
        const planPath = join(phaseDir, planFile);
        const planContent = readFileSync(planPath, 'utf-8');

        const planId = planFile.replace('.md', '');
        const taskName = extractTaskName(planFile, planContent);
        const objective = extractObjective(planContent);
        const systemPrompt = generateSystemPrompt(planContent);
        const userPrompt = generateUserPrompt(objective);

        try {
          console.log(`[execute] Starting agent for ${planId}`);
          const agentId = await orchestrator.startAgent({
            projectPath: project.path,
            planId,
            taskName,
            systemPrompt,
            userPrompt,
          });
          console.log(`[execute] Agent ${agentId} started for ${planId}`);

          startedAgents.push({ agentId, planId, taskName });
        } catch (err) {
          // Log error but continue with other plans
          console.error(`[execute] Failed to start agent for ${planId}:`, err);
        }
      }

      if (startedAgents.length === 0) {
        return error(
          c,
          'EXECUTION_FAILED',
          'Failed to start any agents',
          500
        );
      }

      return success(
        c,
        {
          phaseNumber,
          phaseName: phase.name,
          agents: startedAgents,
          totalPlans: planFiles.length,
        },
        201
      );
    }
  );

  return app;
}
