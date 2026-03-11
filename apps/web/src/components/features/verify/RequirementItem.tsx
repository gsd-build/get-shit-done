import { CheckCircle, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { TestResult } from '@/types/verification';
import { EvidenceTrail } from './EvidenceTrail';

interface RequirementItemProps {
  requirementId: string;
  requirementName: string;
  tests: TestResult[];
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * RequirementItem - Single requirement row with expand/collapse.
 *
 * Shows requirement ID, name, pass/fail badge, and test count.
 * Expands to show individual test results and evidence trail.
 */
export function RequirementItem({
  requirementId,
  requirementName,
  tests,
  isExpanded,
  onToggle,
}: RequirementItemProps) {
  const allPassed = tests.every((t) => t.passed);
  const passedCount = tests.filter((t) => t.passed).length;
  const failedTests = tests.filter((t) => !t.passed);

  return (
    <div className="border border-border rounded-lg mb-2 overflow-hidden">
      {/* Header - clickable to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
        aria-label={`${requirementId} ${requirementName}`}
      >
        {/* Expand/collapse icon */}
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        )}

        {/* Pass/fail icon */}
        {allPassed ? (
          <CheckCircle
            className="w-5 h-5 text-green-500 flex-shrink-0"
            data-testid="check-circle"
          />
        ) : (
          <XCircle
            className="w-5 h-5 text-red-500 flex-shrink-0"
            data-testid="x-circle"
          />
        )}

        {/* Requirement info */}
        <div className="flex-1 min-w-0">
          <span className="font-mono text-sm text-muted-foreground">
            {requirementId}
          </span>
          <span className="ml-2 text-foreground">{requirementName}</span>
        </div>

        {/* Test count badge */}
        <span
          className={clsx(
            'text-xs font-medium px-2 py-1 rounded',
            allPassed
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          )}
        >
          {passedCount}/{tests.length}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border bg-muted/20">
          {/* Individual test results */}
          <div className="mt-3 space-y-2">
            {tests.map((test, index) => (
              <div
                key={`${test.testName}-${index}`}
                className="flex items-center gap-2 text-sm"
              >
                {test.passed ? (
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="flex-1">{test.testName}</span>
                <span className="text-muted-foreground text-xs">
                  {test.duration}ms
                </span>
              </div>
            ))}
          </div>

          {/* Evidence trail for failed tests */}
          {failedTests.length > 0 && <EvidenceTrail testResults={failedTests} />}
        </div>
      )}
    </div>
  );
}
