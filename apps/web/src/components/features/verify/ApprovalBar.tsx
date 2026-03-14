'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, X } from 'lucide-react';
import type { Gap } from '@/types/verification';
import { GapSelectionModal } from './GapSelectionModal';

interface ApprovalBarProps {
  gaps: Gap[];
  onApprove: () => void;
  onReject: (selectedGapIds: string[]) => void;
  disabled?: boolean;
}

/**
 * ApprovalBar - Approve/Reject action bar with two-step confirmation.
 *
 * Per CONTEXT.md: Two-step confirmation for approval/rejection.
 * - Approve: Disabled when blocking gaps exist, shows confirmation dialog
 * - Reject: Opens GapSelectionModal to select gaps for fix plans
 */
export function ApprovalBar({ gaps, onApprove, onReject, disabled = false }: ApprovalBarProps) {
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedGaps, setSelectedGaps] = useState<string[]>([]);

  const hasBlockingOrMajorGaps = gaps.some(
    (g) => g.severity === 'blocking' || g.severity === 'major'
  );
  const isApproveDisabled = disabled || hasBlockingOrMajorGaps;

  const handleApproveClick = () => {
    setShowApproveConfirm(true);
  };

  const handleConfirmApproval = () => {
    setShowApproveConfirm(false);
    onApprove();
  };

  const handleRejectClick = () => {
    setSelectedGaps([]);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = (gapIds: string[]) => {
    setShowRejectModal(false);
    onReject(gapIds);
  };

  const handleRejectCancel = () => {
    setShowRejectModal(false);
    setSelectedGaps([]);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 z-30">
        <div className="flex justify-end gap-3 max-w-4xl mx-auto">
          <button
            type="button"
            onClick={handleRejectClick}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Reject with Gaps
          </button>
          <button
            type="button"
            onClick={handleApproveClick}
            disabled={isApproveDisabled}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Approve
          </button>
        </div>
        {isApproveDisabled && (
          <p className="max-w-4xl mx-auto mt-2 text-xs text-orange-600 text-right">
            {disabled
              ? 'Approval available only after verification completes with results.'
              : 'Resolve major or blocking gaps before approval.'}
          </p>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <Dialog.Root open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card p-6 rounded-lg shadow-lg max-w-md w-full z-50">
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                Confirm Approval
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

            <Dialog.Description asChild>
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm text-foreground mb-2">
                    Are you sure you want to approve this phase?
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This will mark all requirements as completed.
                  </p>
                </div>
              </div>
            </Dialog.Description>

            <div className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
              >
                Confirm Approval
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Gap Selection Modal */}
      <GapSelectionModal
        open={showRejectModal}
        gaps={gaps}
        selectedGaps={selectedGaps}
        onSelectionChange={setSelectedGaps}
        onConfirm={handleRejectConfirm}
        onCancel={handleRejectCancel}
      />
    </>
  );
}
