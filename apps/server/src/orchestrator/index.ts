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
import {
  processCheckpointResponse,
  getPendingCheckpointsForAgent,
} from './checkpoint.js';

// Active sessions by agentId
const sessions = new Map<string, AgentSession>();

/**
 * Generate a contextual response for discuss-phase conversations.
 * For Phase 16 UI testing, this provides realistic mock responses.
 */
function generateDiscussResponse(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  // Context-aware responses for common discussion topics
  if (lowerPrompt.includes('hello') || lowerPrompt.includes('hi') || lowerPrompt.includes('start')) {
    return `Hello! I'm here to help gather context for your project. Let's discuss the requirements and design decisions.

What would you like to focus on first? You can tell me about:
- **Goals**: What are you trying to achieve?
- **Constraints**: Any technical or business limitations?
- **Users**: Who will be using this feature?`;
  }

  if (lowerPrompt.includes('goal') || lowerPrompt.includes('objective')) {
    return `Great, let's clarify your goals. Understanding the "why" helps me provide better guidance.

A few questions:
1. What problem are you solving?
2. How will you measure success?
3. What's the timeline for this work?`;
  }

  if (lowerPrompt.includes('user') || lowerPrompt.includes('audience')) {
    return `Understanding your users is crucial. Let me ask a few questions:

1. Who are the primary users of this feature?
2. What's their technical expertise level?
3. Are there any accessibility requirements to consider?`;
  }

  // Default response that encourages discussion
  return `Thanks for sharing that context. That helps me understand the situation better.

Based on what you've told me, I have a few follow-up questions:
1. Can you elaborate on the key requirements?
2. Are there any existing patterns in the codebase we should follow?
3. What would be the ideal outcome?`;
}

/**
 * Stream a response token by token with realistic timing.
 * Simulates ~30ms per token for typewriter effect per CONTEXT.md.
 */
async function streamDiscussResponse(
  io: TypedServer,
  agentId: string,
  response: string
): Promise<void> {
  const tokens = response.split(/(\s+)/);
  const DELAY_MS = 30; // Per CONTEXT.md typewriter effect

  for (const token of tokens) {
    io.to(`agent:${agentId}`).emit(EVENTS.AGENT_TOKEN, {
      agentId,
      token,
      sequence: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
  }
}

export interface StartAgentOptions {
  projectPath: string;
  planId: string;
  taskName: string;
  systemPrompt: string;
  userPrompt: string;
}

export interface StartDiscussAgentOptions {
  projectId: string;
  prompt: string;
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
     * Start a discuss-phase agent session
     *
     * Creates a conversational agent for gathering context through discussion.
     * Streams a response to the user's prompt.
     *
     * @param options - Discuss agent options
     * @returns Agent ID for tracking
     */
    async startDiscussAgent(options: StartDiscussAgentOptions): Promise<string> {
      const agentId = randomUUID();

      const session: AgentSession = {
        agentId,
        projectPath: options.projectId,
        planId: 'discuss',
        taskName: 'Discuss Phase',
        status: 'streaming',
        sequence: 0,
        messages: [],
      };

      sessions.set(agentId, session);

      // Emit agent:start event
      io.to(`agent:${agentId}`).emit(EVENTS.AGENT_START, {
        agentId,
        planId: session.planId,
        taskName: session.taskName,
      });

      // Simulate streaming response with typewriter effect
      const response = generateDiscussResponse(options.prompt);
      streamDiscussResponse(io, agentId, response).then(() => {
        session.status = 'complete';
        io.to(`agent:${agentId}`).emit(EVENTS.AGENT_END, {
          agentId,
          status: 'success',
          summary: 'Discussion response completed',
        });

        // Clean up after grace period
        setTimeout(() => sessions.delete(agentId), 60000);
      });

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
