import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoverageHeatmap } from './CoverageHeatmap';
import type { Coverage } from './CoverageHeatmap';

// Mock react-grid-heatmap since it doesn't work well in jsdom
vi.mock('react-grid-heatmap', () => ({
  HeatMapGrid: vi.fn(({ xLabels, yLabels, data, cellStyle }) => {
    // Render a mock representation for testing
    return (
      <div data-testid="heatmap-mock">
        <div data-testid="x-labels">{xLabels.join(',')}</div>
        <div data-testid="y-labels">{yLabels.join(',')}</div>
        <div data-testid="data-rows">
          {data.map((row: number[], rowIndex: number) => (
            <div key={rowIndex} data-testid={`row-${rowIndex}`}>
              {row.map((value: number, colIndex: number) => {
                const style = cellStyle?.(0, 0, value);
                return (
                  <span
                    key={colIndex}
                    data-testid={`cell-${rowIndex}-${colIndex}`}
                    data-value={value}
                    style={style}
                  >
                    {value}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }),
}));

const mockCoverageData: Coverage[] = [
  { requirementId: 'REQ-001', phaseId: 'phase-1', coverage: 2 },
  { requirementId: 'REQ-001', phaseId: 'phase-2', coverage: 1 },
  { requirementId: 'REQ-002', phaseId: 'phase-1', coverage: 0 },
  { requirementId: 'REQ-002', phaseId: 'phase-2', coverage: 2 },
];

describe('CoverageHeatmap', () => {
  describe('rendering', () => {
    it('renders with correct number of cells', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001', 'REQ-002']}
          phases={['phase-1', 'phase-2']}
          coverageData={mockCoverageData}
        />
      );

      // 2 requirements x 2 phases = 4 cells
      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument();
      expect(screen.getByTestId('cell-0-1')).toBeInTheDocument();
      expect(screen.getByTestId('cell-1-0')).toBeInTheDocument();
      expect(screen.getByTestId('cell-1-1')).toBeInTheDocument();
    });

    it('passes correct labels to heatmap', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001', 'REQ-002']}
          phases={['phase-1', 'phase-2']}
          coverageData={mockCoverageData}
        />
      );

      expect(screen.getByTestId('x-labels')).toHaveTextContent('phase-1,phase-2');
      expect(screen.getByTestId('y-labels')).toHaveTextContent('REQ-001,REQ-002');
    });
  });

  describe('cell colors', () => {
    it('uncovered cells have red background', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001', 'REQ-002']}
          phases={['phase-1', 'phase-2']}
          coverageData={mockCoverageData}
        />
      );

      // REQ-002 x phase-1 = 0 (uncovered)
      const uncoveredCell = screen.getByTestId('cell-1-0');
      expect(uncoveredCell).toHaveAttribute('data-value', '0');
      expect(uncoveredCell).toHaveStyle({ background: 'rgb(239, 68, 68)' });
    });

    it('partial cells have yellow background', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001', 'REQ-002']}
          phases={['phase-1', 'phase-2']}
          coverageData={mockCoverageData}
        />
      );

      // REQ-001 x phase-2 = 1 (partial)
      const partialCell = screen.getByTestId('cell-0-1');
      expect(partialCell).toHaveAttribute('data-value', '1');
      expect(partialCell).toHaveStyle({ background: 'rgb(250, 204, 21)' });
    });

    it('covered cells have green background', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001', 'REQ-002']}
          phases={['phase-1', 'phase-2']}
          coverageData={mockCoverageData}
        />
      );

      // REQ-001 x phase-1 = 2 (covered)
      const coveredCell = screen.getByTestId('cell-0-0');
      expect(coveredCell).toHaveAttribute('data-value', '2');
      expect(coveredCell).toHaveStyle({ background: 'rgb(34, 197, 94)' });
    });
  });

  describe('legend', () => {
    it('renders legend with color explanations', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001']}
          phases={['phase-1']}
          coverageData={[{ requirementId: 'REQ-001', phaseId: 'phase-1', coverage: 2 }]}
        />
      );

      expect(screen.getByText('Uncovered')).toBeInTheDocument();
      expect(screen.getByText('Partial')).toBeInTheDocument();
      expect(screen.getByText('Covered')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('handles empty data gracefully', () => {
      render(
        <CoverageHeatmap
          requirements={[]}
          phases={[]}
          coverageData={[]}
        />
      );

      expect(screen.getByText('No coverage data available')).toBeInTheDocument();
    });

    it('handles missing coverage data with uncovered default', () => {
      render(
        <CoverageHeatmap
          requirements={['REQ-001']}
          phases={['phase-1']}
          coverageData={[]} // No coverage data for this combination
        />
      );

      // Should default to uncovered (0)
      const cell = screen.getByTestId('cell-0-0');
      expect(cell).toHaveAttribute('data-value', '0');
    });
  });
});
