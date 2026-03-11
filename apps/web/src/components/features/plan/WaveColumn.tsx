'use client';

import type { PlanTask } from '@/types/plan';

interface WaveColumnProps {
  waveNumber: number;
  tasks: PlanTask[];
  onTaskEdit?: (taskId: string, updates: { title?: string; description?: string }) => void;
}

// Stub component - will fail tests
export function WaveColumn({ waveNumber }: WaveColumnProps) {
  return <div>Wave {waveNumber} Stub</div>;
}
