'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { ToolCard } from './ToolCard';
import type { ToolCall } from './types';

export interface ToolCardListProps {
  /** Array of tool calls to display */
  tools: ToolCall[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Sort tools by status: running first, then completed (success/error)
 */
function sortByStatus(tools: ToolCall[]): ToolCall[] {
  return [...tools].sort((a, b) => {
    // Running tools come first
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    // Then error (more important to see)
    if (a.status === 'error' && b.status === 'success') return -1;
    if (b.status === 'error' && a.status === 'success') return 1;
    // Keep original order otherwise
    return 0;
  });
}

/**
 * ToolCardList component for displaying multiple tool calls
 *
 * Features:
 * - Renders a list of ToolCard components
 * - Groups by status (running first, then completed)
 * - Vertical stacking with consistent spacing
 */
export function ToolCardList({ tools, className }: ToolCardListProps) {
  const sortedTools = useMemo(() => sortByStatus(tools), [tools]);

  if (tools.length === 0) {
    return null;
  }

  return (
    <div className={clsx('space-y-2', className)}>
      {sortedTools.map((tool) => (
        <ToolCard key={tool.toolId} tool={tool} />
      ))}
    </div>
  );
}

export default ToolCardList;
