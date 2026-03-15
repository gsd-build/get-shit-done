import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApprovalBar } from './ApprovalBar';
import type { Gap } from '@/types/verification';

const mockGaps: Gap[] = [
  { id: 'gap-1', requirementId: 'REQ-01', description: 'Missing error handling', severity: 'major' },
  { id: 'gap-2', requirementId: 'REQ-02', description: 'Critical bug', severity: 'blocking' },
];

const nonBlockingGaps: Gap[] = [
  { id: 'gap-1', requirementId: 'REQ-01', description: 'Missing docs', severity: 'minor' },
];

describe('ApprovalBar', () => {
  it('renders Approve and Reject buttons', () => {
    render(
      <ApprovalBar
        gaps={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
  });

  it('Approve is enabled even when major/blocking gaps exist if lifecycle gate allows it', () => {
    render(
      <ApprovalBar
        gaps={mockGaps}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).not.toBeDisabled();
  });

  it('Approve enabled when only minor gaps exist', () => {
    render(
      <ApprovalBar
        gaps={nonBlockingGaps}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    const approveButton = screen.getByRole('button', { name: /approve/i });
    expect(approveButton).not.toBeDisabled();
  });

  it('shows lifecycle guidance only when disabled by parent gate', () => {
    render(
      <ApprovalBar
        gaps={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        disabled
      />
    );
    expect(
      screen.getByText(/approval available only after verification completes with results/i)
    ).toBeInTheDocument();
  });

  it('clicking Reject opens gap selection modal', async () => {
    render(
      <ApprovalBar
        gaps={mockGaps}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(screen.getByText('Select Gaps to Address')).toBeInTheDocument();
  });

  it('clicking Approve opens confirmation modal', async () => {
    render(
      <ApprovalBar
        gaps={nonBlockingGaps}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(screen.getByText(/are you sure you want to approve/i)).toBeInTheDocument();
  });

  it('confirming approval calls onApprove', async () => {
    const onApprove = vi.fn();
    render(
      <ApprovalBar
        gaps={nonBlockingGaps}
        onApprove={onApprove}
        onReject={vi.fn()}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /^approve$/i }));
    // Find the confirmation dialog
    const dialog = screen.getByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: /confirm approval/i });
    await userEvent.click(confirmButton);
    expect(onApprove).toHaveBeenCalled();
  });

  it('selecting gaps and confirming calls onReject with gap IDs', async () => {
    const onReject = vi.fn();
    render(
      <ApprovalBar
        gaps={mockGaps}
        onApprove={vi.fn()}
        onReject={onReject}
      />
    );
    // Open reject modal
    await userEvent.click(screen.getByRole('button', { name: /reject/i }));

    // Select all gaps - use getByText for exact match
    await userEvent.click(screen.getByText('Select All'));

    // Confirm
    await userEvent.click(screen.getByRole('button', { name: /create fix plans/i }));

    expect(onReject).toHaveBeenCalledWith(['gap-1', 'gap-2']);
  });
});
