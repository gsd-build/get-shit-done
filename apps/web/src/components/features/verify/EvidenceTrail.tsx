import { XCircle } from 'lucide-react';
import type { TestResult } from '@/types/verification';

interface EvidenceTrailProps {
  testResults: TestResult[];
}

/**
 * EvidenceTrail - Displays expected vs actual for failed tests.
 *
 * Shows failed test results with their error messages,
 * formatted with visual indicators for failures.
 */
export function EvidenceTrail({ testResults }: EvidenceTrailProps) {
  // Filter to only failed tests
  const failedTests = testResults.filter((t) => !t.passed);

  if (failedTests.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mt-3">
      {failedTests.map((test, index) => (
        <div
          key={`${test.testName}-${index}`}
          className="border-l-4 border-red-500 pl-4 py-2"
        >
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="font-medium text-foreground">{test.testName}</span>
            <span className="text-xs text-muted-foreground">
              {test.duration}ms
            </span>
          </div>

          {test.message && (
            <div className="mt-2">
              {/* Check if message contains code-like content */}
              {test.message.includes('```') ||
              test.message.includes('Expected') ? (
                <pre className="bg-muted/50 p-3 rounded text-sm font-mono whitespace-pre-wrap overflow-x-auto">
                  {test.message}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">{test.message}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
