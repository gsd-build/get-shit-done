'use client';

import { useState } from 'react';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { HealthBadge } from './HealthBadge';
import { ActivityFeed, type Activity } from './ActivityFeed';
import type { Project } from '@/types';

interface ProjectCardProps {
  project: Project;
  activities?: Activity[];
  onNavigate: (id: string) => void;
  onActivityClick?: (activityId: string) => void;
}

export function ProjectCard({ project, activities = [], onNavigate, onActivityClick }: ProjectCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Create a default activity from lastActivity if no activities provided
  const displayActivities = activities.length > 0
    ? activities
    : project.lastActivity
    ? [{ id: 'last', description: 'Recent activity', agent: 'system', timestamp: project.lastActivity }]
    : [];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={project.name}
      onClick={() => onNavigate(project.id)}
      onKeyDown={(e) => e.key === 'Enter' && onNavigate(project.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="bg-card p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-border"
    >
      <h3 className="font-semibold text-foreground mb-3">{project.name}</h3>

      {/* Progress bar as hero element per CONTEXT.md */}
      <ProgressBar value={project.progress.percentage} className="mb-3" />

      <div className="flex items-center gap-2 mb-2">
        <HealthBadge status={project.health.status} issues={project.health.issues} />
        {project.currentPhase && (
          <span className="text-sm text-muted-foreground">{project.currentPhase}</span>
        )}
      </div>

      {displayActivities.length > 0 && (
        <ActivityFeed
          activities={displayActivities}
          compact
          {...(onActivityClick && { onActivityClick })}
        />
      )}

      {/* Hover actions per CONTEXT.md */}
      {isHovered && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onNavigate(project.id); }}
            className="text-sm text-primary hover:underline"
          >
            Open
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted-foreground hover:underline"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-muted-foreground hover:underline"
          >
            Settings
          </button>
        </div>
      )}
    </div>
  );
}
