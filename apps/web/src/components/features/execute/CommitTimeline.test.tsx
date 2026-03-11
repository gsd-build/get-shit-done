import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommitTimeline } from './CommitTimeline';
import type { Commit } from '@/stores/executionStore';

describe('CommitTimeline', () => {
  const mockCommits: Commit[] = [
    {
      sha: 'abc1234def5678',
      message: 'feat(17-05): implement DiffPanel component',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    },
    {
      sha: '987654321abcde',
      message: 'test(17-05): add failing tests for DiffPanel',
      timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    },
    {
      sha: 'xyz7890123456',
      message: 'fix(17-05): correct import path for executionStore',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
    },
  ];

  it('renders "X commits made [View]" header (collapsed by default)', () => {
    render(<CommitTimeline commits={mockCommits} />);

    // Should show commit count
    expect(screen.getByText(/3 commits made/i)).toBeInTheDocument();

    // Should have View button
    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();

    // Commit list should not be visible (collapsed)
    expect(screen.queryByTestId('commit-list')).not.toBeInTheDocument();
  });

  it('clicking [View] expands to show commit list', async () => {
    render(<CommitTimeline commits={mockCommits} />);

    // Click View button
    await userEvent.click(screen.getByRole('button', { name: /view/i }));

    // Commit list should now be visible
    expect(screen.getByTestId('commit-list')).toBeInTheDocument();

    // Button text should change to Hide
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
  });

  it('each commit shows: sha (abbreviated), message, relative timestamp', async () => {
    render(<CommitTimeline commits={mockCommits} />);

    // Expand the list
    await userEvent.click(screen.getByRole('button', { name: /view/i }));

    // Check first commit
    const commitItems = screen.getAllByTestId('commit-item');
    expect(commitItems).toHaveLength(3);

    // SHA should be abbreviated (first 7 chars)
    expect(screen.getByText('abc1234')).toBeInTheDocument();

    // Message should be present
    expect(screen.getByText(/implement DiffPanel component/i)).toBeInTheDocument();

    // Relative timestamp should be present (e.g., "5 minutes ago")
    expect(screen.getByText(/minutes ago/i)).toBeInTheDocument();
  });

  it('empty commits array shows "No commits yet"', () => {
    render(<CommitTimeline commits={[]} />);
    expect(screen.getByText(/no commits yet/i)).toBeInTheDocument();
  });

  it('commits sorted newest first', async () => {
    render(<CommitTimeline commits={mockCommits} />);

    // Expand the list
    await userEvent.click(screen.getByRole('button', { name: /view/i }));

    const commitItems = screen.getAllByTestId('commit-item');

    // First commit should be the newest (abc1234)
    expect(within(commitItems[0]).getByText('abc1234')).toBeInTheDocument();

    // Last commit should be oldest (xyz7890)
    expect(within(commitItems[2]).getByText('xyz7890')).toBeInTheDocument();
  });

  it('displays singular "commit" for single commit', () => {
    render(<CommitTimeline commits={[mockCommits[0]]} />);
    expect(screen.getByText(/1 commit made/i)).toBeInTheDocument();
  });

  it('truncates long commit messages with ellipsis', async () => {
    const longCommit: Commit = {
      sha: 'long1234',
      message: 'feat(17-05): this is a very long commit message that exceeds the maximum allowed length and should be truncated with an ellipsis at the end',
      timestamp: new Date().toISOString(),
    };
    render(<CommitTimeline commits={[longCommit]} />);

    // Expand the list
    await userEvent.click(screen.getByRole('button', { name: /view/i }));

    // Message should be truncated
    const messageElement = screen.getByTestId('commit-message');
    expect(messageElement.className).toContain('truncate');
  });

  it('displays timeline visual with vertical line and commit dots', async () => {
    render(<CommitTimeline commits={mockCommits} />);

    // Expand the list
    await userEvent.click(screen.getByRole('button', { name: /view/i }));

    // Timeline line should be visible
    expect(screen.getByTestId('timeline-line')).toBeInTheDocument();

    // Each commit should have a dot
    const commitDots = screen.getAllByTestId('commit-dot');
    expect(commitDots).toHaveLength(3);
  });
});

// Import within for nested queries
import { within } from '@testing-library/react';
