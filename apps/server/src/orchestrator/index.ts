/**
 * Agent Orchestrator
 *
 * Factory and session management for Claude-powered agent execution.
 * Creates orchestrator instances bound to Socket.IO servers for real-time
 * streaming of agent execution to dashboard clients.
 */

import { randomUUID } from 'crypto';
import type { TypedServer } from '../socket/server.js';
import type { AgentSession } from './types.js';
import { runAgentLoop } from './claude.js';
import { runMockAgentLoop } from './mock.js';
import { EVENTS } from '@gsd/events';

// Use mock mode when explicitly enabled or no valid API key
const MOCK_MODE =
  process.env['MOCK_EXECUTION'] === 'true' ||
  !process.env['ANTHROPIC_API_KEY']?.startsWith('sk-ant-');

if (MOCK_MODE) {
  console.log('[orchestrator] Running in MOCK MODE (no real Claude API calls)');
}
import {
  processCheckpointResponse,
  getPendingCheckpointsForAgent,
} from './checkpoint.js';

// Active sessions by agentId
const sessions = new Map<string, AgentSession>();

export interface StartAgentOptions {
  projectPath: string;
  planId: string;
  taskName: string;
  systemPrompt: string;
  userPrompt: string;
}

/**
 * Create an orchestrator bound to a Socket.IO server instance
 *
 * The orchestrator manages agent lifecycle:
 * - Starting new agents with unique IDs
 * - Tracking session state
 * - Cancellation support
 *
 * @param io - Typed Socket.IO server
 * @returns Orchestrator interface
 */
export function createOrchestrator(io: TypedServer) {
  return {
    /**
     * Start a new agent session
     *
     * Creates a new agent with a unique ID and begins execution.
     * The agent loop runs asynchronously, streaming events to WebSocket clients.
     *
     * @param options - Agent start options
     * @returns Agent ID for tracking
     */
    async startAgent(options: StartAgentOptions): Promise<string> {
      const agentId = randomUUID();

      const session: AgentSession = {
        agentId,
        projectPath: options.projectPath,
        planId: options.planId,
        taskName: options.taskName,
        status: 'idle',
        sequence: 0,
        messages: [],
      };

      sessions.set(agentId, session);

      // Delay agent start to give frontend time to subscribe to the room
      // This prevents the race condition where events are emitted before
      // the client has subscribed after receiving the API response
      console.log(`[orchestrator] Scheduling agent ${agentId} to start in 500ms (mock=${MOCK_MODE})`);
      setTimeout(() => {
        console.log(`[orchestrator] Starting agent ${agentId}`);
        // Run agent loop (fire and forget - streams to WebSocket)
        const loopFn = MOCK_MODE ? runMockAgentLoop : runAgentLoop;
        loopFn(io, session, options.systemPrompt, options.userPrompt).finally(
          () => {
            // Clean up session after completion
            // Keep for a grace period to handle late checkpoint responses
            setTimeout(() => {
              sessions.delete(agentId);
            }, 60000); // 1 minute grace period
          }
        );
      }, 500); // 500ms delay for client subscription

      return agentId;
    },

    /**
     * Get session by agentId
     *
     * @param agentId - Agent ID to lookup
     * @returns Session if found, undefined otherwise
     */
    getSession(agentId: string): AgentSession | undefined {
      return sessions.get(agentId);
    },

    /**
     * Get all active sessions
     *
     * Active = not complete and not in error state.
     *
     * @returns Array of active sessions
     */
    getActiveSessions(): AgentSession[] {
      return Array.from(sessions.values()).filter(
        (s) => s.status !== 'complete' && s.status !== 'error'
      );
    },

    /**
     * Cancel a running agent
     *
     * Marks the session as error to stop the loop on next iteration.
     * Emits agent:end event with cancelled status.
     *
     * @param agentId - Agent ID to cancel
     * @returns true if found and cancelled, false if not found
     */
    cancelAgent(agentId: string): boolean {
      const session = sessions.get(agentId);
      if (!session) return false;

      // Mark as error to stop the loop on next iteration
      session.status = 'error';
      io.to(`agent:${agentId}`).emit(EVENTS.AGENT_END, {
        agentId,
        status: 'error',
        summary: 'Cancelled by user',
      });

      return true;
    },

    /**
     * Submit a checkpoint response (called from socket handler)
     *
     * Per CONTEXT.md: idempotency via checkpoint ID + response hash
     * - First response accepted
     * - Duplicate of same response: acknowledged without error
     * - Different response after first: rejected
     *
     * @param checkpointId - Checkpoint ID to respond to
     * @param response - User's response string
     * @returns Result with accepted flag and optional reason
     */
    respondToCheckpoint(
      checkpointId: string,
      response: string
    ): { accepted: boolean; reason?: string } {
      const result = processCheckpointResponse(checkpointId, response);
      // Only include reason if defined (exactOptionalPropertyTypes)
      return result.reason
        ? { accepted: result.accepted, reason: result.reason }
        : { accepted: result.accepted };
    },

    /**
     * Get pending checkpoints for an agent (for reconnect recovery)
     *
     * Per CONTEXT.md: "Auto-push checkpoint:pending immediately after socket reconnects"
     *
     * @param agentId - Agent ID to get checkpoints for
     * @returns Array of pending checkpoints
     */
    getPendingCheckpointsForAgent,
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
export type { AgentSession } from './types.js';
