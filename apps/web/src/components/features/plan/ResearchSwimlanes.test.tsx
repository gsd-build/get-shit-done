/**
 * Tests for ResearchSwimlanes component.
 * Covers rendering multiple agents, grid layout, accessibility.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResearchSwimlanes } from './ResearchSwimlanes';
import type { ResearchAgent } from '@/types/plan';

const createAgent = (id: string, name: string, overrides: Partial<ResearchAgent> = {}): ResearchAgent => ({
  id,
  name,
  status: 'pending',
  elapsedMs: 0,
  ...overrides,
});

describe('ResearchSwimlanes', () => {
  describe('empty state', () => {
    it('renders empty container when no agents', () => {
      render(<ResearchSwimlanes agents={[]} />);

      const container = screen.getByRole('list');
      expect(container).toBeInTheDocument();
      // No AgentLane items
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    });
  });

  describe('rendering agents', () => {
    it('renders one AgentLane per agent', () => {
      const agents = [
        createAgent('1', 'Context Agent'),
        createAgent('2', 'Files Agent'),
        createAgent('3', 'Patterns Agent'),
      ];
      render(<ResearchSwimlanes agents={agents} />);

      expect(screen.getAllByRole('article')).toHaveLength(3);
      expect(screen.getByText('Context Agent')).toBeInTheDocument();
      expect(screen.getByText('Files Agent')).toBeInTheDocument();
      expect(screen.getByText('Patterns Agent')).toBeInTheDocument();
    });
  });

  describe('layout', () => {
    it('uses CSS grid layout with gap', () => {
      const agents = [createAgent('1', 'Agent 1')];
      render(<ResearchSwimlanes agents={agents} />);

      const container = screen.getByRole('list');
      expect(container.className).toContain('grid');
      expect(container.className).toContain('gap-');
    });
  });

  describe('accessibility', () => {
    it('has role list and aria-label', () => {
      const agents = [createAgent('1', 'Test Agent')];
      render(<ResearchSwimlanes agents={agents} />);

      const container = screen.getByRole('list');
      expect(container).toHaveAttribute('aria-label', 'Research agents');
    });
  });

  describe('click handling', () => {
    it('passes onAgentClick to each lane', () => {
      const agents = [
        createAgent('agent-1', 'Agent 1'),
        createAgent('agent-2', 'Agent 2'),
      ];
      const handleClick = vi.fn();
      render(<ResearchSwimlanes agents={agents} onAgentClick={handleClick} />);

      // Click first agent
      fireEvent.click(screen.getByText('Agent 1').closest('article')!);
      expect(handleClick).toHaveBeenCalledWith('agent-1');

      // Click second agent
      fireEvent.click(screen.getByText('Agent 2').closest('article')!);
      expect(handleClick).toHaveBeenCalledWith('agent-2');
    });
  });
});
