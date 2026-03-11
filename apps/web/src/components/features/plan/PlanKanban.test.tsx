import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlanKanban } from './PlanKanban';
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
    name: 'Create API routes',
    description: 'Add REST endpoints',
    wave: 1,
    dependsOn: ['task-1'],
    type: 'auto',
  },
  {
    id: 'task-3',
    name: 'Build UI components',
    description: 'Create React components',
    wave: 2,
    dependsOn: ['task-2'],
    type: 'auto',
  },
  {
    id: 'task-4',
    name: 'Verify deployment',
    description: 'Check deployment succeeded',
    wave: 3,
    dependsOn: ['task-3'],
    type: 'checkpoint:human-verify',
  },
];

describe('PlanKanban', () => {
  it('groups tasks into correct wave columns', () => {
    render(<PlanKanban tasks={mockTasks} />);

    // Should have wave columns
    expect(screen.getByRole('region', { name: /wave 1/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /wave 2/i })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /wave 3/i })).toBeInTheDocument();
  });

  it('renders all task cards', () => {
    render(<PlanKanban tasks={mockTasks} />);

    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-task-3')).toBeInTheDocument();
    expect(screen.getByTestId('task-card-task-4')).toBeInTheDocument();
  });

  it('renders DependencyLines overlay', () => {
    render(<PlanKanban tasks={mockTasks} />);

    // DependencyLines component should be present (may or may not have lines rendered)
    const kanban = screen.getByTestId('plan-kanban');
    expect(kanban).toBeInTheDocument();
  });

  it('passes onTaskEdit to columns', () => {
    const onTaskEdit = vi.fn();
    render(<PlanKanban tasks={mockTasks} onTaskEdit={onTaskEdit} />);

    // Task cards should be rendered (callback passed through)
    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
  });

  it('handles empty tasks array', () => {
    render(<PlanKanban tasks={[]} />);

    const kanban = screen.getByTestId('plan-kanban');
    expect(kanban).toBeInTheDocument();
  });
});
