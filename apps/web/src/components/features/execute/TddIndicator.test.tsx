/**
 * TddIndicator component tests
 *
 * Tests for the TDD phase progress indicator showing Red-Green-Refactor steps.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TddIndicator } from './TddIndicator';

describe('TddIndicator', () => {
  describe('rendering', () => {
    it('returns null when phase is null (not a TDD execution)', () => {
      const { container } = render(<TddIndicator phase={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders 3 steps: Red, Green, Refactor', () => {
      render(<TddIndicator phase="red" />);

      expect(screen.getByText('Red')).toBeInTheDocument();
      expect(screen.getByText('Green')).toBeInTheDocument();
      expect(screen.getByText('Refactor')).toBeInTheDocument();
    });

    it('renders numbered circles for each phase', () => {
      render(<TddIndicator phase="green" />);

      // Step numbers displayed
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders connecting lines between steps', () => {
      const { container } = render(<TddIndicator phase="red" />);

      // Should have 2 connecting lines (between 3 steps)
      const lines = container.querySelectorAll('[data-testid="connector"]');
      expect(lines).toHaveLength(2);
    });
  });

  describe('active phase styling', () => {
    it('active phase has ring highlight', () => {
      render(<TddIndicator phase="red" />);

      const redStep = screen.getByTestId('step-red');
      const circle = redStep.querySelector('[data-testid="step-circle"]');
      expect(circle).toHaveClass('ring-2');
    });

    it('active phase has bold text', () => {
      render(<TddIndicator phase="green" />);

      const greenLabel = screen.getByTestId('step-label-green');
      expect(greenLabel).toHaveClass('font-semibold');
    });

    it('red phase is active when phase is red', () => {
      render(<TddIndicator phase="red" />);

      const redStep = screen.getByTestId('step-red');
      expect(redStep).toHaveAttribute('aria-current', 'step');
    });

    it('green phase is active when phase is green', () => {
      render(<TddIndicator phase="green" />);

      const greenStep = screen.getByTestId('step-green');
      expect(greenStep).toHaveAttribute('aria-current', 'step');
    });

    it('refactor phase is active when phase is refactor', () => {
      render(<TddIndicator phase="refactor" />);

      const refactorStep = screen.getByTestId('step-refactor');
      expect(refactorStep).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('past phase styling', () => {
    it('past phases have solid color fill', () => {
      render(<TddIndicator phase="green" />);

      // Red phase is past when green is active
      const redStep = screen.getByTestId('step-red');
      const circle = redStep.querySelector('[data-testid="step-circle"]');
      expect(circle).toHaveClass('bg-red-500');
      expect(circle).not.toHaveClass('bg-zinc-300');
    });

    it('multiple past phases have solid color when on refactor', () => {
      render(<TddIndicator phase="refactor" />);

      // Both red and green are past
      const redCircle = screen.getByTestId('step-red').querySelector('[data-testid="step-circle"]');
      const greenCircle = screen.getByTestId('step-green').querySelector('[data-testid="step-circle"]');

      expect(redCircle).toHaveClass('bg-red-500');
      expect(greenCircle).toHaveClass('bg-green-500');
    });
  });

  describe('future phase styling', () => {
    it('future phases have gray/muted styling', () => {
      render(<TddIndicator phase="red" />);

      // Green and Refactor are future when red is active
      const greenCircle = screen.getByTestId('step-green').querySelector('[data-testid="step-circle"]');
      const refactorCircle = screen.getByTestId('step-refactor').querySelector('[data-testid="step-circle"]');

      expect(greenCircle).toHaveClass('bg-zinc-300');
      expect(refactorCircle).toHaveClass('bg-zinc-300');
    });

    it('future phase labels have muted text', () => {
      render(<TddIndicator phase="red" />);

      const greenLabel = screen.getByTestId('step-label-green');
      const refactorLabel = screen.getByTestId('step-label-refactor');

      expect(greenLabel).toHaveClass('text-zinc-400');
      expect(refactorLabel).toHaveClass('text-zinc-400');
    });
  });

  describe('accessibility', () => {
    it('has role="group" on container', () => {
      render(<TddIndicator phase="red" />);

      const container = screen.getByRole('group');
      expect(container).toBeInTheDocument();
    });

    it('has aria-label describing the TDD progress', () => {
      render(<TddIndicator phase="green" />);

      const container = screen.getByRole('group');
      expect(container).toHaveAttribute('aria-label', 'TDD progress: Green phase');
    });

    it('only active step has aria-current="step"', () => {
      render(<TddIndicator phase="green" />);

      const redStep = screen.getByTestId('step-red');
      const greenStep = screen.getByTestId('step-green');
      const refactorStep = screen.getByTestId('step-refactor');

      expect(redStep).not.toHaveAttribute('aria-current');
      expect(greenStep).toHaveAttribute('aria-current', 'step');
      expect(refactorStep).not.toHaveAttribute('aria-current');
    });
  });
});
