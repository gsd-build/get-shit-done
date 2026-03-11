'use client';

import { memo, useCallback } from 'react';
import { Check } from 'lucide-react';
import clsx from 'clsx';
import type { QuestionOption } from '@/stores/discussStore';

interface QuestionCardProps {
  /** Message ID this card belongs to */
  messageId: string;
  /** Available options */
  options: QuestionOption[];
  /** Whether multiple selections allowed */
  multiSelect: boolean;
  /** Currently selected option IDs */
  selected: string[];
  /** Called when option is clicked */
  onSelect: (messageId: string, optionId: string) => void;
}

/**
 * Embedded question card with clickable options.
 *
 * - Multi-select: checkbox cards (click anywhere to toggle)
 * - Single-select: radio-like behavior (one selection at a time)
 * - Visual feedback on selection (border color change)
 * - Cards remain interactive after answering
 */
export const QuestionCard = memo(function QuestionCard({
  messageId,
  options,
  multiSelect,
  selected,
  onSelect,
}: QuestionCardProps) {
  const handleOptionClick = useCallback(
    (optionId: string) => {
      onSelect(messageId, optionId);
    },
    [messageId, onSelect]
  );

  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-muted/50 border border-border">
        <div className="text-sm text-muted-foreground mb-2">
          {multiSelect ? 'Select all that apply:' : 'Select one:'}
        </div>
        <div className="flex flex-col gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleOptionClick(option.id)}
                className={clsx(
                  'flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all',
                  'border-2',
                  isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:bg-muted'
                )}
              >
                <div
                  className={clsx(
                    'flex items-center justify-center w-5 h-5 rounded',
                    multiSelect ? 'rounded' : 'rounded-full',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'border-2 border-border'
                  )}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                </div>
                <span className="flex-1">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
