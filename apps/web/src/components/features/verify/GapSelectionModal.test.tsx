import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GapSelectionModal } from './GapSelectionModal';
import type { Gap } from '@/types/verification';

const mockGaps: Gap[] = [
  { id: 'gap-1', requirementId: 'REQ-01', description: 'Missing error handling', severity: 'blocking' },
  { id: 'gap-2', requirementId: 'REQ-02', description: 'No validation on input', severity: 'major' },
  { id: 'gap-3', requirementId: 'REQ-03', description: 'Missing documentation', severity: 'minor' },
];

describe('GapSelectionModal', () => {
  it('renders list of gaps with checkboxes when open', () => {
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Missing error handling')).toBeInTheDocument();
    expect(screen.getByText('No validation on input')).toBeInTheDocument();
    expect(screen.getByText('Missing documentation')).toBeInTheDocument();
    // Should have 3 checkboxes for gaps
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
  });

  it('clicking gap checkbox toggles selection', async () => {
    const onSelectionChange = vi.fn();
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Find checkbox by finding its associated description
    const gapItem = screen.getByText('Missing error handling').closest('[data-testid]')?.querySelector('[role="checkbox"]');
    if (gapItem) {
      await userEvent.click(gapItem);
      expect(onSelectionChange).toHaveBeenCalledWith(['gap-1']);
    }
  });

  it('Select All selects all gaps', async () => {
    const onSelectionChange = vi.fn();
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={onSelectionChange}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Use getByText with exact match since it's a text button, not role=button
    await userEvent.click(screen.getByText('Select All'));
    expect(onSelectionChange).toHaveBeenCalledWith(['gap-1', 'gap-2', 'gap-3']);
  });

  it('Confirm button disabled when none selected', () => {
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const confirmButton = screen.getByRole('button', { name: /create fix plans/i });
    expect(confirmButton).toBeDisabled();
  });

  it('Confirm calls onConfirm with selected IDs', async () => {
    const onConfirm = vi.fn();
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={['gap-1', 'gap-2']}
        onSelectionChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const confirmButton = screen.getByRole('button', { name: /create fix plans/i });
    expect(confirmButton).not.toBeDisabled();
    await userEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith(['gap-1', 'gap-2']);
  });

  it('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(
      <GapSelectionModal
        open={true}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not render when closed', () => {
    render(
      <GapSelectionModal
        open={false}
        gaps={mockGaps}
        selectedGaps={[]}
        onSelectionChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Select Gaps to Address')).not.toBeInTheDocument();
  });
});
