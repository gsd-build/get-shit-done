import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityFeed, type Activity } from './ActivityFeed';

const mockActivities: Activity[] = [
  { id: '1', description: 'Executed plan 14-01', agent: 'gsd-executor', timestamp: '2026-03-11T10:00:00Z' },
  { id: '2', description: 'Verified phase 14', agent: 'gsd-verifier', timestamp: '2026-03-11T09:30:00Z' },
  { id: '3', description: 'Planned phase 15', agent: 'gsd-planner', timestamp: '2026-03-11T09:00:00Z' },
  { id: '4', description: 'Discussed requirements', agent: 'gsd-discuss', timestamp: '2026-03-11T08:30:00Z' },
  { id: '5', description: 'Started session', agent: 'gsd-init', timestamp: '2026-03-11T08:00:00Z' },
];

describe('ActivityFeed', () => {
  it('shows 2 activities in compact mode by default', () => {
    render(<ActivityFeed activities={mockActivities} compact />);
    expect(screen.getByText(/Executed plan/)).toBeInTheDocument();
    expect(screen.getByText(/Verified phase/)).toBeInTheDocument();
    expect(screen.queryByText(/Planned phase/)).not.toBeInTheDocument();
  });

  it('shows expand button when more than 2 activities in compact mode', () => {
    render(<ActivityFeed activities={mockActivities} compact />);
    expect(screen.getByRole('button', { name: /show more/i })).toBeInTheDocument();
  });

  it('expands to show all 5 activities when clicked', async () => {
    render(<ActivityFeed activities={mockActivities} compact />);
    await userEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText(/Started session/)).toBeInTheDocument();
  });

  it('shows agent name and relative time for each activity', () => {
    render(<ActivityFeed activities={mockActivities.slice(0, 1)} />);
    expect(screen.getByText(/gsd-executor/)).toBeInTheDocument();
  });

  it('calls onActivityClick when activity is clicked', async () => {
    const onClick = vi.fn();
    render(<ActivityFeed activities={mockActivities.slice(0, 1)} onActivityClick={onClick} />);
    await userEvent.click(screen.getByText(/Executed plan/));
    expect(onClick).toHaveBeenCalledWith('1');
  });
});
