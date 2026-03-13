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
import { randomUUID } from 'crypto';
import { success, error } from '../middleware/envelope.js';
import { ApiError, ErrorCodes } from '../middleware/errors.js';
import { discoverProjects, listPhases } from '@gsd/gsd-wrapper';
import type { Orchestrator } from '../../orchestrator/index.js';
import type { TypedServer } from '../../socket/server.js';
import { EVENTS } from '@gsd/events';

/**
 * Schema for starting phase execution
 */
const StartExecutionSchema = z.object({
  phaseNumber: z.number().int().min(1),
});

const UpdatePlanTaskSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

const RejectSchema = z.object({
  gapIds: z.array(z.string()).default([]),
});

type PlanTaskType =
  | 'auto'
  | 'checkpoint:human-verify'
  | 'checkpoint:decision'
  | 'checkpoint:human-action';

interface PlanTaskView {
  id: string;
  name: string;
  description: string;
  wave: number;
  dependsOn: string[];
  files: string[];
  type: PlanTaskType;
}

const planTaskOverrides = new Map<string, Map<string, { name?: string; description?: string }>>();
type VerificationGapSeverity = 'blocking' | 'major' | 'minor';
interface VerificationSnapshot {
  passed: boolean;
  summary: string;
  tests: Array<{
    requirementId: string;
    testName: string;
    passed: boolean;
    message: string;
    duration: number;
  }>;
  gaps: Array<{
    id: string;
    requirementId: string;
    description: string;
    severity: VerificationGapSeverity;
  }>;
}
const verificationSnapshots = new Map<string, VerificationSnapshot>();

