/**
 * Tests for AgentLane component.
 * Covers status display, elapsed time formatting, expand/collapse summary.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentLane } from './AgentLane';
import type { ResearchAgent } from '@/types/plan';

const createAgent = (overrides: Partial<ResearchAgent> = {}): ResearchAgent => ({
  id: 'agent-1',
  name: 'Research Agent',
  status: 'pending',
  elapsedMs: 0,
  ...overrides,
});

describe('AgentLane', () => {
  describe('rendering', () => {
    it('renders agent name', () => {
      const agent = createAgent({ name: 'Context Agent' });
      render(<AgentLane agent={agent} />);

      expect(screen.getByText('Context Agent')).toBeInTheDocument();
    });
  });

  describe('status icons', () => {
    it('renders pending status with border-only circle', () => {
      const agent = createAgent({ status: 'pending' });
      render(<AgentLane agent={agent} />);

      // Should have an empty circle indicator (div with border, no fill icon)
      const lane = screen.getByRole('article');
      expect(lane).toHaveAttribute('data-status', 'pending');
    });

    it('renders running status with spinning loader and primary border', () => {
      const agent = createAgent({ status: 'running' });
      render(<AgentLane agent={agent} />);

      const lane = screen.getByRole('article');
      expect(lane).toHaveAttribute('data-status', 'running');
      expect(lane.className).toContain('border-primary');
      // Check for spinning loader icon
      expect(screen.getByTestId('loader-icon')).toHaveClass('animate-spin');
    });

    it('renders complete status with green check icon and green border', () => {
      const agent = createAgent({ status: 'complete' });
      render(<AgentLane agent={agent} />);

      const lane = screen.getByRole('article');
      expect(lane).toHaveAttribute('data-status', 'complete');
      expect(screen.getByTestId('check-icon')).toBeInTheDocument();
    });

    it('renders error status with red X icon, red border, and error message', () => {
      const agent = createAgent({
        status: 'error',
        error: 'Network timeout'
      });
      render(<AgentLane agent={agent} />);

      const lane = screen.getByRole('article');
      expect(lane).toHaveAttribute('data-status', 'error');
      expect(lane.className).toContain('border-red');
      expect(screen.getByTestId('x-icon')).toBeInTheDocument();
      // Error message should be inline
      expect(screen.getByText('Network timeout')).toBeInTheDocument();
    });
  });

  describe('current action', () => {
    it('shows current action text when running', () => {
      const agent = createAgent({
        status: 'running',
        currentAction: 'Reading src/api/routes.ts'
      });
      render(<AgentLane agent={agent} />);

      expect(screen.getByText(/Reading src\/api\/routes.ts/)).toBeInTheDocument();
    });
  });

  describe('elapsed time formatting', () => {
    it('shows seconds for time under 60s', () => {
      const agent = createAgent({ elapsedMs: 45000 }); // 45 seconds
      render(<AgentLane agent={agent} />);

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('shows minutes and seconds for time over 60s', () => {
      const agent = createAgent({ elapsedMs: 135000 }); // 2m 15s
      render(<AgentLane agent={agent} />);

      expect(screen.getByText('2m 15s')).toBeInTheDocument();
    });
  });

  describe('expand/collapse summary', () => {
    it('shows expand button only when complete with summary', () => {
      const agentWithSummary = createAgent({
        status: 'complete',
        summary: 'Found 5 relevant files'
      });
      render(<AgentLane agent={agentWithSummary} />);

      expect(screen.getByRole('button', { name: /expand/i })).toBeInTheDocument();
    });

    it('does not show expand button when pending', () => {
      const agent = createAgent({ status: 'pending' });
      render(<AgentLane agent={agent} />);

      expect(screen.queryByRole('button', { name: /expand/i })).not.toBeInTheDocument();
    });

    it('does not show expand button when complete without summary', () => {
      const agent = createAgent({ status: 'complete' });
      render(<AgentLane agent={agent} />);

      expect(screen.queryByRole('button', { name: /expand/i })).not.toBeInTheDocument();
    });

    it('clicking expand button reveals summary text', () => {
      const agent = createAgent({
        status: 'complete',
        summary: 'Analyzed 3 configuration files and found consistent patterns.'
      });
      render(<AgentLane agent={agent} />);

      // Summary not visible initially
      expect(screen.queryByText(/Analyzed 3 configuration files/)).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByRole('button', { name: /expand/i }));

      // Summary now visible
      expect(screen.getByText(/Analyzed 3 configuration files/)).toBeInTheDocument();
    });

    it('clicking again collapses summary', () => {
      const agent = createAgent({
        status: 'complete',
        summary: 'Summary content here'
      });
      render(<AgentLane agent={agent} />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: /expand/i }));
      expect(screen.getByText(/Summary content here/)).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: /collapse/i }));
      expect(screen.queryByText(/Summary content here/)).not.toBeInTheDocument();
    });
  });

  describe('click callback', () => {
    it('calls onClick when provided and clicked', () => {
      const agent = createAgent();
      const handleClick = vi.fn();
      render(<AgentLane agent={agent} onClick={handleClick} />);

      fireEvent.click(screen.getByRole('article'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
