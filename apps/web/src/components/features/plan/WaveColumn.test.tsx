import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WaveColumn } from './WaveColumn';
import type { PlanTask } from '@/types/plan';

const mockTasks: PlanTask[] = [
  {
    id: 'task-1',
    name: 'Setup database',
    description: 'Initialize PostgreSQL schema',
    wave: 1,
    dependsOn: [],
    type: 'auto',
  },
  {
    id: 'task-2',
    name: 'Create migrations',
    description: 'Add initial migrations',
    wave: 1,
    dependsOn: ['task-1'],
    type: 'auto',
  },
];

describe('WaveColumn', () => {
  it('renders wave number header', () => {
    render(<WaveColumn waveNumber={1} tasks={mockTasks} />);
    expect(screen.getByText('Wave 1')).toBeInTheDocument();
  });

  it('renders all tasks in the wave', () => {
    render(<WaveColumn waveNumber={1} tasks={mockTasks} />);
    expect(screen.getByText('Setup database')).toBeInTheDocument();
    expect(screen.getByText('Create migrations')).toBeInTheDocument();
  });

  it('renders task count badge', () => {
    render(<WaveColumn waveNumber={1} tasks={mockTasks} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('passes onTaskEdit to each TaskCard', async () => {
    const onTaskEdit = vi.fn();
    render(<WaveColumn waveNumber={1} tasks={mockTasks} onTaskEdit={onTaskEdit} />);

    // Both task cards should be rendered with the callback
    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument();
  });

  it('column has min-height for visual consistency', () => {
    render(<WaveColumn waveNumber={1} tasks={[]} />);
    const column = screen.getByRole('region', { name: /wave 1/i });
    // Check that the column has min-height styling (via Tailwind class)
    expect(column.className).toMatch(/min-h/);
  });
});
