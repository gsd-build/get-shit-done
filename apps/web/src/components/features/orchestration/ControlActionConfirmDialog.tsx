'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import type { OrchestrationAction } from '@/lib/api';

const ACTION_LABELS: Record<OrchestrationAction, string> = {
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  abort: 'Abort',
  retryFailedStep: 'Retry Failed Step',
  rerunFromCheckpoint: 'Re-run From Checkpoint',
  stopNow: 'Stop Now',
  cancelAndStartNew: 'Cancel and Start New',
};

export interface ControlActionConfirmDialogProps {
  open: boolean;
  action: OrchestrationAction;
  runName: string;
  details?: string[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ControlActionConfirmDialog({
  open,
  action,
  runName,
  details = [],
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ControlActionConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-card border border-border p-5 z-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm {ACTION_LABELS[action]}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mt-1">
                This action will affect <span className="font-medium text-foreground">{runName}</span>.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={onCancel}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close confirmation dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {details.length > 0 && (
            <details className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">Impact details</summary>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-10 px-3 rounded-md border border-border text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="min-h-10 px-3 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Applying…' : ACTION_LABELS[action]}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
