'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import type { CheckpointRequestEvent } from '@gsd/events';
import { CountdownTimer } from './CountdownTimer';

interface CheckpointModalProps {
  checkpoint: CheckpointRequestEvent | null;
  onRespond: (response: string) => void;
}

/**
 * Blocking checkpoint dialog modal.
 *
 * Displays checkpoint request from agent with:
 * - Countdown timer (if timeoutMs provided)
 * - Options as buttons OR free-form text input
 * - Proper accessibility (dialog role, focus management)
 */
export function CheckpointModal({ checkpoint, onRespond }: CheckpointModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);

  // Reset state when checkpoint changes
  useEffect(() => {
    setInputValue('');
    setIsSubmitting(false);
  }, [checkpoint?.checkpointId]);

  // Focus management: focus first interactive element when modal opens
  useEffect(() => {
    if (!checkpoint) return;

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      if (checkpoint.options && checkpoint.options.length > 0) {
        firstOptionRef.current?.focus();
      } else {
        inputRef.current?.focus();
      }
    });

    return () => cancelAnimationFrame(rafId);
  }, [checkpoint]);

  const handleOptionClick = useCallback(
    (optionId: string) => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      onRespond(optionId);
    },
    [isSubmitting, onRespond]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && inputValue.trim()) {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        onRespond(inputValue.trim());
      }
    },
    [inputValue, isSubmitting, onRespond]
  );

  const handleTimeout = useCallback(() => {
    // On timeout, could auto-submit default or notify
    // For now, just log - parent component handles timeout behavior
  }, []);

  if (!checkpoint) {
    return null;
  }

  const hasOptions = checkpoint.options && checkpoint.options.length > 0;

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="checkpoint-overlay"
          className="fixed inset-0 bg-black/50 z-50"
        />
        <Dialog.Content
          data-testid="checkpoint-modal"
          aria-modal="true"
          className={clsx(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'bg-card rounded-lg shadow-xl border border-border',
            'w-full max-w-md p-6',
            'focus:outline-none'
          )}
          onOpenAutoFocus={(e) => e.preventDefault()} // We handle focus manually
        >
          <div className="flex items-start gap-4">
            {/* Countdown timer */}
            {checkpoint.timeoutMs && (
              <CountdownTimer
                durationMs={checkpoint.timeoutMs}
                onTimeout={handleTimeout}
                className="flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold text-foreground mb-2">
                Checkpoint Required
              </Dialog.Title>

              <Dialog.Description className="text-sm text-muted-foreground mb-4">
                {checkpoint.prompt}
              </Dialog.Description>

              {/* Options or text input */}
              {hasOptions ? (
                <div className="flex flex-wrap gap-2">
                  {checkpoint.options!.map((option, index) => (
                    <button
                      key={option.id}
                      ref={index === 0 ? firstOptionRef : undefined}
                      type="button"
                      onClick={() => handleOptionClick(option.id)}
                      disabled={isSubmitting}
                      className={clsx(
                        'px-4 py-2 rounded-md text-sm font-medium',
                        'bg-primary text-primary-foreground',
                        'hover:bg-primary/90',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                        'transition-colors'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Type your response and press Enter"
                  disabled={isSubmitting}
                  className={clsx(
                    'w-full px-3 py-2 rounded-md text-sm',
                    'bg-background border border-input',
                    'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'placeholder:text-muted-foreground'
                  )}
                />
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
