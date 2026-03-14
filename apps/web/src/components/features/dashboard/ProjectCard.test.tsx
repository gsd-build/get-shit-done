import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectCard } from './ProjectCard';
import type { Project } from '@/types';

const mockProject: Project = {
  id: 'project-1',
  name: 'GSD Dashboard',
  path: '/path/to/project',
  status: 'active',
  health: { status: 'healthy', issues: [] },
  progress: { completedPhases: 8, totalPhases: 12, completedPlans: 24, totalPlans: 36, percentage: 67 },
  currentPhase: 'Phase 15',
  lastActivity: '2026-03-11T10:00:00Z',
  orchestration: {
    pausedRuns: 2,
    pausedRunNames: ['phase-18', 'phase-18.1'],
    hasPausedRuns: true,
  },
};

describe('ProjectCard', () => {
  it('displays project name', () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    expect(screen.getByText('GSD Dashboard')).toBeInTheDocument();
  });

  it('displays progress bar with correct percentage', () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '67');
  });

  it('displays health badge', () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('displays current phase', () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    expect(screen.getByText('Phase 15')).toBeInTheDocument();
  });

  it('shows paused run indicator when orchestration has paused runs', () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    expect(screen.getByText('2 paused')).toBeInTheDocument();
  });

  it('shows action buttons on hover', async () => {
    render(<ProjectCard project={mockProject} onNavigate={() => {}} />);
    const card = screen.getByRole('button', { name: /GSD Dashboard/i });
    await userEvent.hover(card);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onNavigate when clicked', async () => {
    const onNavigate = vi.fn();
    render(<ProjectCard project={mockProject} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: /GSD Dashboard/i }));
    expect(onNavigate).toHaveBeenCalledWith('project-1');
  });

  it('is keyboard accessible', async () => {
    const onNavigate = vi.fn();
    render(<ProjectCard project={mockProject} onNavigate={onNavigate} />);
    const card = screen.getByRole('button', { name: /GSD Dashboard/i });
    card.focus();
    await userEvent.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('project-1');
  });
});
