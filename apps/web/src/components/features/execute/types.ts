/**
 * Tool call status type
 */
export type ToolCallStatus = 'running' | 'success' | 'error';

/**
 * Supported tool names for icon mapping
 */
export type ToolName = 'Read' | 'Write' | 'Bash' | 'Edit' | 'Glob' | 'Grep' | string;

/**
 * Tool call representation for the UI
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  toolId: string;
  /** Name of the tool (Read, Write, Bash, etc.) */
  toolName: ToolName;
  /** Tool input parameters */
  input: unknown;
  /** Tool output/result */
  output?: string;
  /** Whether the tool call succeeded */
  success?: boolean;
  /** Duration in milliseconds */
  duration?: number;
  /** When the tool started (Unix timestamp) */
  startTime: number;
  /** Current status */
  status: ToolCallStatus;
}
