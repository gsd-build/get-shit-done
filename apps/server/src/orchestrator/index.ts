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

// Mock mode is opt-in only.
const MOCK_MODE = process.env['MOCK_EXECUTION'] === 'true';
const ANTHROPIC_API_KEY = process.env['ANTHROPIC_API_KEY'];
const HAS_ANTHROPIC_API_KEY = (ANTHROPIC_API_KEY?.trim().length ?? 0) > 0;

if (!MOCK_MODE && !HAS_ANTHROPIC_API_KEY) {
  throw new Error(
    '[orchestrator] ANTHROPIC_API_KEY is required when MOCK_EXECUTION is not true'
  );
}

if (MOCK_MODE) {
  console.log('[orchestrator] Running in MOCK MODE (MOCK_EXECUTION=true)');
}
import {
  processCheckpointResponse,
  getPendingCheckpointsForAgent,
} from './checkpoint.js';

// Active sessions by agentId
const sessions = new Map<string, AgentSession>();

// Track conversation context for mock CONTEXT.md generation
const conversationContext = new Map<string, { messageCount: number; topics: string[] }>();

/**
 * Generate mock CONTEXT.md markdown based on conversation progress.
 * For Phase 16 UI testing, this simulates context being gathered.
 *
 * IMPORTANT: Uses XML-tagged format to match CLI /gsd:discuss-phase output.
 * The frontend parser (contextParser.ts) expects <section>...</section> tags.
 */
function generateMockContextMd(agentId: string, prompt: string): string {
  const ctx = conversationContext.get(agentId) || { messageCount: 0, topics: [] };
  ctx.messageCount++;

  // Extract topics from prompt
  const lowerPrompt = prompt.toLowerCase();
  if (lowerPrompt.includes('goal') || lowerPrompt.includes('objective')) {
    ctx.topics.push('goals');
  }
  if (lowerPrompt.includes('user') || lowerPrompt.includes('audience')) {
    ctx.topics.push('users');
  }
  if (lowerPrompt.includes('tech') || lowerPrompt.includes('stack') || lowerPrompt.includes('react') || lowerPrompt.includes('typescript')) {
    ctx.topics.push('technology');
  }
  if (lowerPrompt.includes('decision') || lowerPrompt.includes('decided')) {
    ctx.topics.push('decisions');
  }

  conversationContext.set(agentId, ctx);

  // Build CONTEXT.md content with decisions
  const decisions: string[] = [];
  const specifics: string[] = [];
  const deferred: string[] = [];

  if (ctx.topics.includes('goals')) {
    decisions.push('- Focus on user experience as primary metric');
    decisions.push('- Prioritize performance over feature count <!-- locked -->');
  }
  if (ctx.topics.includes('users')) {
    decisions.push('- Target developers with moderate experience');
    specifics.push('- Include onboarding flow for first-time users');
  }
  if (ctx.topics.includes('technology')) {
    decisions.push('- Use React with TypeScript for frontend');
    specifics.push('- Deploy to Vercel for initial launch');
  }
  if (ctx.topics.includes('decisions')) {
    decisions.push('- User-specified decision captured from conversation');
  }

  // Always include at least one decision after first message
  if (decisions.length === 0 && ctx.messageCount > 0) {
    decisions.push('- Initial context gathering in progress');
  }

  // Always have a deferred item
  deferred.push('- Future enhancement: Add AI suggestions');

  // Use XML-tagged format for parser compatibility
  return `# Phase Context

<domain>
## Phase Boundary

Discussion phase for gathering project requirements and design decisions.

</domain>

<decisions>
## Implementation Decisions

${decisions.join('\n')}

</decisions>

<specifics>
## Specific Ideas

${specifics.length > 0 ? specifics.join('\n') : '(none yet)'}

</specifics>

<deferred>
## Deferred Ideas

${deferred.join('\n')}

</deferred>
`;
}

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

      // Delay to allow client to join socket room after API returns.
      // 1000ms gives React time to: receive response -> update state -> trigger effect -> subscribe.
      setTimeout(async () => {
        console.log(`[orchestrator] Starting discuss stream for agent ${agentId} after 1s delay`);

        if (MOCK_MODE) {
          // Simulate streaming response with typewriter effect
          io.to(`agent:${agentId}`).emit(EVENTS.AGENT_START, {
            agentId,
            planId: session.planId,
            taskName: session.taskName,
          });

          const response = generateDiscussResponse(options.prompt);
          await streamDiscussResponse(io, agentId, response);

          // Generate and emit context update after response completes
          const contextMd = generateMockContextMd(agentId, options.prompt);
          io.to(`agent:${agentId}`).emit('context:update' as any, {
            agentId,
            markdown: contextMd,
          });

          session.status = 'complete';
          io.to(`agent:${agentId}`).emit(EVENTS.AGENT_END, {
            agentId,
            status: 'success',
            summary: 'Discussion response completed',
          });
          setTimeout(() => {
            sessions.delete(agentId);
            conversationContext.delete(agentId);
          }, 60000);
          return;
        }

        const discussSystemPrompt = [
          'You are facilitating the GSD discuss phase.',
          'Ask concise follow-up questions to clarify goals, constraints, users, and key decisions.',
          'Do not fabricate project context or fake outputs.',
          'If you do not have required project context, ask for it explicitly.',
        ].join(' ');

        runAgentLoop(io, session, discussSystemPrompt, options.prompt).finally(() => {
          setTimeout(() => {
            sessions.delete(agentId);
            conversationContext.delete(agentId);
          }, 60000);
        });
      }, 1000);

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
