import { clsx } from 'clsx';

interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({ value, showLabel = false, className }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      className={clsx(
        'relative h-2 w-full rounded-full bg-progress-bg overflow-hidden',
        className
      )}
    >
      <div
        data-testid="progress-fill"
        className="h-full bg-progress-fill transition-all duration-300"
        style={{ width: `${clampedValue}%` }}
      />
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {clampedValue}%
        </span>
      )}
    </div>
  );
}
