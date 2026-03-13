/**
 * AbortConfirmDialog tests
 * Tests for abort confirmation modal with rollback option
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AbortConfirmDialog } from './AbortConfirmDialog';

describe('AbortConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    filesModified: ['src/file1.ts', 'src/file2.ts'],
    commitCount: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open prop is true', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not render when open prop is false', () => {
    render(<AbortConfirmDialog {...defaultProps} open={false} />);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows list of files modified during execution', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    expect(screen.getByText('src/file1.ts')).toBeInTheDocument();
    expect(screen.getByText('src/file2.ts')).toBeInTheDocument();
  });

  it('shows truncated file list with count when more than 10 files', () => {
    const manyFiles = Array.from({ length: 15 }, (_, i) => `src/file${i + 1}.ts`);

    render(
      <AbortConfirmDialog
        {...defaultProps}
        filesModified={manyFiles}
      />
    );

    // Should show first 10 files
    expect(screen.getByText('src/file1.ts')).toBeInTheDocument();
    expect(screen.getByText('src/file10.ts')).toBeInTheDocument();

    // Should show "+5 more" indicator
    expect(screen.getByText(/\+5 more/i)).toBeInTheDocument();

    // Should not show files beyond 10
    expect(screen.queryByText('src/file11.ts')).not.toBeInTheDocument();
  });

  it('shows number of commits made', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    expect(screen.getByText(/2 commits/i)).toBeInTheDocument();
  });

  it('has Cancel button that closes dialog', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('has Abort button that calls onConfirm', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    const abortButton = screen.getByRole('button', { name: /^abort$/i });
    fireEvent.click(abortButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(false);
  });

  it('has Abort & Rollback button that calls onConfirm with rollback flag', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    const rollbackButton = screen.getByRole('button', { name: /abort.*rollback/i });
    fireEvent.click(rollbackButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith(true);
  });

  it('rollback button only shown when commits exist', () => {
    render(
      <AbortConfirmDialog
        {...defaultProps}
        commitCount={0}
      />
    );

    // Should not show rollback button when no commits
    expect(screen.queryByRole('button', { name: /rollback/i })).not.toBeInTheDocument();

    // Should still show basic abort button
    expect(screen.getByRole('button', { name: /abort/i })).toBeInTheDocument();
  });

  it('dialog is modal (blocks background interaction)', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    // Check for overlay/backdrop
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();

    // Dialog should have proper modal attributes
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('shows warning icon and title', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    expect(screen.getByText(/abort execution/i)).toBeInTheDocument();
  });

  it('shows commits will be kept message when there are commits', () => {
    render(<AbortConfirmDialog {...defaultProps} />);

    expect(screen.getByText(/2 commits will be kept/i)).toBeInTheDocument();
  });

  it('shows no commits message when there are no commits', () => {
    render(
      <AbortConfirmDialog
        {...defaultProps}
        commitCount={0}
      />
    );

    expect(screen.getByText(/no commits/i)).toBeInTheDocument();
  });

  it('shows empty file list message when no files modified', () => {
    render(
      <AbortConfirmDialog
        {...defaultProps}
        filesModified={[]}
      />
    );

    expect(screen.getByText(/no files modified/i)).toBeInTheDocument();
  });
});
