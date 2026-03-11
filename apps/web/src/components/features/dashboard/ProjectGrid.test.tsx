import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ProjectGrid } from './ProjectGrid';
import type { Project } from '@/types';

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Project One',
    path: '/p1',
    status: 'active',
    health: { status: 'healthy', issues: [] },
    progress: { completedPhases: 5, totalPhases: 10, completedPlans: 15, totalPlans: 30, percentage: 50 },
    currentPhase: 'Phase 5',
  },
  {
    id: '2',
    name: 'Project Two',
    path: '/p2',
    status: 'active',
    health: { status: 'degraded', issues: ['Stale'] },
    progress: { completedPhases: 3, totalPhases: 10, completedPlans: 9, totalPlans: 30, percentage: 30 },
    currentPhase: 'Phase 3',
  },
];

describe('ProjectGrid', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders all projects as cards', () => {
    render(<ProjectGrid projects={mockProjects} onNavigate={() => {}} />);
    expect(screen.getByText('Project One')).toBeInTheDocument();
    expect(screen.getByText('Project Two')).toBeInTheDocument();
  });

  it('shows empty state when no projects', () => {
    render(<ProjectGrid projects={[]} onNavigate={() => {}} />);
    expect(screen.getByText(/no projects/i)).toBeInTheDocument();
  });

  it('renders in responsive grid', () => {
    render(<ProjectGrid projects={mockProjects} onNavigate={() => {}} />);
    const grid = screen.getByTestId('project-grid');
    expect(grid.className).toContain('grid');
  });

  it('calls onNavigate when project card clicked', async () => {
    const onNavigate = vi.fn();
    render(<ProjectGrid projects={mockProjects} onNavigate={onNavigate} />);
    // Find the project card button
    const card = screen.getByRole('button', { name: /project one/i });
    card.click();
    expect(onNavigate).toHaveBeenCalledWith('1');
  });

  it('shows correct number of project cards', () => {
    render(<ProjectGrid projects={mockProjects} onNavigate={() => {}} />);
    const buttons = screen.getAllByRole('button');
    // Each project card is a button, plus action buttons on hover
    // At minimum we should have 2 project cards
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });
});
