'use client';

import type { PlanTask } from '@/types/plan';

interface TaskCardProps {
  task: PlanTask;
  onTaskEdit?: (taskId: string, updates: { title?: string; description?: string }) => void;
  isSelected?: boolean;
}

// Stub component - will fail tests
export function TaskCard({ task }: TaskCardProps) {
  return <div data-testid={`task-card-${task.id}`}>Stub</div>;
}
