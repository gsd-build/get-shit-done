'use client';

import { HeatMapGrid } from 'react-grid-heatmap';

/**
 * Coverage value type:
 * - 0 = uncovered (red)
 * - 1 = partial (yellow)
 * - 2 = covered (green)
 */
export interface Coverage {
  requirementId: string;
  phaseId: string;
  coverage: 0 | 1 | 2;
}

interface CoverageHeatmapProps {
  requirements: string[];
  phases: string[];
  coverageData: Coverage[];
}

/**
 * Get background color for coverage value.
 * Per CONTEXT.md: red-500 (uncovered), yellow-400 (partial), green-500 (covered)
 */
function getColorForValue(value: number): string {
  switch (value) {
    case 0:
      return 'rgb(239, 68, 68)'; // red-500
    case 1:
      return 'rgb(250, 204, 21)'; // yellow-400
    case 2:
      return 'rgb(34, 197, 94)'; // green-500
    default:
      return 'rgb(239, 68, 68)'; // default to uncovered
  }
}

/**
 * Heatmap grid showing requirement-to-phase coverage matrix.
 *
 * Displays requirements as rows and phases as columns.
 * Cell colors indicate coverage level:
 * - Red: Uncovered (0)
 * - Yellow: Partial (1)
 * - Green: Covered (2)
 */
export function CoverageHeatmap({
  requirements,
  phases,
  coverageData,
}: CoverageHeatmapProps) {
  // Empty state
  if (requirements.length === 0 || phases.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No coverage data available
      </p>
    );
  }

  // Build coverage lookup map for O(1) access
  const coverageMap = new Map<string, number>();
  for (const item of coverageData) {
    const key = `${item.requirementId}:${item.phaseId}`;
    coverageMap.set(key, item.coverage);
  }

  // Build 2D matrix: rows = requirements, columns = phases
  const matrix: number[][] = requirements.map((reqId) =>
    phases.map((phaseId) => {
      const key = `${reqId}:${phaseId}`;
      return coverageMap.get(key) ?? 0; // Default to uncovered
    })
  );

  return (
    <div className="space-y-4">
      <div className="overflow-auto">
        <HeatMapGrid
          xLabels={phases}
          yLabels={requirements}
          data={matrix}
          cellStyle={(_x, _y, value) => ({
            background: getColorForValue(value),
          })}
          cellHeight="32px"
          xLabelsPos="top"
          yLabelsPos="left"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span
            className="w-4 h-4 rounded"
            style={{ background: 'rgb(239, 68, 68)' }}
          />
          <span>Uncovered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-4 h-4 rounded"
            style={{ background: 'rgb(250, 204, 21)' }}
          />
          <span>Partial</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="w-4 h-4 rounded"
            style={{ background: 'rgb(34, 197, 94)' }}
          />
          <span>Covered</span>
        </div>
      </div>
    </div>
  );
}
