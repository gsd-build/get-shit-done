import type { ManualTest } from '@/types/verification';

interface ManualChecklistProps {
  tests: ManualTest[];
  onTestUpdate: (testId: string, passed: boolean | null, note?: string) => void;
}

/**
 * ManualChecklist - Container for manual test checklist.
 * Stub implementation - to be completed in GREEN phase.
 */
export function ManualChecklist({ tests, onTestUpdate }: ManualChecklistProps) {
  return <div data-testid="manual-checklist">TODO: Implement ManualChecklist</div>;
}
