'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { WaveColumn } from './WaveColumn';
import { DependencyLines } from './DependencyLines';
import type { PlanTask } from '@/types/plan';

interface PlanKanbanProps {
  tasks: PlanTask[];
  onTaskEdit?: (taskId: string, updates: { title: string; description: string }) => void;
}

/**
 * PlanKanban - Kanban board container with wave columns and dependency lines.
 *
 * Groups tasks by wave number into columns.
 * Shows dependency lines as SVG overlay connecting dependent tasks.
 * Horizontal scroll for many waves.
 */
export function PlanKanban({ tasks, onTaskEdit }: PlanKanbanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cardPositions, setCardPositions] = useState<Map<string, DOMRect>>(new Map());

  // Group tasks by wave
  const tasksByWave = tasks.reduce<Record<number, PlanTask[]>>((acc, task) => {
    const wave = task.wave;
    if (!acc[wave]) {
      acc[wave] = [];
    }
    acc[wave].push(task);
    return acc;
  }, {});

  // Get sorted wave numbers
  const waveNumbers = Object.keys(tasksByWave)
    .map(Number)
    .sort((a, b) => a - b);

  // Update card positions for dependency lines
  const updatePositions = useCallback(() => {
    if (!containerRef.current) return;

    const newPositions = new Map<string, DOMRect>();
    tasks.forEach((task) => {
      const element = document.getElementById(`task-${task.id}`);
      if (element) {
        newPositions.set(task.id, element.getBoundingClientRect());
      }
    });
    setCardPositions(newPositions);
  }, [tasks]);

  // Update positions on mount, resize, and task changes
  useEffect(() => {
    // Initial update after DOM settles
    const timeoutId = setTimeout(updatePositions, 100);

    // Update on resize
    const handleResize = () => {
      updatePositions();
    };
    window.addEventListener('resize', handleResize);

    // Observe container for mutations (e.g., column animations)
    const observer = new MutationObserver(updatePositions);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [updatePositions]);

  // Update positions when tasks change
  useEffect(() => {
    updatePositions();
  }, [tasks, updatePositions]);

  return (
    <div
      ref={containerRef}
      data-testid="plan-kanban"
      className="relative overflow-x-auto p-4"
    >
      {/* Dependency lines overlay */}
      <DependencyLines
        tasks={tasks}
        cardPositions={cardPositions}
        containerRef={containerRef}
      />

      {/* Wave columns grid */}
      <div className="grid auto-cols-[300px] grid-flow-col gap-4">
        {waveNumbers.map((waveNumber) => (
          <WaveColumn
            key={waveNumber}
            waveNumber={waveNumber}
            tasks={tasksByWave[waveNumber] ?? []}
            {...(onTaskEdit && { onTaskEdit })}
          />
        ))}
      </div>
    </div>
  );
}
