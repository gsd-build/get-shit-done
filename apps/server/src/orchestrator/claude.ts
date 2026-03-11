/**
 * Claude API streaming agent loop
 *
 * Per CONTEXT.md:
 * - Agent orchestrator streams Claude API tokens to WebSocket clients
 * - Tool calls execute in parallel and results are fed back to Claude
 * - Rate limit errors (429) retry with exponential backoff
 * - Tool errors are returned to Claude as error tool results
 * - Phase progress events emit streaming/tool_executing/awaiting_checkpoint
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ToolUseBlock, ToolResultBlockParam, TextBlock } from '@anthropic-ai/sdk/resources/messages';
import { EVENTS } from '@gsd/events';
import type { TypedServer } from '../socket/server.js';
import type { AgentSession, ToolContext } from './types.js';
import { executeTool, GSD_TOOLS } from './tools.js';
import { withRetry } from './retry.js';
import {
  createCheckpoint,
  markCheckpointWarned,
  markCheckpointPaused,
  getCheckpoint,
  type PendingCheckpoint,
} from './checkpoint.js';

// Anthropic client - uses ANTHROPIC_API_KEY environment variable
const client = new Anthropic();

/**
 * Wait for a checkpoint response from the user
 *
 * Per CONTEXT.md:
 * - 30s warning before timeout
 * - 60s pause (agent waits indefinitely after this)
 * - Checkpoint persists for reconnect recovery
 *
 * @param io - Socket.IO server instance
 * @param session - Agent session state
 * @param checkpoint - The pending checkpoint
 * @returns The user's response string
 */
export async function waitForCheckpointResponse(
  io: TypedServer,
  session: AgentSession,
  checkpoint: PendingCheckpoint
): Promise<string> {
  const room = `agent:${session.agentId}`;

  // Emit phase change
  session.status = 'awaiting_checkpoint';
  session.pendingCheckpoint = checkpoint.checkpointId;
  io.to(room).emit(EVENTS.AGENT_PHASE, {
    agentId: session.agentId,
    phase: 'awaiting_checkpoint',
    sequence: session.sequence++,
  });

  // Emit checkpoint request
  // Note: Only include options if defined (exactOptionalPropertyTypes)
  io.to(room).emit(EVENTS.CHECKPOINT_REQUEST, {
    checkpointId: checkpoint.checkpointId,
    type: checkpoint.type,
    prompt: checkpoint.prompt,
    ...(checkpoint.options && { options: checkpoint.options }),
    timeoutMs: checkpoint.timeoutMs,
  });

  // Wait with timeout handling per CONTEXT.md
  return new Promise((resolve) => {
    let warnTimer: NodeJS.Timeout | undefined;
    let pauseTimer: NodeJS.Timeout | undefined;
    let checkInterval: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (warnTimer) clearTimeout(warnTimer);
      if (pauseTimer) clearTimeout(pauseTimer);
      if (checkInterval) clearInterval(checkInterval);
    };

    // 30s warning per CONTEXT.md
    warnTimer = setTimeout(() => {
      markCheckpointWarned(checkpoint.checkpointId);
      // Note: Only include options if defined (exactOptionalPropertyTypes)
      io.to(room).emit(EVENTS.CHECKPOINT_REQUEST, {
        checkpointId: checkpoint.checkpointId,
        type: checkpoint.type,
        prompt: `[WARNING: Response needed] ${checkpoint.prompt}`,
        ...(checkpoint.options && { options: checkpoint.options }),
        timeoutMs: 30000, // 30s remaining
      });
    }, 30000);

    // 60s pause per CONTEXT.md
    pauseTimer = setTimeout(() => {
      markCheckpointPaused(checkpoint.checkpointId);
      // Don't reject - just pause and wait indefinitely
      // User can still respond after pause
    }, 60000);

    // Poll for response (orchestrator.respondToCheckpoint will update the checkpoint)
    checkInterval = setInterval(() => {
      const cp = getCheckpoint(checkpoint.checkpointId);
      if (cp?.response) {
        cleanup();
        // Clear pending checkpoint from session
        session.pendingCheckpoint = undefined;
        resolve(cp.response);
      }
    }, 100);
  });
}

/**
 * Create a checkpoint and wait for response
 *
 * Convenience function that combines createCheckpoint and waitForCheckpointResponse.
 * Use this when the agent needs user input during execution.
 *
 * @param io - Socket.IO server instance
 * @param session - Agent session state
 * @param type - Checkpoint type (human-verify, decision, human-action)
 * @param prompt - User-facing prompt text
 * @param options - Optional decision options
 * @returns The user's response string
 */
