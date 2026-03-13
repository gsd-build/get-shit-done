import clsx from 'clsx';
import type { Gap, Severity } from '@/types/verification';
import { SeverityBadge } from './SeverityBadge';

interface GapListProps {
  gaps: Gap[];
  filterSeverity?: Severity | 'all';
}

/**
 * Severity priority for sorting: blocking (0) > major (1) > minor (2)
 */
const severityPriority: Record<Severity, number> = {
  blocking: 0,
  major: 1,
  minor: 2,
};

/**
 * Border color based on severity for visual grouping.
 */
const borderColors: Record<Severity, string> = {
  blocking: 'border-l-red-500',
  major: 'border-l-orange-500',
  minor: 'border-l-yellow-400',
};

/**
 * List of gaps with severity badges.
 *
 * Displays gaps sorted by severity (blocking first, then major, then minor).
 * Supports filtering by severity level.
 */
export function GapList({ gaps, filterSeverity }: GapListProps) {
  // Filter gaps by severity if specified
  const filteredGaps =
    filterSeverity && filterSeverity !== 'all'
      ? gaps.filter((gap) => gap.severity === filterSeverity)
      : gaps;

  // Sort by severity priority
  const sortedGaps = [...filteredGaps].sort(
    (a, b) => severityPriority[a.severity] - severityPriority[b.severity]
  );

  // Empty state
  if (sortedGaps.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No gaps found
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {sortedGaps.map((gap) => (
        <li
          key={gap.id}
          className={clsx(
            'border-l-4 pl-3 py-2',
            borderColors[gap.severity]
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={gap.severity} />
            <span className="text-muted-foreground text-xs">
              {gap.requirementId}
            </span>
          </div>
          <p className="text-sm">{gap.description}</p>
        </li>
      ))}
    </ul>
  );
}
