/**
 * AgentLane component - single horizontal agent lane with status, action, timer.
 * Part of the GitHub Actions-like swimlane visualization for research agents.
 */

import { useState } from 'react';
import { Loader2, CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import type { ResearchAgent, AgentStatus } from '@/types/plan';
import { AgentSummary } from './AgentSummary';

export interface AgentLaneProps {
  agent: ResearchAgent;
  onClick?: () => void;
}

/**
 * Format elapsed time in human-readable format.
 * Under 60s: "45s"
 * Over 60s: "2m 15s"
 */
function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

/**
 * Get border and background classes based on status.
 */
function getStatusClasses(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return 'border-border';
    case 'running':
      return 'border-primary bg-primary/5';
    case 'complete':
      return 'border-green-500/50 bg-green-50/50 dark:bg-green-900/10';
    case 'error':
      return 'border-red-500 bg-red-50 dark:bg-red-900/20';
  }
}

/**
 * Render status icon based on agent status.
 */
function StatusIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case 'pending':
      return (
        <div
          className="w-5 h-5 border-2 rounded-full border-muted-foreground/50"
          aria-label="Pending"
        />
      );
    case 'running':
      return (
        <Loader2
          data-testid="loader-icon"
          className="w-5 h-5 text-primary animate-spin"
          aria-label="Running"
        />
      );
    case 'complete':
      return (
        <CheckCircle
          data-testid="check-icon"
          className="w-5 h-5 text-green-500"
          aria-label="Complete"
        />
      );
    case 'error':
      return (
        <XCircle
          data-testid="x-icon"
          className="w-5 h-5 text-red-500"
          aria-label="Error"
        />
      );
  }
}

export function AgentLane({ agent, onClick }: AgentLaneProps) {
  const [expanded, setExpanded] = useState(false);

  const showExpandButton = agent.status === 'complete' && agent.summary;

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <article
      role="article"
      data-status={agent.status}
      onClick={onClick}
      className={clsx(
        'rounded-lg border p-3 transition-colors',
        getStatusClasses(agent.status),
        onClick && 'cursor-pointer hover:bg-muted/50'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0">
          <StatusIcon status={agent.status} />
        </div>

        {/* Agent Name */}
        <span className="font-medium text-sm min-w-[120px]">
          {agent.name}
        </span>

        {/* Current Action (truncated) - only when running */}
        {agent.status === 'running' && agent.currentAction && (
          <span className="text-sm text-muted-foreground truncate max-w-xs flex-1">
            {agent.currentAction}
          </span>
        )}

        {/* Error Message - inline for error status */}
        {agent.status === 'error' && agent.error && (
          <span className="text-sm text-red-600 dark:text-red-400 truncate flex-1">
            {agent.error}
          </span>
        )}

        {/* Spacer to push elapsed time to right */}
        {agent.status !== 'running' && agent.status !== 'error' && (
          <span className="flex-1" />
        )}

        {/* Elapsed Time */}
        <span className="text-sm text-muted-foreground font-mono flex-shrink-0">
          {formatElapsedTime(agent.elapsedMs)}
        </span>

        {/* Expand Button - only when complete with summary */}
        {showExpandButton && (
          <button
            type="button"
            onClick={handleExpand}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={expanded ? 'Collapse summary' : 'Expand summary'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Summary - expanded only */}
      {expanded && agent.summary && (
        <AgentSummary summary={agent.summary} />
      )}
    </article>
  );
}