export async function awaitCheckpoint(
  io: TypedServer,
  session: AgentSession,
  type: PendingCheckpoint['type'],
  prompt: string,
  options?: PendingCheckpoint['options']
): Promise<string> {
  const checkpoint = createCheckpoint(session.agentId, type, prompt, options);
  return waitForCheckpointResponse(io, session, checkpoint);
}

/**
 * Run the agent loop: stream Claude responses, execute tools, repeat until done
 *
 * This implements the agent loop pattern:
 * 1. Send messages to Claude with tool definitions
 * 2. Stream response tokens to WebSocket clients
 * 3. If tool use blocks in response, execute tools in parallel
 * 4. Feed tool results back to Claude
 * 5. Repeat until Claude completes without tool calls
 *
 * Per CONTEXT.md: parallel tool execution, feed errors to Claude
 *
 * @param io - Socket.IO server instance
 * @param session - Agent session state
 * @param systemPrompt - System prompt for Claude
 * @param userPrompt - Initial user prompt
 */
export async function runAgentLoop(
  io: TypedServer,
  session: AgentSession,
  systemPrompt: string,
  userPrompt: string
): Promise<void> {
  const room = `agent:${session.agentId}`;
  const ctx: ToolContext = {
    agentId: session.agentId,
    projectPath: session.projectPath,
  };

  // Initialize messages
  session.messages = [{ role: 'user', content: userPrompt }];

  // Emit start event
  io.to(room).emit(EVENTS.AGENT_START, {
    agentId: session.agentId,
    planId: session.planId,
    taskName: session.taskName,
  });

  try {
    while (true) {
      // Emit phase change to streaming
      session.status = 'streaming';
      io.to(room).emit(EVENTS.AGENT_PHASE, {
        agentId: session.agentId,
        phase: 'streaming',
        sequence: session.sequence++,
      });

      // Stream Claude response with retry for 429
      const response = await withRetry(async () => {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: session.messages,
          tools: GSD_TOOLS,
        });

        // Stream tokens to WebSocket clients
        // Per CONTEXT.md: batched tokens ~50ms - client handles RAF buffering
        stream.on('text', (text) => {
          io.to(room).emit(EVENTS.AGENT_TOKEN, {
            agentId: session.agentId,
            token: text,
            sequence: session.sequence++,
          });
        });

        return stream.finalMessage();
      });

      // Check for tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        // No more tool calls - extract text and complete
        const textBlocks = response.content.filter(
          (block): block is TextBlock => block.type === 'text'
        );
        const summary = textBlocks.map((b) => b.text).join('\n');

        session.status = 'complete';
        io.to(room).emit(EVENTS.AGENT_END, {
          agentId: session.agentId,
          status: 'success',
          summary: summary.substring(0, 500),
        });
        break;
      }

      // Emit phase change to tool_executing
      session.status = 'tool_executing';
      io.to(room).emit(EVENTS.AGENT_PHASE, {
        agentId: session.agentId,
        phase: 'tool_executing',
        sequence: session.sequence++,
      });

      // Execute tools in parallel per CONTEXT.md
      const toolResults: ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          const startTime = Date.now();

          // Emit tool start with full input per CONTEXT.md
          io.to(room).emit(EVENTS.TOOL_START, {
            agentId: session.agentId,
            toolId: toolUse.id,
            toolName: toolUse.name,
            input: toolUse.input,
            sequence: session.sequence++,
          });

          const result = await executeTool(
            toolUse.name,
            toolUse.input as Record<string, unknown>,
            ctx
          );

          const duration = Date.now() - startTime;

          // Emit tool end with full output per CONTEXT.md
          io.to(room).emit(EVENTS.TOOL_END, {
            agentId: session.agentId,
            toolId: toolUse.id,
            success: result.success,
            output: result.success ? result.output : result.error,
            duration,
            sequence: session.sequence++,
          });

          // Return tool result for Claude
          // Per CONTEXT.md: feed errors to Claude as tool results
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: result.success ? result.output : result.error,
            is_error: !result.success,
          };
        })
      );

      // Add assistant response and tool results to messages
      session.messages.push({ role: 'assistant', content: response.content });
      session.messages.push({ role: 'user', content: toolResults });
    }
  } catch (err) {
    session.status = 'error';
    const errorEvent = {
      agentId: session.agentId,
      code: 'ORCHESTRATOR_ERROR',
      message: (err as Error).message,
      recovery: 'Check API key and retry',
    };
    // Only include stack in non-production environments
    if (process.env['NODE_ENV'] !== 'production' && (err as Error).stack) {
      io.to(room).emit(EVENTS.AGENT_ERROR, {
        ...errorEvent,
        stack: (err as Error).stack!,
      });
    } else {
      io.to(room).emit(EVENTS.AGENT_ERROR, errorEvent);
    }
    io.to(room).emit(EVENTS.AGENT_END, {
      agentId: session.agentId,
      status: 'error',
    });
  }
}
