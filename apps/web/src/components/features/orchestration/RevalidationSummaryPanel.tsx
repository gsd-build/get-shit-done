'use client';

import type { RevalidationSummary } from '@/lib/api';

interface RevalidationSummaryPanelProps {
  summary: RevalidationSummary | null;
}

export function RevalidationSummaryPanel({ summary }: RevalidationSummaryPanelProps) {
  if (!summary) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Resume Revalidation</h3>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            summary.passed
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
          }`}
        >
          {summary.passed ? 'Passed' : 'Failed'}
        </span>
      </div>

      {summary.changedTasks.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Changed tasks: {summary.changedTasks.join(', ')}
        </p>
      )}

      {summary.failures.length > 0 && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium">Failed checks ({summary.failures.length})</summary>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            {summary.failures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
        </details>
      )}

      {summary.recovery && !summary.passed && (
        <p className="mt-2 text-xs text-muted-foreground">
          Recovery paths available: {summary.recovery.retry.label} or{' '}
          {summary.recovery.fixPlan.label}.
        </p>
      )}
    </div>
  );
}
