import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PipelineView } from './PipelineView';

interface Plan {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  logs: string;
}

interface Wave {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  plans: Plan[];
}

const mockWaves: Wave[] = [
  {
    id: 'wave-1',
    status: 'complete',
    plans: [
      { id: 'plan-1', name: 'Setup Database', status: 'complete', logs: '' },
      { id: 'plan-2', name: 'Configure Auth', status: 'complete', logs: '' },
    ],
  },
  {
    id: 'wave-2',
    status: 'running',
    plans: [
      { id: 'plan-3', name: 'Build API', status: 'running', logs: '' },
    ],
  },
  {
    id: 'wave-3',
    status: 'pending',
    plans: [
      { id: 'plan-4', name: 'Deploy', status: 'pending', logs: '' },
    ],
  },
];

describe('PipelineView', () => {
  it('renders wave columns for each wave in data', () => {
    render(<PipelineView waves={mockWaves} />);

    // Each wave should have a column
    expect(screen.getByText('Wave 1')).toBeInTheDocument();
    expect(screen.getByText('Wave 2')).toBeInTheDocument();
    expect(screen.getByText('Wave 3')).toBeInTheDocument();
  });

  it('waves render as horizontal grid columns (CSS grid-flow-col)', () => {
    render(<PipelineView waves={mockWaves} />);

    const container = screen.getByRole('list', { name: 'Execution waves' });
    expect(container.className).toContain('grid-flow-col');
    expect(container.className).toContain('auto-cols-');
  });

  it('empty waves array renders empty state', () => {
    render(<PipelineView waves={[]} />);

    expect(screen.getByText(/no waves/i)).toBeInTheDocument();
  });

  it('has aria labels for accessibility', () => {
    render(<PipelineView waves={mockWaves} />);

    const container = screen.getByRole('list', { name: 'Execution waves' });
    expect(container).toHaveAttribute('aria-label', 'Execution waves');
  });

  it('renders plans within each wave column', () => {
    render(<PipelineView waves={mockWaves} />);

    // Plans from wave 1
    expect(screen.getByText('Setup Database')).toBeInTheDocument();
    expect(screen.getByText('Configure Auth')).toBeInTheDocument();

    // Plan from wave 2
    expect(screen.getByText('Build API')).toBeInTheDocument();

    // Plan from wave 3
    expect(screen.getByText('Deploy')).toBeInTheDocument();
  });

  it('renders correct number of wave columns', () => {
    render(<PipelineView waves={mockWaves} />);

    const waveColumns = screen.getAllByRole('listitem');
    // 3 wave columns
    expect(waveColumns.length).toBeGreaterThanOrEqual(3);
  });
});
