import {
  useVerificationStore,
  selectStatus,
  selectResults,
  selectOverallPassed,
  selectPassedCount,
  selectFailedCount,
  selectRunningTest,
  selectSummary,
  selectHasStaleResults,
} from '@/stores/verificationStore';
import { ReportHeader } from './ReportHeader';
import { RequirementList } from './RequirementList';

/**
 * VerificationPanel - Main container for verification report display.
 *
 * Integrates ReportHeader (big pass/fail summary) and RequirementList
 * (expandable requirement drill-down) using Zustand store state.
 */
export function VerificationPanel() {
  const status = useVerificationStore(selectStatus);
  const results = useVerificationStore(selectResults);
  const overallPassed = useVerificationStore(selectOverallPassed);
  const passedCount = useVerificationStore(selectPassedCount);
  const failedCount = useVerificationStore(selectFailedCount);
  const runningTest = useVerificationStore(selectRunningTest);
  const summary = useVerificationStore(selectSummary);
  const hasStaleResults = useVerificationStore(selectHasStaleResults);

  // Show loading skeleton when idle with no results
  if (status === 'idle' && results.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6" data-testid="verification-loading">
        <div className="animate-pulse">
          <div className="h-24 bg-muted rounded-lg mb-6" />
          <div className="space-y-3">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-16 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <ReportHeader
        status={status}
        overallPassed={overallPassed}
        passedCount={passedCount}
        failedCount={failedCount}
        {...(runningTest && { runningTest })}
        {...(summary && { summary })}
        hasStaleResults={hasStaleResults}
      />

      <RequirementList results={results} />
    </div>
  );
}
