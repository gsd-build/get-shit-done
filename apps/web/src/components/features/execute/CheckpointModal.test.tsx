import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckpointModal } from './CheckpointModal';
import type { CheckpointRequestEvent } from '@gsd/events';

// Mock checkpoint data
const mockCheckpoint: CheckpointRequestEvent = {
  checkpointId: 'cp-123',
  type: 'human-verify',
  prompt: 'Please verify the deployment looks correct',
  options: undefined,
  timeoutMs: 60000,
};

const mockCheckpointWithOptions: CheckpointRequestEvent = {
  checkpointId: 'cp-456',
  type: 'decision',
  prompt: 'Which database should we use?',
  options: [
    { id: 'postgres', label: 'PostgreSQL' },
    { id: 'sqlite', label: 'SQLite' },
    { id: 'mongo', label: 'MongoDB' },
  ],
  timeoutMs: 120000,
};

const mockCheckpointNoTimeout: CheckpointRequestEvent = {
  checkpointId: 'cp-789',
  type: 'human-action',
  prompt: 'Please click the verification link in your email',
  options: undefined,
  timeoutMs: undefined,
};

describe('CheckpointModal', () => {
  let onRespond: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onRespond = vi.fn();
  });

  describe('Visibility', () => {
    it('renders modal when checkpoint prop is provided', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('does not render modal when checkpoint is null', () => {
      render(<CheckpointModal checkpoint={null} onRespond={onRespond} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('has overlay blocking background', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      const overlay = screen.getByTestId('checkpoint-overlay');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('bg-black/50');
    });
  });

  describe('Content', () => {
    it('shows "Checkpoint Required" title', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByText('Checkpoint Required')).toBeInTheDocument();
    });

    it('shows checkpoint prompt text', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByText('Please verify the deployment looks correct')).toBeInTheDocument();
    });

    it('renders option buttons when options are provided', () => {
      render(<CheckpointModal checkpoint={mockCheckpointWithOptions} onRespond={onRespond} />);
      expect(screen.getByRole('button', { name: 'PostgreSQL' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'SQLite' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'MongoDB' })).toBeInTheDocument();
    });

    it('renders text input when no options are provided', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Countdown Timer', () => {
    it('shows countdown timer when timeoutMs is provided', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });

    it('does not show timer when timeoutMs is not provided', () => {
      render(<CheckpointModal checkpoint={mockCheckpointNoTimeout} onRespond={onRespond} />);
      expect(screen.queryByTestId('countdown-timer')).not.toBeInTheDocument();
    });

    it('timer color is green when > 30s remaining', () => {
      // Initial render with 60s timeout should be green
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      const timer = screen.getByTestId('countdown-timer');
      expect(timer).toHaveAttribute('data-color', 'green');
    });
  });

  describe('Response Handling', () => {
    it('calls onRespond with option.id when option button is clicked', async () => {
      render(<CheckpointModal checkpoint={mockCheckpointWithOptions} onRespond={onRespond} />);
      await userEvent.click(screen.getByRole('button', { name: 'PostgreSQL' }));
      expect(onRespond).toHaveBeenCalledWith('postgres');
    });

    it('calls onRespond with input value when pressing Enter in text input', async () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'Looks good to me{Enter}');
      expect(onRespond).toHaveBeenCalledWith('Looks good to me');
    });

    it('disables option buttons after click to prevent double-submit', async () => {
      render(<CheckpointModal checkpoint={mockCheckpointWithOptions} onRespond={onRespond} />);
      const button = screen.getByRole('button', { name: 'PostgreSQL' });
      await userEvent.click(button);
      // All option buttons should be disabled after one is clicked
      expect(screen.getByRole('button', { name: 'PostgreSQL' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'SQLite' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'MongoDB' })).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('modal has role="dialog"', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('modal has aria-modal="true"', () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('first interactive element receives focus', async () => {
      render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={onRespond} />);
      // For text input checkpoint, the input should have focus (async due to RAF)
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveFocus();
      });
    });

    it('first option button receives focus when options are provided', async () => {
      render(<CheckpointModal checkpoint={mockCheckpointWithOptions} onRespond={onRespond} />);
      // For options checkpoint, the first option should have focus (async due to RAF)
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'PostgreSQL' })).toHaveFocus();
      });
    });
  });
});

describe('CountdownTimer', () => {
  it('renders with initial duration', () => {
    // Import CountdownTimer directly if needed for isolated tests
    render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={vi.fn()} />);
    const timer = screen.getByTestId('countdown-timer');
    expect(timer).toBeInTheDocument();
  });

  it('displays time remaining', () => {
    render(<CheckpointModal checkpoint={mockCheckpoint} onRespond={vi.fn()} />);
    const timer = screen.getByTestId('countdown-timer');
    // Should show time (format may vary: "60s", "1:00", etc.)
    expect(timer.textContent).toMatch(/\d+/);
  });
});
