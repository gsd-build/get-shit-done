'use client';

import { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import {
  FileText,
  Pencil,
  Terminal,
  FileEdit,
  Search,
  FileSearch,
  ChevronDown,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { CodePreview, getLanguageFromPath } from '@/components/ui/CodePreview';
import type { ToolCall, ToolName } from './types';

export interface ToolCardProps {
  /** Tool call data */
  tool: ToolCall;
  /** Initial expanded state */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon mapping for tool types
 */
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string; 'data-testid'?: string }>> = {
  Read: FileText,
  Write: Pencil,
  Bash: Terminal,
  Edit: FileEdit,
  Glob: Search,
  Grep: FileSearch,
};

const ICON_TEST_IDS: Record<string, string> = {
  Read: 'icon-file-text',
  Write: 'icon-pencil',
  Bash: 'icon-terminal',
  Edit: 'icon-file-edit',
  Glob: 'icon-search',
  Grep: 'icon-file-search',
};

/**
 * Get icon component for a tool name
 */
function getToolIcon(toolName: ToolName): React.ComponentType<{ className?: string; 'data-testid'?: string }> {
  return TOOL_ICONS[toolName] || FileText;
}

/**
 * Format duration in milliseconds to a human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Get file path from tool input
 */
function getFilePath(input: unknown): string | null {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (typeof obj['file_path'] === 'string') return obj['file_path'];
    if (typeof obj['path'] === 'string') return obj['path'];
  }
  return null;
}

/**
 * Get content for Write tool
 */
function getWriteContent(input: unknown): string | null {
  if (typeof input === 'object' && input !== null) {
    const obj = input as Record<string, unknown>;
    if (typeof obj['content'] === 'string') return obj['content'];
  }
  return null;
}

/**
 * Live elapsed timer component
 */
function ElapsedTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(Date.now() - startTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <span data-testid="elapsed-timer" className="text-sm text-blue-400 font-mono">
      {formatDuration(elapsed)}
    </span>
  );
}

/**
 * Status indicator component
 */
function StatusIndicator({ status }: { status: ToolCall['status'] }) {
  switch (status) {
    case 'running':
      return (
        <Loader2
          className="w-4 h-4 text-blue-500 animate-spin"
          data-testid="status-running"
        />
      );
    case 'success':
      return (
        <Check
          className="w-4 h-4 text-green-500"
          data-testid="status-success"
        />
      );
    case 'error':
      return (
        <X
          className="w-4 h-4 text-red-500"
          data-testid="status-error"
        />
      );
    default:
      return null;
  }
}

/**
 * Bash output display component
 */
function BashOutput({ output }: { output: string }) {
  return (
    <div
      data-testid="bash-output"
      className="bg-zinc-900 text-zinc-100 rounded-md p-4 font-mono text-sm overflow-auto max-h-80"
    >
      <pre className="whitespace-pre-wrap break-words">{output}</pre>
    </div>
  );
}

/**
 * ToolCard component for displaying tool execution details
 *
 * Features:
 * - Collapsible accordion behavior
 * - Tool type icons (Read, Write, Bash, etc.)
 * - Live elapsed timer while running
 * - Status indicators (running, success, error)
 * - CodePreview for file operations
 * - Scrollable output for Bash
 */
export function ToolCard({ tool, defaultExpanded = false, className }: ToolCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const Icon = getToolIcon(tool.toolName);
  const iconTestId = ICON_TEST_IDS[tool.toolName] || 'icon-default';
  const filePath = getFilePath(tool.input);
  const language = filePath ? getLanguageFromPath(filePath) : 'plaintext';

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle();
      }
    },
    [handleToggle]
  );

  // Determine what content to show
  const isFileOperation = ['Read', 'Write', 'Edit'].includes(tool.toolName);
  const isBash = tool.toolName === 'Bash';

  // Get content to display
  const getDisplayContent = () => {
    if (isFileOperation) {
      // For Write, show the content being written
      if (tool.toolName === 'Write') {
        const writeContent = getWriteContent(tool.input);
        return writeContent || tool.output || '';
      }
      // For Read/Edit, show the output (file contents)
      return tool.output || '';
    }
    return tool.output || '';
  };

  return (
    <div
      data-testid="tool-card"
      data-tool-id={tool.toolId}
      className={clsx(
        'border rounded-lg overflow-hidden transition-colors',
        {
          'border-blue-500 bg-blue-500/5': tool.status === 'running',
          'border-zinc-200 dark:border-zinc-700': tool.status === 'success',
          'border-red-500 bg-red-500/5': tool.status === 'error',
        },
        className
      )}
    >
      {/* Header */}
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        className={clsx(
          'w-full flex items-center gap-3 p-3 text-left',
          'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500'
        )}
      >
        <Icon className="w-5 h-5 text-zinc-500 flex-shrink-0" data-testid={iconTestId} />
        <span data-testid="tool-name" className="flex-1 font-medium text-sm">
          {tool.toolName}
          {filePath && (
            <span className="ml-2 text-zinc-500 font-normal font-mono text-xs truncate">
              {filePath}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <StatusIndicator status={tool.status} />
          {tool.status === 'running' ? (
            <ElapsedTimer startTime={tool.startTime} />
          ) : tool.duration !== undefined ? (
            <span className="text-sm text-zinc-500 font-mono">
              {formatDuration(tool.duration)}
            </span>
          ) : null}
          <ChevronDown
            className={clsx(
              'w-4 h-4 text-zinc-400 transition-transform',
              expanded && 'transform rotate-180'
            )}
          />
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div data-testid="tool-content" className="border-t border-zinc-200 dark:border-zinc-700 p-3">
          {isFileOperation && (
            <CodePreview
              content={getDisplayContent()}
              language={language}
              maxLines={10}
            />
          )}
          {isBash && tool.output && <BashOutput output={tool.output} />}
          {!isFileOperation && !isBash && tool.output && (
            <pre className="text-sm font-mono whitespace-pre-wrap bg-zinc-100 dark:bg-zinc-800 p-3 rounded">
              {tool.output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolCard;
