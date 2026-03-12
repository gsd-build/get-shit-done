/**
 * TddIndicator component
 *
 * Displays 3-step TDD progress: Red > Green > Refactor
 * Per CONTEXT.md: "TDD phase shown in execution header as 3-step progress: Red > Green > Refactor"
 */

'use client';

import clsx from 'clsx';

export interface TddIndicatorProps {
  /** Current TDD phase or null if not a TDD execution */
  phase: 'red' | 'green' | 'refactor' | null;
}

const phases = [
  {
    id: 'red',
    label: 'Red',
    color: 'bg-red-500',
    activeColor: 'bg-red-600 ring-2 ring-red-400',
    textColor: 'text-red-600 dark:text-red-400',
  },
  {
    id: 'green',
    label: 'Green',
    color: 'bg-green-500',
    activeColor: 'bg-green-600 ring-2 ring-green-400',
    textColor: 'text-green-600 dark:text-green-400',
  },
  {
    id: 'refactor',
    label: 'Refactor',
    color: 'bg-blue-500',
    activeColor: 'bg-blue-600 ring-2 ring-blue-400',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
] as const;

type PhaseId = (typeof phases)[number]['id'];

/**
 * 3-step TDD progress indicator.
 *
 * Visual layout:
 * - Horizontal row of 3 numbered circles
 * - Connecting lines between circles
 * - Labels below each circle
 * - Active step is highlighted with ring
 * - Completed steps have solid color
 * - Future steps are gray
 */
export function TddIndicator({ phase }: TddIndicatorProps) {
  // Return null for non-TDD executions
  if (phase === null) {
    return null;
  }

  const phaseIndex = phases.findIndex((p) => p.id === phase);
  const phaseLabel = phases[phaseIndex]?.label ?? phase;

  const getPhaseState = (idx: number): 'active' | 'past' | 'future' => {
    if (idx === phaseIndex) return 'active';
    if (idx < phaseIndex) return 'past';
    return 'future';
  };

  return (
    <div
      data-testid="tdd-indicator"
      role="group"
      aria-label={`TDD progress: ${phaseLabel} phase`}
      className="flex items-center gap-1"
    >
      {phases.map((p, idx) => {
        const state = getPhaseState(idx);
        const isActive = state === 'active';
        const isPast = state === 'past';
        const isFuture = state === 'future';

        return (
          <div key={p.id} className="flex items-center">
            {/* Step indicator */}
            <div
              data-testid={`step-${p.id}`}
              className="flex flex-col items-center"
              {...(isActive && { 'aria-current': 'step' })}
            >
              {/* Numbered circle */}
              <div
                data-testid="step-circle"
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  // Active state: highlighted with ring
                  isActive && p.activeColor,
                  isActive && 'text-white',
                  // Past state: solid color
                  isPast && p.color,
                  isPast && 'text-white',
                  // Future state: gray/muted
                  isFuture && 'bg-zinc-300 dark:bg-zinc-600',
                  isFuture && 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {idx + 1}
              </div>

              {/* Label */}
              <span
                data-testid={`step-label-${p.id}`}
                className={clsx(
                  'text-xs mt-1 transition-colors',
                  // Active: bold and colored
                  isActive && 'font-semibold',
                  isActive && p.textColor,
                  // Past: normal weight, colored
                  isPast && 'font-normal',
                  isPast && p.textColor,
                  // Future: muted
                  isFuture && 'font-normal text-zinc-400 dark:text-zinc-500'
                )}
              >
                {p.label}
              </span>
            </div>

            {/* Connector line (not after last item) */}
            {idx < phases.length - 1 && (
              <div
                data-testid="connector"
                className={clsx(
                  'w-6 h-0.5 mx-1 mb-4 transition-colors',
                  // Connector is colored if the next step is current or past
                  idx < phaseIndex
                    ? 'bg-zinc-400 dark:bg-zinc-500'
                    : 'bg-zinc-200 dark:bg-zinc-700'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default TddIndicator;