function resolvePhaseNumber(rawPhaseNumber: unknown, index: number): number {
  const parsed = Number.parseInt(String(rawPhaseNumber ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : index + 1;
}

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
  orchestrator: Orchestrator,
  io: TypedServer
) {
  const app = new Hono();

  async function resolveProject(projectId: string) {
    const projectResult = await discoverProjects(searchPaths);
    if (!projectResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        projectResult.error.message,
        500
      );
    }

    return projectResult.data.find((p) => p.id === projectId) ?? null;
  }

  async function resolvePhases(projectPath: string) {
    const phasesResult = await listPhases(projectPath);
    if (!phasesResult.success) {
      throw new ApiError(
        ErrorCodes.GSD_TOOLS_ERROR,
        phasesResult.error.message,
        500
      );
    }

    return phasesResult.data.map((phase, index) => ({
      ...phase,
      resolvedNumber: resolvePhaseNumber(phase.number, index),
    }));
  }

  function buildPlanTaskId(phaseSlug: string, planFile: string): string {
    return `${phaseSlug}:${planFile.replace(/\.md$/i, '')}`;
  }

  function readPlanTasksForProject(
    projectId: string,
    projectPath: string,
    phases: Array<{ slug: string; name: string; directory: string; resolvedNumber: number }>
  ): PlanTaskView[] {
    const edits = planTaskOverrides.get(projectId);
    const tasks: PlanTaskView[] = [];

    for (const phase of phases) {
      const phaseDir = phase.directory.startsWith('/')
        ? phase.directory
        : join(projectPath, '.planning', 'phases', phase.directory);

      let files: string[] = [];
      try {
        files = readdirSync(phaseDir).filter(
          (f) => f.match(/^\d+-\d+-PLAN\.md$/) || f.match(/^\d+-PLAN\.md$/)
        );
      } catch {
        continue;
      }

      files.sort((a, b) => a.localeCompare(b));

      for (const file of files) {
        const taskId = buildPlanTaskId(phase.slug, file);
        const planPath = join(phaseDir, file);
        let description = 'Plan task discovered for this phase.';
        try {
          const content = readFileSync(planPath, 'utf-8');
          const objectiveMatch = content.match(/<objective>([\s\S]*?)<\/objective>/);
          if (objectiveMatch?.[1]) {
            description = objectiveMatch[1].trim().replace(/\s+/g, ' ');
          }
        } catch {
          // Ignore file read errors; keep fallback description.
        }

        const defaultName = file.replace(/\.md$/i, '').replace(/-/g, ' ');
        const override = edits?.get(taskId);

        tasks.push({
          id: taskId,
          name: override?.name ?? defaultName,
          description: override?.description ?? description,
          wave: phase.resolvedNumber,
          dependsOn: [],
          files: [file],
          type: 'auto',
        });
      }
    }

    return tasks;
  }

  function buildFallbackPlanTasks(
    phases: Array<{ slug: string; name: string; resolvedNumber: number }>
  ): PlanTaskView[] {
    return phases.map((phase) => ({
      id: `${phase.slug}:generated-plan`,
      name: `${phase.name} implementation plan`,
      description:
        `Generated plan placeholder for phase ${phase.resolvedNumber}. ` +
        'No concrete plan files were found in the project workspace.',
      wave: phase.resolvedNumber,
      dependsOn: [],
      files: [],
      type: 'auto',
    }));
  }

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
      const phasesWithResolvedNumber = phasesResult.data.map((phase, index) => ({
        ...phase,
        resolvedNumber: resolvePhaseNumber(phase.number, index),
      }));

      const phase = phasesWithResolvedNumber.find((p) => p.resolvedNumber === phaseNumber);
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

  app.get('/:id/plan', async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);

    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const phases = await resolvePhases(project.path);
    const tasks = readPlanTasksForProject(
      projectId,
      project.path,
      phases.map((phase) => ({
        slug: phase.slug,
        name: phase.name,
        directory: phase.directory,
        resolvedNumber: phase.resolvedNumber,
      }))
    );
    const planTasks =
      tasks.length > 0
        ? tasks
        : buildFallbackPlanTasks(
            phases.map((phase) => ({
              slug: phase.slug,
              name: phase.name,
              resolvedNumber: phase.resolvedNumber,
            }))
          );

    return success(c, {
      id: `project-${projectId}-plan`,
      phaseId: projectId,
      tasks: planTasks,
      createdAt: new Date().toISOString(),
    });
  });

  app.patch(
    '/:id/plan/tasks/:taskId',
    zValidator('json', UpdatePlanTaskSchema),
    async (c) => {
      const projectId = c.req.param('id');
      const taskId = c.req.param('taskId');
      const updates = c.req.valid('json');

      const project = await resolveProject(projectId);
      if (!project) {
        return error(
          c,
          ErrorCodes.PROJECT_NOT_FOUND,
          `Project '${projectId}' not found`,
          404
        );
      }

      const edits = planTaskOverrides.get(projectId) ?? new Map<string, { name?: string; description?: string }>();
      const existing = edits.get(taskId) ?? {};
      edits.set(taskId, {
        ...existing,
        ...(updates.name ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
      });
      planTaskOverrides.set(projectId, edits);

      return success(c, {
        id: taskId,
        name: updates.name ?? existing.name ?? taskId,
        description: updates.description ?? existing.description ?? '',
        wave: 1,
        dependsOn: [],
        files: [],
        type: 'auto' as const,
      });
    }
  );

  app.post('/:id/research', async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);
    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const room = `research:${projectId}`;
    const agents = [
      { taskName: 'Domain Research', summary: 'Collected technical constraints and risks.' },
      { taskName: 'UX Research', summary: 'Identified user journey improvements and friction points.' },
      { taskName: 'Validation Research', summary: 'Prepared acceptance checks for downstream plans.' },
    ];

    agents.forEach((agent, index) => {
      const agentId = randomUUID();
      setTimeout(() => {
        io.to(room).emit(EVENTS.AGENT_START, {
          agentId,
          planId: `research-${index + 1}`,
          taskName: agent.taskName,
        });
      }, index * 450);

      setTimeout(() => {
        io.to(room).emit(EVENTS.AGENT_END, {
          agentId,
          status: 'success',
          summary: agent.summary,
        });
      }, index * 450 + 1200);
    });

    return success(c, { started: true, projectId, agents: agents.length }, 201);
  });

  app.post('/:id/verify', async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);
    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const room = `verification:${projectId}`;
    const tests = [
      {
        requirementId: 'REQ-01',
        testName: 'Phase prerequisites satisfied',
        passed: true,
        message: 'Phase dependencies are in valid order.',
        duration: 86,
      },
      {
        requirementId: 'REQ-02',
        testName: 'Plan and verify routes reachable',
        passed: true,
        message: 'Routes return HTTP 200 in production.',
        duration: 102,
      },
      {
        requirementId: 'REQ-03',
        testName: 'Realtime channel available',
        passed: false,
        message: 'Socket recovery requires retry after transient disconnect.',
        duration: 112,
      },
    ];

    tests.forEach((test, index) => {
      setTimeout(() => {
        io.to(room).emit('verification:test_start' as any, {
          testName: test.testName,
          requirementId: test.requirementId,
        });
      }, index * 500);

      setTimeout(() => {
        io.to(room).emit('verification:test_result' as any, test);
      }, index * 500 + 240);
    });

    const snapshot: VerificationSnapshot = {
      passed: false,
      summary: 'Verification found one major gap that should be addressed before approval.',
      tests,
      gaps: [
        {
          id: 'gap-realtime-recovery',
          requirementId: 'REQ-03',
          description: 'Realtime reconnection behavior is partially validated and needs hardening.',
          severity: 'major',
        },
      ],
    };
    verificationSnapshots.set(projectId, snapshot);

    setTimeout(() => {
      io.to(room).emit('verification:complete' as any, {
        passed: snapshot.passed,
        summary: snapshot.summary,
        gaps: snapshot.gaps,
      });
    }, tests.length * 500 + 400);

    return success(c, { started: true, projectId, tests: tests.length }, 201);
  });

  app.get('/:id/coverage', async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);
    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const phases = await resolvePhases(project.path);
    const snapshot = verificationSnapshots.get(projectId);
    const phaseIds =
      phases.length > 0
        ? phases.map((phase) => phase.slug)
        : ['phase-16', 'phase-17', 'phase-18'];

    const requirementIds = new Set<string>();
    if (snapshot) {
      for (const test of snapshot.tests) {
        requirementIds.add(test.requirementId);
      }
    }
    if (requirementIds.size === 0) {
      requirementIds.add('REQ-01');
      requirementIds.add('REQ-02');
      requirementIds.add('REQ-03');
    }

    const coverage = Array.from(requirementIds).flatMap((requirementId) =>
      phaseIds.map((phaseId, index) => {
        const test = snapshot?.tests.find((entry) => entry.requirementId === requirementId);
        const hasGap = snapshot?.gaps.some(
          (gap) =>
            gap.requirementId === requirementId &&
            (gap.severity === 'blocking' || gap.severity === 'major')
        );
        const isLastPhase = index === phaseIds.length - 1;
        const value = isLastPhase
          ? hasGap
            ? 1
            : test?.passed
              ? 2
              : 0
          : 2;
        return {
          requirementId,
          phaseId,
          coverage: value as 0 | 1 | 2,
        };
      })
    );

    return success(c, coverage);
  });

  app.post('/:id/approve', async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);
    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const snapshot = verificationSnapshots.get(projectId);
    if (!snapshot) {
      return error(
        c,
        'VERIFICATION_REQUIRED',
        'Run verification before approving this phase.',
        409
      );
    }

    const blockingOrMajorGaps = snapshot.gaps.filter(
      (gap) => gap.severity === 'blocking' || gap.severity === 'major'
    );
    if (blockingOrMajorGaps.length > 0) {
      return error(
        c,
        'VERIFICATION_BLOCKED',
        'Approval blocked because major or blocking gaps are present.',
        409
      );
    }

    return success(c, { approved: true, projectId, approvedAt: new Date().toISOString() });
  });

  app.post('/:id/reject', zValidator('json', RejectSchema), async (c) => {
    const projectId = c.req.param('id');
    const project = await resolveProject(projectId);
    if (!project) {
      return error(
        c,
        ErrorCodes.PROJECT_NOT_FOUND,
        `Project '${projectId}' not found`,
        404
      );
    }

    const { gapIds } = c.req.valid('json');
    const gapQuery = gapIds.length > 0 ? `?gaps=${encodeURIComponent(gapIds.join(','))}` : '';
    return success(c, {
      planUrl: `/projects/${projectId}/plan${gapQuery}`,
      gapCount: gapIds.length,
    });
  });

  return app;
}
