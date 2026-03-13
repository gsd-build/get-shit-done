import clsx from 'clsx';
import type { Severity } from '@/types/verification';

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

/**
 * Severity configuration for color-coded badges.
 * Per CONTEXT.md: red=Blocking, orange=Major, yellow=Minor
 */
const severityConfig: Record<
  Severity,
  { bg: string; text: string; label: string }
> = {
  blocking: { bg: 'bg-red-500', text: 'text-white', label: 'Blocking' },
  major: { bg: 'bg-orange-500', text: 'text-white', label: 'Major' },
  minor: { bg: 'bg-yellow-400', text: 'text-black', label: 'Minor' },
};

/**
 * Color-coded badge for gap severity.
 *
 * Displays severity level with appropriate background color:
 * - Blocking: Red background, white text
 * - Major: Orange background, white text
 * - Minor: Yellow background, black text
 */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
