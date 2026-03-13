import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders with pending status (gray)', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('gray');
    expect(badge).toHaveAttribute('aria-label', 'Status: pending');
  });

  it('renders with running status (blue)', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('blue');
  });

  it('renders with complete status (green)', () => {
    render(<StatusBadge status="complete" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('green');
  });

  it('renders with error status (red)', () => {
    render(<StatusBadge status="error" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('red');
  });

  it('shows pulse animation for running status by default', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('animate-pulse');
  });

  it('does not pulse for running when showPulse is false', () => {
    render(<StatusBadge status="running" showPulse={false} />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).not.toContain('animate-pulse');
  });

  it('does not pulse for non-running statuses', () => {
    render(<StatusBadge status="complete" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).not.toContain('animate-pulse');
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<StatusBadge status="pending" size="sm" />);
    expect(screen.getByTestId('status-badge').className).toContain('w-2');

    rerender(<StatusBadge status="pending" size="md" />);
    expect(screen.getByTestId('status-badge').className).toContain('w-3');

    rerender(<StatusBadge status="pending" size="lg" />);
    expect(screen.getByTestId('status-badge').className).toContain('w-4');
  });

  it('has role="status" for accessibility', () => {
    render(<StatusBadge status="running" />);
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    render(<StatusBadge status="pending" className="custom-class" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge.className).toContain('custom-class');
  });
});
