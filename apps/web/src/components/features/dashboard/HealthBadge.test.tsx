import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthBadge } from './HealthBadge';

describe('HealthBadge', () => {
  it('displays healthy status with green badge', () => {
    render(<HealthBadge status="healthy" issues={[]} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('displays degraded status with yellow badge', () => {
    render(<HealthBadge status="degraded" issues={['Stale activity']} />);
    expect(screen.getByText('Degraded')).toBeInTheDocument();
  });

  it('displays error status with red badge', () => {
    render(<HealthBadge status="error" issues={['Build failed']} />);
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows popover with issues on click when issues exist', async () => {
    render(<HealthBadge status="degraded" issues={['Missing CONTEXT.md', 'Stale activity']} />);
    await userEvent.click(screen.getByText('Degraded'));
    expect(screen.getByText('Missing CONTEXT.md')).toBeInTheDocument();
    expect(screen.getByText('Stale activity')).toBeInTheDocument();
  });

  it('does not show popover trigger when healthy with no issues', () => {
    render(<HealthBadge status="healthy" issues={[]} />);
    const badge = screen.getByText('Healthy');
    // Badge should not be a button/interactive when no issues
    expect(badge.tagName).not.toBe('BUTTON');
  });
});
