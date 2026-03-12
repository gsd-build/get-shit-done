'use client';

import { useEffect, useState, useCallback } from 'react';
import { clsx } from 'clsx';

interface CountdownTimerProps {
  durationMs: number;
  onTimeout?: () => void;
  className?: string;
}

type TimerColor = 'green' | 'yellow' | 'red';

/**
 * Visual countdown timer with color transitions.
 *
 * Color states:
 * - Green: > 30s remaining
 * - Yellow: <= 30s remaining
 * - Red (pulsing): <= 10s remaining
 */
export function CountdownTimer({ durationMs, onTimeout, className }: CountdownTimerProps) {
  const [remainingMs, setRemainingMs] = useState(durationMs);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const getColor = useCallback((ms: number): TimerColor => {
    const seconds = ms / 1000;
    if (seconds > 30) return 'green';
    if (seconds > 10) return 'yellow';
    return 'red';
  }, []);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  }, []);

  useEffect(() => {
    if (remainingMs <= 0) {
      if (!hasTimedOut) {
        setHasTimedOut(true);
        onTimeout?.();
      }
      return;
    }

    const interval = setInterval(() => {
      setRemainingMs((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => clearInterval(interval);
  }, [remainingMs, hasTimedOut, onTimeout]);

  const color = getColor(remainingMs);
  const progress = remainingMs / durationMs;

  // SVG circle calculations
  const size = 48;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  const colorClasses: Record<TimerColor, string> = {
    green: 'stroke-green-500 text-green-600',
    yellow: 'stroke-yellow-500 text-yellow-600',
    red: 'stroke-red-500 text-red-600',
  };

  return (
    <div
      data-testid="countdown-timer"
      data-color={color}
      className={clsx('relative inline-flex items-center justify-center', className)}
    >
      <svg
        width={size}
        height={size}
        className={clsx(
          'transform -rotate-90',
          color === 'red' && 'animate-pulse'
        )}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={clsx('transition-all duration-100', colorClasses[color])}
        />
      </svg>
      <span
        className={clsx(
          'absolute text-xs font-medium',
          colorClasses[color]
        )}
      >
        {formatTime(remainingMs)}
      </span>
    </div>
  );
}
