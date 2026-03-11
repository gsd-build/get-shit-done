/**
 * ConflictDialog - Modal dialog for resolving edit conflicts
 *
 * Shows when Claude updates a decision while the user was editing it.
 * Displays side-by-side comparison and lets user choose which version to keep.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import clsx from 'clsx';

export type ConflictChoice = 'user' | 'claude';

interface ConflictDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** User's edited version */
  userVersion: string;
  /** Claude's updated version */
  claudeVersion: string;
  /** Called when user makes a choice */
  onResolve: (choice: ConflictChoice) => void;
}

/**
 * Compute simple word-level diff highlighting
 * Returns arrays of spans with added/removed/unchanged markers
 */
function computeDiff(
  oldText: string,
  newText: string
): { text: string; type: 'added' | 'removed' | 'unchanged' }[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Simple word comparison - mark differences
  const result: { text: string; type: 'added' | 'removed' | 'unchanged' }[] = [];

  const maxLen = Math.max(oldWords.length, newWords.length);
  let i = 0;

  while (i < maxLen) {
    const oldWord = oldWords[i] || '';
    const newWord = newWords[i] || '';

    if (oldWord === newWord) {
      if (oldWord) {
        result.push({ text: oldWord, type: 'unchanged' });
      }
    } else {
      if (oldWord) {
        result.push({ text: oldWord, type: 'removed' });
      }
      if (newWord) {
        result.push({ text: newWord, type: 'added' });
      }
    }
    i++;
  }

  return result;
}

export function ConflictDialog({
  isOpen,
  onClose,
  userVersion,
  claudeVersion,
  onResolve,
}: ConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  // Handle choice
  const handleKeepUser = useCallback(() => {
    onResolve('user');
    onClose();
  }, [onResolve, onClose]);

  const handleUseClaude = useCallback(() => {
    onResolve('claude');
    onClose();
  }, [onResolve, onClose]);

  // Compute diff for visual comparison
  const userDiff = computeDiff(claudeVersion, userVersion);
  const claudeDiff = computeDiff(userVersion, claudeVersion);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
        tabIndex={-1}
        className={clsx(
          'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
          'w-full max-w-2xl mx-4',
          'bg-background border border-border rounded-lg shadow-lg',
          'outline-none focus:ring-2 focus:ring-primary'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <h2
            id="conflict-dialog-title"
            className="text-lg font-semibold text-foreground"
          >
            Edit Conflict
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={clsx(
              'ml-auto p-1 rounded',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-muted transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Claude updated this decision while you were editing. Choose which version to keep:
          </p>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* User's version */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                Your edit:
              </h3>
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                {userDiff.map((segment, idx) => (
                  <span
                    key={idx}
                    className={clsx(
                      segment.type === 'added' &&
                        'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200',
                      segment.type === 'removed' &&
                        'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through'
                    )}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Claude's version */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-500" />
                Claude&apos;s update:
              </h3>
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-md text-sm">
                {claudeDiff.map((segment, idx) => (
                  <span
                    key={idx}
                    className={clsx(
                      segment.type === 'added' &&
                        'bg-green-200 dark:bg-green-900/50 text-green-800 dark:text-green-200',
                      segment.type === 'removed' &&
                        'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 line-through'
                    )}
                  >
                    {segment.text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button
            type="button"
            onClick={handleUseClaude}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium',
              'bg-muted text-foreground',
              'hover:bg-muted/80 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
            )}
          >
            Use Claude&apos;s
          </button>
          <button
            type="button"
            onClick={handleKeepUser}
            className={clsx(
              'px-4 py-2 rounded-md text-sm font-medium',
              'bg-primary text-primary-foreground',
              'hover:bg-primary/90 transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'inline-flex items-center gap-2'
            )}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Keep my edit
          </button>
        </div>
      </div>
    </>
  );
}
