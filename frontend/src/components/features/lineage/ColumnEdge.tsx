'use client';

import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import type { ColumnEdgeData, TransformationSubtype } from '@/lib/lineage-types';
import { cn } from '@/lib/utils';

// Color coding by transformation type
const TRANSFORMATION_COLORS: Record<TransformationSubtype | 'default', { stroke: string; bg: string; text: string }> = {
  // Direct transformations
  IDENTITY: { stroke: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280' }, // gray
  TRANSFORMATION: { stroke: '#3B82F6', bg: '#EFF6FF', text: '#2563EB' }, // blue
  AGGREGATION: { stroke: '#8B5CF6', bg: '#F5F3FF', text: '#7C3AED' }, // purple

  // Indirect transformations
  JOIN: { stroke: '#F97316', bg: '#FFF7ED', text: '#EA580C' }, // orange
  GROUP_BY: { stroke: '#22C55E', bg: '#F0FDF4', text: '#16A34A' }, // green
  FILTER: { stroke: '#22C55E', bg: '#F0FDF4', text: '#16A34A' }, // green
  SORT: { stroke: '#22C55E', bg: '#F0FDF4', text: '#16A34A' }, // green
  WINDOW: { stroke: '#22C55E', bg: '#F0FDF4', text: '#16A34A' }, // green
  CONDITIONAL: { stroke: '#EAB308', bg: '#FEFCE8', text: '#CA8A04' }, // yellow

  default: { stroke: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280' }, // gray
};

// Short labels for edge display
const TRANSFORMATION_LABELS: Partial<Record<TransformationSubtype, string>> = {
  IDENTITY: '=',
  TRANSFORMATION: 'T',
  AGGREGATION: 'AGG',
  JOIN: 'JOIN',
  GROUP_BY: 'GRP',
  FILTER: 'FLT',
  SORT: 'SRT',
  WINDOW: 'WIN',
  CONDITIONAL: 'IF',
};

interface ColumnEdgeProps extends EdgeProps {
  data?: ColumnEdgeData;
}

export const ColumnEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  }: ColumnEdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    const subtype = data?.transformationSubtype;
    const colors = subtype ? TRANSFORMATION_COLORS[subtype] : TRANSFORMATION_COLORS.default;
    const label = subtype ? TRANSFORMATION_LABELS[subtype] || subtype : null;
    const isHighlighted = data?.isHighlighted || selected;

    return (
      <>
        <BaseEdge
          id={id}
          path={edgePath}
          style={{
            stroke: colors.stroke,
            strokeWidth: isHighlighted ? 3 : 1.5,
            strokeOpacity: isHighlighted ? 1 : 0.6,
          }}
          interactionWidth={20}
        />
        {label && (
          <EdgeLabelRenderer>
            <div
              className={cn(
                'absolute pointer-events-auto cursor-pointer',
                'px-1.5 py-0.5 rounded text-[10px] font-medium',
                'border shadow-sm transition-all',
                isHighlighted && 'ring-2 ring-blue-400 ring-offset-1'
              )}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                backgroundColor: colors.bg,
                color: colors.text,
                borderColor: colors.stroke,
              }}
              title={data?.transformationDescription || subtype || 'Unknown transformation'}
            >
              {label}
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    );
  }
);

ColumnEdge.displayName = 'ColumnEdge';

export default ColumnEdge;
