import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PlanCard } from './PlanCard';

interface Plan {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  logs: string;
}

describe('PlanCard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders plan name and status indicator', () => {
    const plan: Plan = {
      id: 'plan-1',
      name: 'Setup Database',
      status: 'pending',
      logs: '',
    };
    render(<PlanCard plan={plan} />);

    expect(screen.getByText('Setup Database')).toBeInTheDocument();
    expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
  });

  it('shows elapsed time (live timer for running, "completed in Xs" for done)', () => {
    const now = Date.now();
    const runningPlan: Plan = {
      id: 'plan-1',
      name: 'Running Task',
      status: 'running',
      startTime: now - 5000, // Started 5 seconds ago
      logs: '',
    };

    render(<PlanCard plan={runningPlan} />);

    // Should show live timer format (0:05 or similar)
    expect(screen.getByTestId('elapsed-time')).toBeInTheDocument();
  });

  it('shows "completed in Xs" for completed plans', () => {
    const completedPlan: Plan = {
      id: 'plan-1',
      name: 'Done Task',
      status: 'complete',
      startTime: Date.now() - 3200,
      endTime: Date.now(),
      logs: '',
    };

    render(<PlanCard plan={completedPlan} />);

    // Should show completed format
    expect(screen.getByText(/completed in/i)).toBeInTheDocument();
  });

  it('auto-expands when status is running', () => {
    const runningPlan: Plan = {
      id: 'plan-1',
      name: 'Active Task',
      status: 'running',
      startTime: Date.now(),
      logs: 'Some log output',
    };

    render(<PlanCard plan={runningPlan} />);

    // Should auto-expand and show logs
    expect(screen.getByTestId('log-stream')).toBeInTheDocument();
  });

  it('auto-collapses when status is complete', () => {
    const completedPlan: Plan = {
      id: 'plan-1',
      name: 'Done Task',
      status: 'complete',
      startTime: Date.now() - 5000,
      endTime: Date.now(),
      logs: 'Final output',
    };

    render(<PlanCard plan={completedPlan} />);

    // Should be collapsed, logs not visible
    expect(screen.queryByTestId('log-stream')).not.toBeInTheDocument();
  });

  it('manual expand/collapse toggle works', () => {
    const plan: Plan = {
      id: 'plan-1',
      name: 'Task',
      status: 'complete',
      logs: 'Output',
    };

    render(<PlanCard plan={plan} />);

    // Initially collapsed (complete status)
    expect(screen.queryByTestId('log-stream')).not.toBeInTheDocument();

    // Click to expand
    const expandButton = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandButton);

    // Should now show logs
    expect(screen.getByTestId('log-stream')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(expandButton);

    expect(screen.queryByTestId('log-stream')).not.toBeInTheDocument();
  });

  it('expanded state shows LogStream component', () => {
    const runningPlan: Plan = {
      id: 'plan-1',
      name: 'Active Task',
      status: 'running',
      startTime: Date.now(),
      logs: 'Log content here',
    };

    render(<PlanCard plan={runningPlan} />);

    // LogStream should be visible with log content
    const logStream = screen.getByTestId('log-stream');
    expect(logStream).toBeInTheDocument();
    expect(screen.getByText('Log content here')).toBeInTheDocument();
  });

  it('status indicator colors: running=blue, complete=green, error=red, pending=gray', () => {
    const { rerender } = render(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'running', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).toContain('blue');

    rerender(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'complete', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).toContain('green');

    rerender(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'error', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).toContain('red');

    rerender(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'pending', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).toContain('gray');
  });

  it('live timer updates while running', () => {
    vi.useFakeTimers();
    const startTime = Date.now();
    const runningPlan: Plan = {
      id: 'plan-1',
      name: 'Running Task',
      status: 'running',
      startTime,
      logs: '',
    };

    render(<PlanCard plan={runningPlan} />);

    const elapsedTime = screen.getByTestId('elapsed-time');
    const initialText = elapsedTime.textContent;

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // The timer should have updated
    expect(elapsedTime.textContent).not.toBe(initialText);
  });

  it('timer stops when status changes to complete', () => {
    vi.useFakeTimers();
    const startTime = Date.now();

    const { rerender } = render(
      <PlanCard
        plan={{
          id: 'plan-1',
          name: 'Task',
          status: 'running',
          startTime,
          logs: '',
        }}
      />
    );

    // Timer is running
    expect(screen.getByTestId('elapsed-time')).toBeInTheDocument();

    // Complete the task
    rerender(
      <PlanCard
        plan={{
          id: 'plan-1',
          name: 'Task',
          status: 'complete',
          startTime,
          endTime: Date.now() + 2500,
          logs: '',
        }}
      />
    );

    // Should show completed time format
    expect(screen.getByText(/completed in/i)).toBeInTheDocument();
  });

  it('status indicator pulses when running', () => {
    render(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'running', logs: '' }} />
    );
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator.className).toContain('animate-pulse');
  });

  it('status indicator does not pulse when not running', () => {
    const { rerender } = render(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'pending', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).not.toContain('animate-pulse');

    rerender(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'complete', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).not.toContain('animate-pulse');

    rerender(
      <PlanCard plan={{ id: '1', name: 'Test', status: 'error', logs: '' }} />
    );
    expect(screen.getByTestId('status-indicator').className).not.toContain('animate-pulse');
  });
});
