/**
 * Tool execution registry for agent orchestrator
 *
 * Provides tool definitions for Claude and handlers that execute them.
 * Per CONTEXT.md: parallel tool execution, feed errors to Claude as tool results.
 */

import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import type { ToolContext, ToolResult } from './types.js';
import { getHealth, getState, listPhases } from '@gsd/gsd-wrapper';
import { withFileLock } from '@gsd/gsd-core';
import { readFile, writeFile } from 'fs/promises';

/**
 * Tool definitions for Claude API
 * These define the schema Claude uses to invoke tools.
 */
export const GSD_TOOLS: Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
        content: { type: 'string', description: 'Content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'gsd_health',
    description: 'Get GSD project health status',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'gsd_state',
    description: 'Get GSD project state (current phase, progress)',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'gsd_phases',
    description: 'List phases in the GSD project',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

// Tool handler type
type ToolHandler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

/**
 * Tool handler implementations
 * Each handler returns a ToolResult (success/error discriminated union).
 */
const toolHandlers: Record<string, ToolHandler> = {
  async read_file(input, _ctx) {
    const path = input['path'] as string;
    if (!path) {
      return { success: false, error: 'Missing required parameter: path' };
    }

    try {
      const content = await readFile(path, 'utf-8');
      return { success: true, output: content };
    } catch (err) {
      return { success: false, error: `Failed to read file: ${(err as Error).message}` };
    }
  },

  async write_file(input, _ctx) {
    const path = input['path'] as string;
    const content = input['content'] as string;

    if (!path || content === undefined) {
      return { success: false, error: 'Missing required parameters: path, content' };
    }

    try {
      // Use file locking for .planning files per CONTEXT.md
      if (path.includes('.planning')) {
        await withFileLock(path, async () => {
          await writeFile(path, content, 'utf-8');
        });
      } else {
        await writeFile(path, content, 'utf-8');
      }

      return { success: true, output: `File written: ${path}` };
    } catch (err) {
      return { success: false, error: `Failed to write file: ${(err as Error).message}` };
    }
  },

  async gsd_health(_input, ctx) {
    const result = await getHealth(ctx.projectPath);
    if (!result.success) {
      return { success: false, error: result.error.message };
    }
    return { success: true, output: JSON.stringify(result.data, null, 2) };
  },

  async gsd_state(_input, ctx) {
    const result = await getState(ctx.projectPath);
    if (!result.success) {
      return { success: false, error: result.error.message };
    }
    return { success: true, output: JSON.stringify(result.data, null, 2) };
  },

  async gsd_phases(_input, ctx) {
    const result = await listPhases(ctx.projectPath);
    if (!result.success) {
      return { success: false, error: result.error.message };
    }
    return { success: true, output: JSON.stringify(result.data, null, 2) };
  },
};

/**
 * Execute a tool by name with the given input
 *
 * Per CONTEXT.md: Tool errors are returned to Claude as error tool results.
 * This allows Claude to reason about and recover from tool failures.
 *
 * @param toolName - Name of the tool to execute
 * @param input - Tool input parameters
 * @param ctx - Execution context (agentId, projectPath)
 * @returns ToolResult with success/error
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  const handler = toolHandlers[toolName];

  if (!handler) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  try {
    return await handler(input, ctx);
  } catch (err) {
    // Per CONTEXT.md: Feed tool errors to Claude as tool results
    return { success: false, error: `Tool execution error: ${(err as Error).message}` };
  }
}
