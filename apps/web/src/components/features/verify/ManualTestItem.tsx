import type { ManualTest } from '@/types/verification';

interface ManualTestItemProps {
  test: ManualTest;
  onUpdate: (passed: boolean | null, note?: string) => void;
}

/**
 * ManualTestItem - Single manual test with checkbox and optional note.
 * Stub implementation - to be completed in GREEN phase.
 */
export function ManualTestItem({ test, onUpdate }: ManualTestItemProps) {
  return <div data-testid="manual-test-item">TODO: Implement ManualTestItem</div>;
}
