'use client';

import { useState, useCallback } from 'react';
import clsx from 'clsx';
import { AlertCircle, ChevronDown, Loader2 } from 'lucide-react';
import type { AgentErrorEvent } from '@gsd/events';
import { useErrorRecovery, type RetryContext } from '@/hooks/useErrorRecovery';

export interface ErrorRecoveryProps {
  /** The error event from agent execution */
  error: AgentErrorEvent;
  /** Context for retry operations */
  context: RetryContext;
  /** Optional callback when user dismisses the error UI */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ErrorRecovery component for displaying execution errors with retry options.
 *
 * Features:
 * - Prominent error message display
 * - Error code badge in monospace
 * - Recovery suggestion highlighting
 * - Expandable stack trace
 * - Context summary (plan, task)
 * - Retry buttons with loading states
 */
export function ErrorRecovery({
  error,
  context,
  onDismiss,
  className,
}: ErrorRecoveryProps) {
  const [showStackTrace, setShowStackTrace] = useState(false);
  const { retryFromCurrentTask, retryFromBeginning, isRetrying } =
    useErrorRecovery(error, context);

  const handleToggleStackTrace = useCallback(() => {
    setShowStackTrace((prev) => !prev);
  }, []);

  const handleRetry = useCallback(async () => {
    await retryFromCurrentTask();
  }, [retryFromCurrentTask]);

  const handleRetryFromBeginning = useCallback(async () => {
    await retryFromBeginning();
  }, [retryFromBeginning]);

  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  return (
    <div
      data-testid="error-recovery"
      role="alert"
      className={clsx(
        'border border-red-500 rounded-lg bg-red-500/5 p-4',
        className
      )}
    >
      {/* Header with error icon */}
      <div className="flex items-start gap-3 mb-4">
        <AlertCircle
          data-testid="error-icon"
          className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-1">
            Execution Error
          </h3>
          {/* Error code badge */}
          {error.code && (
            <span
              data-testid="error-code-badge"
              className="inline-block px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-mono rounded mb-2"
            >
              {error.code}
            </span>
          )}
          {/* Error message */}
          <p className="text-zinc-800 dark:text-zinc-200">{error.message}</p>
        </div>
      </div>

      {/* Recovery suggestion */}
      {error.recovery && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <h4 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1">
            Suggested Recovery
          </h4>
          <p className="text-sm text-blue-600 dark:text-blue-300">
            {error.recovery}
          </p>
        </div>
      )}

      {/* Stack trace toggle */}
      {error.stack && (
        <div className="mb-4">
          <button
            onClick={handleToggleStackTrace}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <ChevronDown
              className={clsx(
                'w-4 h-4 transition-transform',
                showStackTrace && 'rotate-180'
              )}
            />
            View Details
          </button>
          {showStackTrace && (
            <div
              data-testid="stack-trace"
              className="mt-2 p-3 bg-zinc-900 text-zinc-100 rounded-md overflow-auto max-h-60"
            >
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {error.stack}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Context summary */}
      <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-md">
        <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
          Execution Context
        </h4>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">Plan:</dt>
          <dd className="text-zinc-800 dark:text-zinc-200 font-mono">
            {context.planId}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">Task:</dt>
          <dd className="text-zinc-800 dark:text-zinc-200">{context.taskName}</dd>
        </dl>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className={clsx(
            'px-4 py-2 rounded-md font-medium transition-colors',
            'bg-red-600 text-white hover:bg-red-700',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center gap-2'
          )}
        >
          {isRetrying && <Loader2 className="w-4 h-4 animate-spin" />}
          Retry
        </button>
        <button
          onClick={handleRetryFromBeginning}
          disabled={isRetrying}
          className={clsx(
            'px-4 py-2 rounded-md font-medium transition-colors',
            'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200',
            'hover:bg-zinc-300 dark:hover:bg-zinc-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          Retry from Beginning
        </button>
        <button
          onClick={handleDismiss}
          className={clsx(
            'px-4 py-2 rounded-md font-medium transition-colors',
            'text-zinc-600 dark:text-zinc-400',
            'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          )}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default ErrorRecovery;
