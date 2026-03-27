/**
 * Type declarations for @mariozechner/pi-coding-agent
 *
 * These are minimal type definitions for the Pi extension API.
 * Full types should be imported from the actual package when available.
 */

declare module "@mariozechner/pi-coding-agent" {
  export interface ExtensionAPI {
    on(event: string, handler: EventHandler): void;
    registerTool(tool: ToolDefinition): void;
    registerCommand(name: string, definition: CommandDefinition): void;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type EventHandler = (event: any, ctx: ExtensionContext) => void | Promise<void | BlockResult | any>;

  export interface ExtensionContext {
    ui: UIHelpers;
    session?: SessionInfo;
    runCommand(command: string): Promise<void>;
  }

  export interface UIHelpers {
    notify(message: string, level: 'info' | 'warning' | 'error'): void;
    setStatus(id: string, status: string): void;
    custom(config: CustomUIConfig): void;
    closeCustom(): void;
  }

  export interface CustomUIConfig {
    render: () => string;
    onKey: (key: string) => Promise<void>;
  }

  export interface SessionInfo {
    messages?: unknown[];
    contextUsage?: {
      percentUsed: number;
    };
    gsdActive?: boolean;
    gsdCommand?: string;
    parentAgent?: string;
  }

  export interface ToolDefinition {
    name: string;
    label: string;
    description: string;
    parameters: unknown; // TypeBox schema
    execute: ToolExecutor;
  }

  export type ToolExecutor = (
    toolCallId: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
    onUpdate: (update: unknown) => void,
    ctx: ExtensionContext
  ) => Promise<ToolResult>;

  export interface ToolResult {
    content: Array<{ type: 'text'; text: string }>;
    details?: Record<string, unknown>;
  }

  export interface CommandDefinition {
    description: string;
    handler: (args: string | undefined, ctx: ExtensionContext) => Promise<void>;
  }

  export interface BlockResult {
    block: boolean;
    reason: string;
  }

  // Tool event types
  export interface ToolCallEvent {
    toolName: string;
    input?: {
      path?: string;
      file?: string;
      content?: string;
      newText?: string;
    };
  }

  // Command event types
  export interface CommandEvent {
    command?: string;
  }
}