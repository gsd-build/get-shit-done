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
import { EVENTS } from '@gsd/events';

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

      // Run agent loop (fire and forget - streams to WebSocket)
      runAgentLoop(io, session, options.systemPrompt, options.userPrompt).finally(
        () => {
          // Clean up session after completion
          // Keep for a grace period to handle late checkpoint responses
          setTimeout(() => {
            sessions.delete(agentId);
          }, 60000); // 1 minute grace period
        }
      );

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
  };
}

export type Orchestrator = ReturnType<typeof createOrchestrator>;
export type { AgentSession } from './types.js';
