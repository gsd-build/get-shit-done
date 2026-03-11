'use client';

import { ProjectCard } from './ProjectCard';
import type { Project } from '@/types';

interface ProjectGridProps {
  projects: Project[];
  onNavigate: (id: string) => void;
  onActivityClick?: (activityId: string) => void;
}

export function ProjectGrid({ projects, onNavigate, onActivityClick }: ProjectGridProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No projects found</p>
      </div>
    );
  }

  return (
    <div
      data-testid="project-grid"
      className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
    >
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onNavigate={onNavigate}
          onActivityClick={onActivityClick}
        />
      ))}
    </div>
  );
}
