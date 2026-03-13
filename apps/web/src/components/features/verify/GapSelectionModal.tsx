'use client';

import * as Dialog from '@radix-ui/react-dialog';
import * as Checkbox from '@radix-ui/react-checkbox';
import { Check, X } from 'lucide-react';
import type { Gap } from '@/types/verification';
import { SeverityBadge } from './SeverityBadge';

interface GapSelectionModalProps {
  open: boolean;
  gaps: Gap[];
  selectedGaps: string[];
  onSelectionChange: (gapIds: string[]) => void;
  onConfirm: (gapIds: string[]) => void;
  onCancel: () => void;
}

/**
 * GapSelectionModal - Modal for selecting gaps when rejecting verification.
 *
 * Per CONTEXT.md: Rejection opens modal for gap selection.
 * Uses @radix-ui/react-dialog for accessible modal and @radix-ui/react-checkbox.
 */
export function GapSelectionModal({
  open,
  gaps,
  selectedGaps,
  onSelectionChange,
  onConfirm,
  onCancel,
}: GapSelectionModalProps) {
  const handleGapToggle = (gapId: string, checked: boolean | 'indeterminate') => {
    if (checked === 'indeterminate') return;

    if (checked) {
      onSelectionChange([...selectedGaps, gapId]);
    } else {
      onSelectionChange(selectedGaps.filter((id) => id !== gapId));
    }
  };

  const handleSelectAll = () => {
    onSelectionChange(gaps.map((g) => g.id));
  };

  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-lg max-w-lg w-full z-50 max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-foreground">
              Select Gaps to Address
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-sm text-muted-foreground mb-4">
            Select the gaps that need to be addressed. Plans will be created for each selected gap.
          </Dialog.Description>

          {/* Select All / Deselect All buttons */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-primary hover:underline"
            >
              Select All
            </button>
            <span className="text-muted-foreground">/</span>
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-sm text-primary hover:underline"
            >
              Deselect All
            </button>
          </div>

          {/* Gap list */}
          <div className="space-y-3 mb-6">
            {gaps.map((gap) => (
              <div
                key={gap.id}
                data-testid={`gap-item-${gap.id}`}
                className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox.Root
                  checked={selectedGaps.includes(gap.id)}
                  onCheckedChange={(checked) => handleGapToggle(gap.id, checked)}
                  className="w-5 h-5 border border-border rounded flex items-center justify-center shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-0.5"
                  aria-label={`Select gap: ${gap.description}`}
                >
                  <Checkbox.Indicator>
                    <Check className="w-3.5 h-3.5 text-primary-foreground" />
                  </Checkbox.Indicator>
                </Checkbox.Root>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={gap.severity} />
                    <span className="text-xs text-muted-foreground">
                      {gap.requirementId}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{gap.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedGaps)}
              disabled={selectedGaps.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Fix Plans
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
