import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { VerificationStatus } from '@/types/verification';

interface ReportHeaderProps {
  status: VerificationStatus;
  overallPassed: boolean | null;
  passedCount: number;
  failedCount: number;
  runningTest?: string;
  summary?: string;
  hasStaleResults?: boolean;
}

/**
 * ReportHeader - Big pass/fail summary at the top of verification report.
 *
 * Displays status (running/passed/failed) with large icon,
 * passed/failed counts, and optional summary text.
 */
export function ReportHeader({
  status,
  overallPassed,
  passedCount,
  failedCount,
  runningTest,
  summary,
  hasStaleResults = false,
}: ReportHeaderProps) {
  return (
    <div className="mb-6 p-6 bg-card rounded-lg border border-border">
      {/* Status Display */}
      <div className="flex items-center gap-4 mb-4">
        {status === 'running' ? (
          <>
            <Loader2
              className="w-10 h-10 text-blue-500 animate-spin"
              data-testid="loader"
            />
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                Verification Running...
              </h2>
              {runningTest && (
                <p className="text-muted-foreground text-sm mt-1">
                  Running: {runningTest}
                </p>
              )}
              {hasStaleResults && (
                <p className="text-amber-600 text-sm mt-1">
                  Showing stale results while new verification run is in progress.
                </p>
              )}
            </div>
          </>
        ) : overallPassed ? (
          <>
            <CheckCircle
              className="w-10 h-10 text-green-500"
              data-testid="check-circle"
            />
            <h2 className="text-2xl font-bold text-foreground">
              Verification Passed
            </h2>
          </>
        ) : (
          <>
            <XCircle
              className="w-10 h-10 text-red-500"
              data-testid="x-circle"
            />
            <h2 className="text-2xl font-bold text-foreground">
              Verification Failed
            </h2>
          </>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex gap-4 mb-3">
        <span
          className={clsx(
            'font-medium',
            passedCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
          )}
        >
          {passedCount} passed
        </span>
        <span
          className={clsx(
            'font-medium',
            failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
          )}
        >
          {failedCount} failed
        </span>
      </div>

      {/* Summary Text */}
      {summary && (
        <p className="text-muted-foreground">{summary}</p>
      )}
    </div>
  );
}
