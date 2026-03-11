/**
 * Orchestrator types for Claude API streaming and tool execution
 */

import type { MessageParam, Tool, ToolUseBlock, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';

/**
 * Agent session state - tracks the lifecycle of an agent execution
 */
export interface AgentSession {
  agentId: string;
  projectPath: string;
  planId: string;
  taskName: string;
  status: 'idle' | 'streaming' | 'tool_executing' | 'awaiting_checkpoint' | 'complete' | 'error';
  sequence: number; // Global sequence for ordering events
  messages: MessageParam[];
  pendingCheckpoint?: string | undefined;
}

/**
 * Tool execution context - provides project context to tool handlers
 */
export interface ToolContext {
  agentId: string;
  projectPath: string;
}

/**
 * Tool result with success/error discriminated union
 * Per CONTEXT.md: feed errors to Claude as tool results
 */
export type ToolResult =
  | { success: true; output: string }
  | { success: false; error: string };

/**
 * Orchestrator internal events - used for event dispatch
 */
export type OrchestratorEvent =
  | { type: 'token'; token: string; sequence: number }
  | { type: 'tool_start'; toolName: string; toolId: string }
  | { type: 'tool_end'; toolId: string; result: ToolResult }
  | { type: 'phase'; phase: AgentSession['status'] }
  | { type: 'complete'; summary?: string | undefined }
  | { type: 'error'; code: string; message: string };

// Re-export SDK types for convenience
export type { MessageParam, Tool, ToolUseBlock, ToolResultBlockParam };
