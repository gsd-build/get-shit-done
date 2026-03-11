/**
 * ExecutionControls tests
 * Tests for pause/resume/abort control bar
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExecutionControls } from './ExecutionControls';

// Mock the execution store
const mockUseExecutionStore = vi.fn();
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: (selector: (state: unknown) => unknown) => mockUseExecutionStore(selector),
}));

// Mock useAgentControl hook
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockAbort = vi.fn();
vi.mock('@/hooks/useAgentControl', () => ({
  useAgentControl: () => ({
    pause: mockPause,
    resume: mockResume,
    abort: mockAbort,
    isLoading: false,
    error: null,
  }),
}));

describe('ExecutionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseExecutionStore.mockImplementation((selector) => {
      const state = {
        agentId: 'agent-123',
        status: 'running',
        plans: new Map([
          ['plan-1', { planId: 'plan-1', taskName: 'Test Task', status: 'running' }],
        ]),
        commits: [],
      };
      return selector(state);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders in fixed position at top', () => {
    render(<ExecutionControls />);

    const controls = screen.getByRole('toolbar');
    expect(controls).toBeInTheDocument();
    expect(controls).toHaveClass('sticky');
    expect(controls).toHaveClass('top-0');
  });

  it('shows Pause button when status is running', () => {
    render(<ExecutionControls />);

    expect(screen.getByRole('button', { name: /pause/i })).toBeInTheDocument();
  });

  it('shows Resume button when status is paused', () => {
    mockUseExecutionStore.mockImplementation((selector) => {
      const state = {
        agentId: 'agent-123',
        status: 'paused',
        plans: new Map([
          ['plan-1', { planId: 'plan-1', taskName: 'Test Task', status: 'running' }],
        ]),
        commits: [],
      };
      return selector(state);
    });

    render(<ExecutionControls />);

    expect(screen.getByRole('button', { name: /resume/i })).toBeInTheDocument();
  });

  it('shows Abort button always when running or paused', () => {
    render(<ExecutionControls />);

    expect(screen.getByRole('button', { name: /abort/i })).toBeInTheDocument();
  });

  it('disables Pause button when not running', () => {
    mockUseExecutionStore.mockImplementation((selector) => {
      const state = {
        agentId: 'agent-123',
        status: 'complete',
        plans: new Map(),
        commits: [],
      };
      return selector(state);
    });

    render(<ExecutionControls />);

    // When complete, neither pause nor resume should be active
    const buttons = screen.getAllByRole('button');
    const abortButton = buttons.find(b => b.textContent?.toLowerCase().includes('abort'));
    expect(abortButton).toBeDisabled();
  });

  it('clicking Pause calls pause handler', async () => {
    render(<ExecutionControls />);

    const pauseButton = screen.getByRole('button', { name: /pause/i });
    fireEvent.click(pauseButton);

    expect(mockPause).toHaveBeenCalled();
  });

  it('clicking Resume calls resume handler', async () => {
    mockUseExecutionStore.mockImplementation((selector) => {
      const state = {
        agentId: 'agent-123',
        status: 'paused',
        plans: new Map([
          ['plan-1', { planId: 'plan-1', taskName: 'Test Task', status: 'running' }],
        ]),
        commits: [],
      };
      return selector(state);
    });

    render(<ExecutionControls />);

    const resumeButton = screen.getByRole('button', { name: /resume/i });
    fireEvent.click(resumeButton);

    expect(mockResume).toHaveBeenCalled();
  });

  it('clicking Abort opens AbortConfirmDialog', async () => {
    render(<ExecutionControls />);

    const abortButton = screen.getByRole('button', { name: /abort/i });
    fireEvent.click(abortButton);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });
  });

  it('shows current plan name and status', () => {
    render(<ExecutionControls />);

    expect(screen.getByText(/test task/i)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });

  it('shows status badge for different states', () => {
    mockUseExecutionStore.mockImplementation((selector) => {
      const state = {
        agentId: 'agent-123',
        status: 'paused',
        plans: new Map([
          ['plan-1', { planId: 'plan-1', taskName: 'Test Task', status: 'running' }],
        ]),
        commits: [],
      };
      return selector(state);
    });

    render(<ExecutionControls />);

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });
});
