'use client';

import { useState, useCallback, useMemo } from 'react';
import clsx from 'clsx';
import { GitCommit, ChevronDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Commit } from '@/stores/executionStore';

export interface CommitTimelineProps {
  /** Array of commits to display */
  commits: Commit[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * CommitTimeline component for displaying git commits made during execution.
 *
 * Features:
 * - Collapsible section: "X commits made [View]", hidden by default per CONTEXT.md
 * - Shows commit SHA (abbreviated), message, relative timestamp
 * - Commits sorted newest first
 * - Git-style vertical timeline with commit dots
 * - Truncates long commit messages with ellipsis
 */
export function CommitTimeline({ commits, className = '' }: CommitTimelineProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  // Sort commits newest first
  const sortedCommits = useMemo(() => {
    return [...commits].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [commits]);

  // Empty state
  if (commits.length === 0) {
    return (
      <div
        data-testid="commit-timeline-empty"
        className={clsx(
          'flex items-center gap-2 px-4 py-3',
          'text-sm text-zinc-500 dark:text-zinc-400',
          'border border-zinc-200 dark:border-zinc-700 rounded-lg',
          className
        )}
      >
        <GitCommit className="w-4 h-4" />
        <span>No commits yet</span>
      </div>
    );
  }

  const commitWord = commits.length === 1 ? 'commit' : 'commits';

  return (
    <div
      data-testid="commit-timeline"
      className={clsx(
        'border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50">
        <div className="flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {commits.length} {commitWord} made
          </span>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded text-sm',
            'text-blue-600 dark:text-blue-400',
            'hover:bg-blue-100 dark:hover:bg-blue-900/30',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
        >
          <span>{expanded ? 'Hide' : 'View'}</span>
          <ChevronDown
            className={clsx(
              'w-4 h-4 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </button>
      </div>

      {/* Expanded commit list */}
      {expanded && (
        <div data-testid="commit-list" className="relative px-4 py-2">
          {/* Timeline line */}
          <div
            data-testid="timeline-line"
            className="absolute left-7 top-4 bottom-4 w-0.5 bg-zinc-200 dark:bg-zinc-700"
          />

          {sortedCommits.map((commit, index) => (
            <div
              key={commit.sha}
              data-testid="commit-item"
              className={clsx(
                'relative flex items-start gap-3 py-2',
                index !== sortedCommits.length - 1 && 'pb-3'
              )}
            >
              {/* Commit dot */}
              <div
                data-testid="commit-dot"
                className={clsx(
                  'relative z-10 w-3 h-3 rounded-full',
                  'bg-blue-500 border-2 border-white dark:border-zinc-900',
                  'mt-1'
                )}
              />

              {/* Commit content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* SHA */}
                  <code className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                    {commit.sha.substring(0, 7)}
                  </code>
                  {/* Timestamp */}
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDistanceToNow(new Date(commit.timestamp), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                {/* Message */}
                <p
                  data-testid="commit-message"
                  className="text-sm text-zinc-700 dark:text-zinc-300 truncate mt-0.5"
                  title={commit.message}
                >
                  {commit.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CommitTimeline;
