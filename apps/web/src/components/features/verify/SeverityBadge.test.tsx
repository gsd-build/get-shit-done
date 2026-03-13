import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from './SeverityBadge';

describe('SeverityBadge', () => {
  describe('blocking severity', () => {
    it('renders "Blocking" text', () => {
      render(<SeverityBadge severity="blocking" />);
      expect(screen.getByText('Blocking')).toBeInTheDocument();
    });

    it('has red background (bg-red-500)', () => {
      render(<SeverityBadge severity="blocking" />);
      const badge = screen.getByText('Blocking');
      expect(badge).toHaveClass('bg-red-500');
    });

    it('has white text color', () => {
      render(<SeverityBadge severity="blocking" />);
      const badge = screen.getByText('Blocking');
      expect(badge).toHaveClass('text-white');
    });
  });

  describe('major severity', () => {
    it('renders "Major" text', () => {
      render(<SeverityBadge severity="major" />);
      expect(screen.getByText('Major')).toBeInTheDocument();
    });

    it('has orange background (bg-orange-500)', () => {
      render(<SeverityBadge severity="major" />);
      const badge = screen.getByText('Major');
      expect(badge).toHaveClass('bg-orange-500');
    });

    it('has white text color', () => {
      render(<SeverityBadge severity="major" />);
      const badge = screen.getByText('Major');
      expect(badge).toHaveClass('text-white');
    });
  });

  describe('minor severity', () => {
    it('renders "Minor" text', () => {
      render(<SeverityBadge severity="minor" />);
      expect(screen.getByText('Minor')).toBeInTheDocument();
    });

    it('has yellow background (bg-yellow-400)', () => {
      render(<SeverityBadge severity="minor" />);
      const badge = screen.getByText('Minor');
      expect(badge).toHaveClass('bg-yellow-400');
    });

    it('has black text color', () => {
      render(<SeverityBadge severity="minor" />);
      const badge = screen.getByText('Minor');
      expect(badge).toHaveClass('text-black');
    });
  });

  describe('className prop', () => {
    it('accepts optional className prop', () => {
      render(<SeverityBadge severity="blocking" className="custom-class" />);
      const badge = screen.getByText('Blocking');
      expect(badge).toHaveClass('custom-class');
    });
  });
});
