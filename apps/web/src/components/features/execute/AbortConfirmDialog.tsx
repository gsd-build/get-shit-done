/**
 * AbortConfirmDialog component
 *
 * Confirmation modal for aborting execution with optional rollback.
 * Shows files modified and commits made, per CONTEXT.md requirements.
 */

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X, FileWarning } from 'lucide-react';

export interface AbortConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Callback when user confirms abort */
  onConfirm: (rollback: boolean) => void;
  /** List of files modified during execution */
  filesModified: string[];
  /** Number of commits made during execution */
  commitCount: number;
}

const MAX_VISIBLE_FILES = 10;

/**
 * Abort confirmation modal with rollback option.
 *
 * Per CONTEXT.md:
 * - Shows files modified and commits made
 * - Offers rollback option when commits exist
 * - Abort with rollback is destructive (red)
 * - Abort without rollback is cautionary (orange/yellow)
 */
export function AbortConfirmDialog({
  open,
  onClose,
  onConfirm,
  filesModified,
  commitCount,
}: AbortConfirmDialogProps) {
  const visibleFiles = filesModified.slice(0, MAX_VISIBLE_FILES);
  const hiddenCount = filesModified.length - MAX_VISIBLE_FILES;
  const hasCommits = commitCount > 0;

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-md w-full p-6 z-50"
          role="alertdialog"
          aria-modal="true"
        >
          {/* Header with warning icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <Dialog.Title className="text-lg font-semibold text-zinc-100">
              Abort Execution?
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="ml-auto p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-zinc-400 mb-4">
            This will stop the current execution. Any in-progress work will be interrupted.
          </Dialog.Description>

          {/* Files modified section */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
              <FileWarning className="w-4 h-4" />
              Files Modified
            </h4>
            {filesModified.length === 0 ? (
              <p className="text-sm text-zinc-500 italic">No files modified</p>
            ) : (
              <div className="bg-zinc-800/50 rounded-md p-2 max-h-40 overflow-auto">
                <ul className="text-sm text-zinc-400 font-mono space-y-1">
                  {visibleFiles.map((file) => (
                    <li key={file} className="truncate">
                      {file}
                    </li>
                  ))}
                </ul>
                {hiddenCount > 0 && (
                  <p className="text-sm text-zinc-500 mt-2">+{hiddenCount} more</p>
                )}
              </div>
            )}
          </div>

          {/* Commits section */}
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Commits:</span>
              {hasCommits ? (
                <span className="text-zinc-300">
                  {commitCount} commits will be kept
                </span>
              ) : (
                <span className="text-zinc-500 italic">No commits made</span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
            >
              Cancel
            </button>

            {hasCommits && (
              <button
                type="button"
                onClick={() => onConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
              >
                Abort & Rollback
              </button>
            )}

            <button
              type="button"
              onClick={() => onConfirm(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
            >
              Abort
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
