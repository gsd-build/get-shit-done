/**
 * Mock agent loop for demo/testing purposes
 *
 * Simulates agent execution without actually calling Claude API.
 * Use when MOCK_EXECUTION=true or no ANTHROPIC_API_KEY is set.
 */

import { EVENTS } from '@gsd/events';
import type { TypedServer } from '../socket/server.js';
import type { AgentSession } from './types.js';

/**
 * Simulate tool execution with delay
 */
function simulateTool(
  name: string,
  durationMs: number
): Promise<{ success: boolean; output: string }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        output: `Mock ${name} completed successfully`,
      });
    }, durationMs);
  });
}

/**
 * Run mock agent loop for demo purposes
 *
 * Simulates a typical agent execution with:
 * - Initial streaming phase
 * - Tool execution (Read, Edit)
 * - Completion
 */
export async function runMockAgentLoop(
  io: TypedServer,
  session: AgentSession,
  _systemPrompt: string,
  _userPrompt: string
): Promise<void> {
  const room = `agent:${session.agentId}`;
  console.log(`[mock] Running mock agent loop for ${session.agentId}`);

  // Emit start event
  io.to(room).emit(EVENTS.AGENT_START, {
    agentId: session.agentId,
    planId: session.planId,
    taskName: session.taskName,
  });

  try {
    // Phase 1: Streaming (simulate thinking)
    session.status = 'streaming';
    io.to(room).emit(EVENTS.AGENT_PHASE, {
      agentId: session.agentId,
      phase: 'streaming',
      sequence: session.sequence++,
    });

    // Emit mock tokens
    const mockTokens = [
      'Analyzing the plan...\n',
      'I will implement the tasks step by step.\n\n',
      '## Task 1: Read existing code\n',
      'Let me examine the current implementation.\n',
    ];

    for (const token of mockTokens) {
      await new Promise((r) => setTimeout(r, 100));
      io.to(room).emit(EVENTS.AGENT_TOKEN, {
        agentId: session.agentId,
        token,
        sequence: session.sequence++,
      });
    }

    // Phase 2: Tool execution
    session.status = 'tool_executing';
    io.to(room).emit(EVENTS.AGENT_PHASE, {
      agentId: session.agentId,
      phase: 'tool_executing',
      sequence: session.sequence++,
    });

    // Simulate tool calls
    const mockTools = [
      { name: 'Read', input: { file_path: 'src/index.ts' }, duration: 500 },
      { name: 'Edit', input: { file_path: 'src/index.ts', changes: '...' }, duration: 800 },
    ];

    for (const tool of mockTools) {
      const toolId = `tool-${session.sequence}`;

      io.to(room).emit(EVENTS.TOOL_START, {
        agentId: session.agentId,
        toolId,
        toolName: tool.name,
        input: tool.input,
        sequence: session.sequence++,
      });

      const result = await simulateTool(tool.name, tool.duration);

      io.to(room).emit(EVENTS.TOOL_END, {
        agentId: session.agentId,
        toolId,
        success: result.success,
        output: result.output,
        duration: tool.duration,
        sequence: session.sequence++,
      });
    }

    // Phase 3: More streaming
    session.status = 'streaming';
    io.to(room).emit(EVENTS.AGENT_PHASE, {
      agentId: session.agentId,
      phase: 'streaming',
      sequence: session.sequence++,
    });

    const completionTokens = [
      '\n## Summary\n',
      'Successfully completed all tasks:\n',
      '- Read the existing code\n',
      '- Made the required changes\n',
      '- Verified the implementation\n',
    ];

    for (const token of completionTokens) {
      await new Promise((r) => setTimeout(r, 100));
      io.to(room).emit(EVENTS.AGENT_TOKEN, {
        agentId: session.agentId,
        token,
        sequence: session.sequence++,
      });
    }

    // Complete
    session.status = 'complete';
    io.to(room).emit(EVENTS.AGENT_END, {
      agentId: session.agentId,
      status: 'success',
      summary: 'Mock execution completed successfully',
    });

    console.log(`[mock] Agent ${session.agentId} completed`);
  } catch (err) {
    console.error(`[mock] Agent ${session.agentId} error:`, err);
    session.status = 'error';
    io.to(room).emit(EVENTS.AGENT_ERROR, {
      agentId: session.agentId,
      code: 'MOCK_ERROR',
      message: (err as Error).message,
      recovery: 'Retry the execution',
    });
    io.to(room).emit(EVENTS.AGENT_END, {
      agentId: session.agentId,
      status: 'error',
    });
  }
}
