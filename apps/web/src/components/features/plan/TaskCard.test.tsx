import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard } from './TaskCard';
import type { PlanTask } from '@/types/plan';

const mockTask: PlanTask = {
  id: 'task-1',
  name: 'Implement user authentication',
  description: 'Add JWT-based authentication with refresh tokens',
  wave: 1,
  dependsOn: [],
  files: ['src/auth/login.ts', 'src/auth/jwt.ts'],
  type: 'auto',
};

const checkpointTask: PlanTask = {
  id: 'task-2',
  name: 'Verify deployment',
  description: 'Check that the deployment succeeded',
  wave: 2,
  dependsOn: ['task-1'],
  type: 'checkpoint:human-verify',
};

describe('TaskCard', () => {
  it('renders task name and description', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    expect(screen.getByText('Add JWT-based authentication with refresh tokens')).toBeInTheDocument();
  });

  it('renders task type badge for auto tasks', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('auto')).toBeInTheDocument();
  });

  it('renders task type badge for checkpoint tasks', () => {
    render(<TaskCard task={checkpointTask} />);
    expect(screen.getByText('checkpoint:human-verify')).toBeInTheDocument();
  });

  it('renders file count if files provided', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('2 files')).toBeInTheDocument();
  });

  it('does not render file count if no files', () => {
    const taskWithoutFiles = { ...mockTask, files: undefined };
    render(<TaskCard task={taskWithoutFiles} />);
    expect(screen.queryByText(/files/)).not.toBeInTheDocument();
  });

  it('clicking card enables inline editing mode', async () => {
    const onTaskEdit = vi.fn();
    render(<TaskCard task={mockTask} onTaskEdit={onTaskEdit} />);
    const card = screen.getByTestId('task-card-task-1');
    await userEvent.click(card);
    // In edit mode, there should be input fields or contenteditable elements
    expect(screen.getByRole('textbox', { name: /title/i })).toBeInTheDocument();
  });

  it('editing title updates via onTaskEdit callback', async () => {
    const onTaskEdit = vi.fn();
    render(<TaskCard task={mockTask} onTaskEdit={onTaskEdit} />);
    const card = screen.getByTestId('task-card-task-1');
    await userEvent.click(card);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated task name');

    // Click save button
    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    expect(onTaskEdit).toHaveBeenCalledWith('task-1', { title: 'Updated task name', description: 'Add JWT-based authentication with refresh tokens' });
  });

  it('editing description updates via onTaskEdit callback', async () => {
    const onTaskEdit = vi.fn();
    render(<TaskCard task={mockTask} onTaskEdit={onTaskEdit} />);
    const card = screen.getByTestId('task-card-task-1');
    await userEvent.click(card);

    const descInput = screen.getByRole('textbox', { name: /description/i });
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Updated description');

    const saveButton = screen.getByRole('button', { name: /save/i });
    await userEvent.click(saveButton);

    expect(onTaskEdit).toHaveBeenCalledWith('task-1', { title: 'Implement user authentication', description: 'Updated description' });
  });

  it('pressing Escape cancels edit mode', async () => {
    const onTaskEdit = vi.fn();
    render(<TaskCard task={mockTask} onTaskEdit={onTaskEdit} />);
    const card = screen.getByTestId('task-card-task-1');
    await userEvent.click(card);

    const titleInput = screen.getByRole('textbox', { name: /title/i });
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Changed text');

    // Press Escape to cancel
    await userEvent.keyboard('{Escape}');

    // Should revert to display mode with original text
    expect(screen.getByText('Implement user authentication')).toBeInTheDocument();
    expect(onTaskEdit).not.toHaveBeenCalled();
  });

  it('has data-testid with task id for position tracking', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
  });

  it('has id attribute for position tracking', () => {
    render(<TaskCard task={mockTask} />);
    const card = screen.getByTestId('task-card-task-1');
    expect(card).toHaveAttribute('id', 'task-task-1');
  });
});
