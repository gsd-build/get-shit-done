'use client';

import { useMemo } from 'react';
import type { PlanTask } from '@/types/plan';

interface DependencyLinesProps {
  tasks: PlanTask[];
  cardPositions: Map<string, DOMRect>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface Line {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  id: string;
  blocked?: boolean;
}

/**
 * DependencyLines - SVG overlay showing task dependencies.
 *
 * Draws lines from dependent tasks to their dependencies.
 * Uses simple straight dashed lines with arrow markers.
 */
export function DependencyLines({ tasks, cardPositions, containerRef }: DependencyLinesProps) {
  // Calculate lines between dependent cards
  const lines = useMemo<Line[]>(() => {
    if (!containerRef.current || cardPositions.size === 0) {
      return [];
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const result: Line[] = [];

    tasks.forEach((task) => {
      task.dependsOn.forEach((depId) => {
        const fromRect = cardPositions.get(depId);
        const toRect = cardPositions.get(task.id);

        if (fromRect && toRect) {
          // From: right center of the dependency card
          const fromX = fromRect.right - containerRect.left;
          const fromY = fromRect.top + fromRect.height / 2 - containerRect.top;

          // To: left center of the current task card
          const toX = toRect.left - containerRect.left;
          const toY = toRect.top + toRect.height / 2 - containerRect.top;

          result.push({
            fromX,
            fromY,
            toX,
            toY,
            id: `${depId}-${task.id}`,
            blocked: task.type === 'checkpoint:human-action',
          });
        }
      });
    });

    return result;
  }, [tasks, cardPositions, containerRef]);

  // Don't render if no positions calculated yet
  if (lines.length === 0) {
    return null;
  }

  return (
    <svg
      data-testid="dependency-lines"
      className="absolute inset-0 pointer-events-none overflow-visible"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
        </marker>
      </defs>

      {lines.map((line) => (
        <line
          key={line.id}
          x1={line.fromX}
          y1={line.fromY}
          x2={line.toX}
          y2={line.toY}
          stroke={line.blocked ? '#dc2626' : '#888'}
          strokeWidth="1.5"
          strokeDasharray={line.blocked ? '2 3' : '4'}
          markerEnd="url(#arrowhead)"
        />
      ))}
    </svg>
  );
}
