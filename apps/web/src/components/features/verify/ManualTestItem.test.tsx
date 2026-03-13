import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualTestItem } from './ManualTestItem';
import type { ManualTest } from '@/types/verification';

const mockTest: ManualTest = {
  id: 'test-1',
  description: 'Verify the button is accessible',
  passed: null,
};

describe('ManualTestItem', () => {
  it('renders test description', () => {
    render(<ManualTestItem test={mockTest} onUpdate={vi.fn()} />);
    expect(screen.getByText('Verify the button is accessible')).toBeInTheDocument();
  });

  it('renders unchecked checkbox when passed=null', () => {
    render(<ManualTestItem test={mockTest} onUpdate={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('renders checked checkbox when passed=true', () => {
    const passedTest: ManualTest = { ...mockTest, passed: true };
    render(<ManualTestItem test={passedTest} onUpdate={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('clicking checkbox calls onUpdate with passed=true', async () => {
    const onUpdate = vi.fn();
    render(<ManualTestItem test={mockTest} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onUpdate).toHaveBeenCalledWith(true, undefined);
  });

  it('"Add note" button appears when no note', () => {
    render(<ManualTestItem test={mockTest} onUpdate={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('clicking "Add note" shows textarea', async () => {
    render(<ManualTestItem test={mockTest} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('typing in textarea updates note', async () => {
    render(<ManualTestItem test={mockTest} onUpdate={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Test note');
    expect(textarea).toHaveValue('Test note');
  });

  it('blur on textarea calls onUpdate with note value', async () => {
    const onUpdate = vi.fn();
    render(<ManualTestItem test={mockTest} onUpdate={onUpdate} />);
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Test note');
    await userEvent.tab(); // blur
    expect(onUpdate).toHaveBeenCalledWith(null, 'Test note');
  });
});
