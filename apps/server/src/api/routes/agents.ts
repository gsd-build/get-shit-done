/**
 * Agent REST API Routes
 *
 * Provides REST endpoints for agent lifecycle management:
 * - POST /api/agents - Start a new agent
 * - GET /api/agents - List active agents
 * - GET /api/agents/:id - Get agent status
 * - DELETE /api/agents/:id - Cancel agent
 *
 * Per CONTEXT.md: REST API starts agents and returns agentId
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { success, error } from '../middleware/envelope.js';
import type { Orchestrator } from '../../orchestrator/index.js';

/**
 * Schema for starting an execute-plan agent
 */
const ExecutePlanAgentSchema = z.object({
  agentType: z.literal('execute-plan').optional(),
  projectPath: z.string().min(1),
  planId: z.string().min(1),
  taskName: z.string().min(1),
  systemPrompt: z.string().min(1),
  userPrompt: z.string().min(1),
});

/**
 * Schema for starting a discuss-phase agent
 */
const DiscussPhaseAgentSchema = z.object({
  agentType: z.literal('discuss-phase'),
  projectId: z.string().min(1),
  prompt: z.string().min(1),
});

/**
 * Combined schema for starting agents (discriminated union)
 */
const StartAgentSchema = z.union([ExecutePlanAgentSchema, DiscussPhaseAgentSchema]);

/**
 * Create agent routes with orchestrator dependency
 *
 * @param orchestrator - Agent orchestrator instance
 * @returns Hono router for agent endpoints
 */
export function createAgentRoutes(orchestrator: Orchestrator) {
  const app = new Hono();

  /**
   * POST /api/agents - Start a new agent
   *
   * Supports two agent types:
   *
   * 1. Execute-plan agent (default):
   *    - projectPath: string - Path to the GSD project
   *    - planId: string - Plan identifier for this execution
   *    - taskName: string - Human-readable task name
   *    - systemPrompt: string - System prompt for Claude
   *    - userPrompt: string - Initial user prompt
   *
   * 2. Discuss-phase agent:
   *    - agentType: 'discuss-phase'
   *    - projectId: string - Project identifier
   *    - prompt: string - User's message
   *
   * Response: { data: { agentId: string }, meta: {...} }
   */
  app.post('/', zValidator('json', StartAgentSchema), async (c) => {
    const body = c.req.valid('json');

    try {
      // Handle discuss-phase agent (conversational)
      if ('agentType' in body && body.agentType === 'discuss-phase') {
        const agentId = await orchestrator.startDiscussAgent({
          projectId: body.projectId,
          prompt: body.prompt,
        });
        return success(c, { agentId }, 201);
      }

      // Handle execute-plan agent (default)
      const agentId = await orchestrator.startAgent(body);
      return success(c, { agentId }, 201);
    } catch (err) {
      return error(c, 'AGENT_START_FAILED', (err as Error).message, 500);
    }
  });

  /**
   * GET /api/agents - List active agents
   *
   * Returns all agents that are not complete and not in error state.
   *
   * Response: { data: { agents: [{ agentId, planId, taskName, status, sequence }] }, meta: {...} }
   */
  app.get('/', async (c) => {
    const sessions = orchestrator.getActiveSessions();
    return success(c, {
      agents: sessions.map((s) => ({
        agentId: s.agentId,
        planId: s.planId,
        taskName: s.taskName,
        status: s.status,
        sequence: s.sequence,
      })),
    });
  });

  /**
   * GET /api/agents/:id - Get agent status
   *
   * Returns detailed status for a specific agent.
   *
   * Response: { data: { agentId, planId, taskName, status, sequence, pendingCheckpoint? }, meta: {...} }
   */
  app.get('/:id', async (c) => {
    const agentId = c.req.param('id');
    const session = orchestrator.getSession(agentId);

    if (!session) {
      return error(c, 'AGENT_NOT_FOUND', `Agent ${agentId} not found`, 404);
    }

    return success(c, {
      agentId: session.agentId,
      planId: session.planId,
      taskName: session.taskName,
      status: session.status,
      sequence: session.sequence,
      ...(session.pendingCheckpoint && {
        pendingCheckpoint: session.pendingCheckpoint,
      }),
    });
  });

  /**
   * DELETE /api/agents/:id - Cancel agent
   *
   * Cancels a running agent. The agent will stop on the next iteration
   * and emit an agent:end event with error status.
   *
   * Response: { data: { cancelled: true }, meta: {...} }
   */
  app.delete('/:id', async (c) => {
    const agentId = c.req.param('id');
    const cancelled = orchestrator.cancelAgent(agentId);

    if (!cancelled) {
      return error(c, 'AGENT_NOT_FOUND', `Agent ${agentId} not found`, 404);
    }

    return success(c, { cancelled: true });
  });

  return app;
}
