import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManualChecklist } from './ManualChecklist';
import type { ManualTest } from '@/types/verification';

const mockTests: ManualTest[] = [
  { id: 'test-1', description: 'Verify button is accessible', passed: null },
  { id: 'test-2', description: 'Verify form validation works', passed: true },
  { id: 'test-3', description: 'Verify error messages display', passed: false },
];

describe('ManualChecklist', () => {
  it('renders heading "Manual Test Checklist"', () => {
    render(<ManualChecklist tests={mockTests} onTestUpdate={vi.fn()} />);
    expect(screen.getByText('Manual Test Checklist')).toBeInTheDocument();
  });

  it('renders all manual tests', () => {
    render(<ManualChecklist tests={mockTests} onTestUpdate={vi.fn()} />);
    expect(screen.getByText('Verify button is accessible')).toBeInTheDocument();
    expect(screen.getByText('Verify form validation works')).toBeInTheDocument();
    expect(screen.getByText('Verify error messages display')).toBeInTheDocument();
  });

  it('passes onTestUpdate to each item', () => {
    const onTestUpdate = vi.fn();
    render(<ManualChecklist tests={mockTests} onTestUpdate={onTestUpdate} />);
    // Should render 3 checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('shows empty state when no tests', () => {
    render(<ManualChecklist tests={[]} onTestUpdate={vi.fn()} />);
    expect(screen.getByText('No manual tests required')).toBeInTheDocument();
  });

  it('shows completion status (X of Y complete)', () => {
    render(<ManualChecklist tests={mockTests} onTestUpdate={vi.fn()} />);
    // 2 of 3 tests have passed !== null (true and false both count as complete)
    expect(screen.getByText('2 of 3 complete')).toBeInTheDocument();
  });
});
