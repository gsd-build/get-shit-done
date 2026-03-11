import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('renders with correct percentage', () => {
    render(<ProgressBar value={65} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '65');
  });

  it('has correct aria attributes', () => {
    render(<ProgressBar value={50} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('displays percentage text when showLabel is true', () => {
    render(<ProgressBar value={75} showLabel />);
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('fills to correct width', () => {
    render(<ProgressBar value={40} />);
    const fill = screen.getByTestId('progress-fill');
    expect(fill).toHaveStyle({ width: '40%' });
  });

  it('clamps value between 0 and 100', () => {
    render(<ProgressBar value={150} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });

  it('accepts custom className', () => {
    render(<ProgressBar value={50} className="custom-class" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.className).toContain('custom-class');
  });
});
