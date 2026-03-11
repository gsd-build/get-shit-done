'use client';

import { memo } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/** Topic step in the progress stepper */
export interface TopicStep {
  id: string;
  label: string;
  completed: boolean;
}

interface ProgressStepperProps {
  /** List of topic steps */
  steps: TopicStep[];
  /** Current topic index */
  currentIndex: number;
  /** Called when a step is clicked */
  onStepClick?: (index: number) => void;
}

/** Default discuss phase topics per CONTEXT.md */
export const DEFAULT_TOPICS: TopicStep[] = [
  { id: 'chat-ui', label: 'Chat UI', completed: false },
  { id: 'preview', label: 'Preview', completed: false },
  { id: 'locking', label: 'Locking', completed: false },
  { id: 'session', label: 'Session', completed: false },
];

/**
 * Progress stepper showing conversation topics.
 *
 * - Check marks for completed topics
 * - Arrow indicator for current topic
 * - Clickable to navigate to any topic
 */
export const ProgressStepper = memo(function ProgressStepper({
  steps,
  currentIndex,
  onStepClick,
}: ProgressStepperProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-muted/50 border-b border-border overflow-x-auto">
      {steps.map((step, index) => {
        const isCurrent = index === currentIndex;
        const isCompleted = step.completed;
        const isClickable = onStepClick !== undefined;

        return (
          <div key={step.id} className="flex items-center">
            {index > 0 && (
              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1 flex-shrink-0" />
            )}
            <button
              type="button"
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={clsx(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-sm whitespace-nowrap transition-colors',
                isClickable && 'hover:bg-muted cursor-pointer',
                !isClickable && 'cursor-default',
                isCurrent && 'font-semibold text-primary',
                !isCurrent && isCompleted && 'text-foreground',
                !isCurrent && !isCompleted && 'text-muted-foreground'
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : isCurrent ? (
                <ChevronRight className="w-4 h-4 text-primary" />
              ) : (
                <span className="w-4 h-4 flex items-center justify-center text-xs opacity-60">
                  {index + 1}
                </span>
              )}
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
});
