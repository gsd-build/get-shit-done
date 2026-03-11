'use client';

import { TaskCard } from './TaskCard';
import type { PlanTask } from '@/types/plan';

interface WaveColumnProps {
  waveNumber: number;
  tasks: PlanTask[];
  onTaskEdit?: (taskId: string, updates: { title: string; description: string }) => void;
}

/**
 * WaveColumn - Displays a vertical column of tasks for a single wave.
 *
 * Shows wave header with number and task count badge.
 * Contains TaskCard components for each task in the wave.
 */
export function WaveColumn({ waveNumber, tasks, onTaskEdit }: WaveColumnProps) {
  return (
    <section
      role="region"
      aria-label={`Wave ${waveNumber}`}
      className="bg-muted/30 rounded-lg p-3 min-h-[300px] flex flex-col"
    >
      {/* Header with wave number and count */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Wave {waveNumber}</h3>
        <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Task cards */}
      <div className="space-y-2 flex-1">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            {...(onTaskEdit && { onTaskEdit })}
          />
        ))}
      </div>
    </section>
  );
}
