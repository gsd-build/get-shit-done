'use client';

import type { ManualTest } from '@/types/verification';
import { ManualTestItem } from './ManualTestItem';

interface ManualChecklistProps {
  tests: ManualTest[];
  onTestUpdate: (testId: string, passed: boolean | null, note?: string) => void;
}

/**
 * ManualChecklist - Container for manual test checklist.
 *
 * Displays all manual test items with completion tracking.
 * Per CONTEXT.md: Checkboxes with optional notes for manual test checklist.
 */
export function ManualChecklist({ tests, onTestUpdate }: ManualChecklistProps) {
  // Count tests where passed !== null (both true and false count as complete)
  const completedCount = tests.filter((t) => t.passed !== null).length;

  if (tests.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-foreground">Manual Test Checklist</h3>
        <p className="text-sm text-muted-foreground">No manual tests required</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Manual Test Checklist</h3>
        <span className="text-sm text-muted-foreground">
          {completedCount} of {tests.length} complete
        </span>
      </div>

      <div className="space-y-3">
        {tests.map((test) => (
          <ManualTestItem
            key={test.id}
            test={test}
            onUpdate={(passed, note) => onTestUpdate(test.id, passed, note)}
          />
        ))}
      </div>
    </div>
  );
}
