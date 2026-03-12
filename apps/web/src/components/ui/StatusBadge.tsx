'use client';

import { clsx } from 'clsx';

export type StatusType = 'pending' | 'running' | 'complete' | 'error';

interface Props {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<StatusType, string> = {
  pending: 'bg-gray-400',
  running: 'bg-blue-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
} as const;

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
} as const;

export function StatusBadge({
  status,
  size = 'md',
  showPulse = true,
  className,
}: Props) {
  const isRunning = status === 'running';

  return (
    <span
      data-testid="status-badge"
      className={clsx(
        'inline-block rounded-full',
        STATUS_COLORS[status],
        SIZE_CLASSES[size],
        isRunning && showPulse && 'animate-pulse',
        className
      )}
      role="status"
      aria-label={`Status: ${status}`}
    />
  );
}
