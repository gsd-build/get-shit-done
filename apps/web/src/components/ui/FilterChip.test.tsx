import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  it('renders label text', () => {
    render(<FilterChip label="Healthy" active={false} onClick={() => {}} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('shows active state visually', () => {
    render(<FilterChip label="Active" active={true} onClick={() => {}} />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows inactive state visually', () => {
    render(<FilterChip label="Inactive" active={false} onClick={() => {}} />);
    const chip = screen.getByRole('button');
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<FilterChip label="Click Me" active={false} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is keyboard accessible', async () => {
    const onClick = vi.fn();
    render(<FilterChip label="Keyboard" active={false} onClick={onClick} />);
    const chip = screen.getByRole('button');
    chip.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });
});
