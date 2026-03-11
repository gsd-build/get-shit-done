import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorRecovery } from './ErrorRecovery';
import type { AgentErrorEvent } from '@gsd/events';

// Mock useErrorRecovery hook
const mockRetryFromCurrentTask = vi.fn();
const mockRetryFromBeginning = vi.fn();

vi.mock('@/hooks/useErrorRecovery', () => ({
  useErrorRecovery: vi.fn(() => ({
    retryFromCurrentTask: mockRetryFromCurrentTask,
    retryFromBeginning: mockRetryFromBeginning,
    isRetrying: false,
    retryError: null,
  })),
}));

// Test data factories
function createErrorEvent(overrides: Partial<AgentErrorEvent> = {}): AgentErrorEvent {
  return {
    agentId: 'agent-123',
    code: 'EXECUTION_ERROR',
    message: 'Task failed due to unexpected error',
    ...overrides,
  };
}

interface RetryContext {
  planId: string;
  taskName: string;
  projectPath: string;
  lastCheckpointId?: string;
}

function createContext(overrides: Partial<RetryContext> = {}): RetryContext {
  return {
    planId: 'plan-1',
    taskName: 'Task 1',
    projectPath: '/project/path',
    ...overrides,
  };
}

describe('ErrorRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error display', () => {
    it('renders when execution status is error', () => {
      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByTestId('error-recovery')).toBeInTheDocument();
    });

    it('shows error message prominently', () => {
      const error = createErrorEvent({
        message: 'Failed to read file: permission denied',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByText('Failed to read file: permission denied')).toBeInTheDocument();
    });

    it('shows error code if provided', () => {
      const error = createErrorEvent({
        code: 'FILE_ACCESS_ERROR',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByText('FILE_ACCESS_ERROR')).toBeInTheDocument();
    });

    it('shows recovery suggestion if provided', () => {
      const error = createErrorEvent({
        recovery: 'Check file permissions and try again',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByText('Check file permissions and try again')).toBeInTheDocument();
    });
  });

  describe('stack trace', () => {
    it('has View Details button that expands stack trace', async () => {
      const error = createErrorEvent({
        stack: 'Error: Something failed\n  at function1 (file.ts:10)\n  at function2 (file.ts:20)',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const toggleButton = screen.getByRole('button', { name: /view.*details/i });
      expect(toggleButton).toBeInTheDocument();

      // Click to expand
      await userEvent.click(toggleButton);

      expect(screen.getByTestId('stack-trace')).toBeInTheDocument();
      expect(screen.getByText(/Error: Something failed/)).toBeInTheDocument();
    });

    it('stack trace is hidden by default', () => {
      const error = createErrorEvent({
        stack: 'Error: Something failed\n  at function1 (file.ts:10)',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.queryByTestId('stack-trace')).not.toBeInTheDocument();
    });

    it('stack trace visible when expanded', async () => {
      const error = createErrorEvent({
        stack: 'Error: Something failed\n  at function1 (file.ts:10)',
      });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const toggleButton = screen.getByRole('button', { name: /view.*details/i });
      await userEvent.click(toggleButton);

      expect(screen.getByTestId('stack-trace')).toBeVisible();
    });
  });

  describe('context summary', () => {
    it('shows context summary with plan info', () => {
      const error = createErrorEvent();
      const context = createContext({
        planId: 'plan-17-07',
        taskName: 'Task 3: Implement ErrorRecovery',
      });

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByText(/plan-17-07/)).toBeInTheDocument();
      expect(screen.getByText(/Task 3: Implement ErrorRecovery/)).toBeInTheDocument();
    });
  });

  describe('retry buttons', () => {
    it('has Retry button that calls onRetry', async () => {
      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const retryButton = screen.getByRole('button', { name: /^retry$/i });
      await userEvent.click(retryButton);

      expect(mockRetryFromCurrentTask).toHaveBeenCalled();
    });

    it('has Retry from Beginning button to restart full execution', async () => {
      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const restartButton = screen.getByRole('button', { name: /retry from beginning/i });
      await userEvent.click(restartButton);

      expect(mockRetryFromBeginning).toHaveBeenCalled();
    });

    it('has Close button that calls onDismiss', async () => {
      const error = createErrorEvent();
      const context = createContext();
      const onDismiss = vi.fn();

      render(<ErrorRecovery error={error} context={context} onDismiss={onDismiss} />);

      const closeButton = screen.getByRole('button', { name: /close|dismiss/i });
      await userEvent.click(closeButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('loading states', () => {
    it('shows loading state on retry buttons during retry', async () => {
      // Mock hook to return isRetrying: true
      const { useErrorRecovery } = await import('@/hooks/useErrorRecovery');
      vi.mocked(useErrorRecovery).mockReturnValue({
        retryFromCurrentTask: mockRetryFromCurrentTask,
        retryFromBeginning: mockRetryFromBeginning,
        isRetrying: true,
        retryError: null,
      });

      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeDisabled();
    });
  });

  describe('visual styling', () => {
    it('has error indicator (AlertCircle or similar)', () => {
      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      // Should have an error icon
      expect(screen.getByTestId('error-icon')).toBeInTheDocument();
    });

    it('error code displayed in monospace badge', () => {
      const error = createErrorEvent({ code: 'ERR_CODE' });
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      const codeBadge = screen.getByTestId('error-code-badge');
      expect(codeBadge).toHaveClass('font-mono');
    });
  });

  describe('accessibility', () => {
    it('has proper role for error alert', () => {
      const error = createErrorEvent();
      const context = createContext();

      render(<ErrorRecovery error={error} context={context} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
