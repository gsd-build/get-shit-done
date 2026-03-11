import type { Gap, Severity } from '@/types/verification';
import { SeverityBadge } from './SeverityBadge';

interface GapListProps {
  gaps: Gap[];
  filterSeverity?: Severity | 'all';
}

/**
 * List of gaps with severity badges.
 * Stub implementation - to be completed in GREEN phase.
 */
export function GapList({ gaps, filterSeverity }: GapListProps) {
  // Stub: return null to fail tests
  return null;
}
