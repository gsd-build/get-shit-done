import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { GapList } from './GapList';
import type { Gap } from '@/types/verification';

const mockGaps: Gap[] = [
  {
    id: 'gap-1',
    requirementId: 'REQ-001',
    description: 'Missing authentication on endpoint',
    severity: 'blocking',
  },
  {
    id: 'gap-2',
    requirementId: 'REQ-002',
    description: 'Performance regression in API',
    severity: 'major',
  },
  {
    id: 'gap-3',
    requirementId: 'REQ-003',
    description: 'Minor UI alignment issue',
    severity: 'minor',
  },
];

describe('GapList', () => {
  describe('rendering', () => {
    it('renders all gaps', () => {
      render(<GapList gaps={mockGaps} />);
      expect(screen.getByText('Missing authentication on endpoint')).toBeInTheDocument();
      expect(screen.getByText('Performance regression in API')).toBeInTheDocument();
      expect(screen.getByText('Minor UI alignment issue')).toBeInTheDocument();
    });

    it('renders SeverityBadge for each gap', () => {
      render(<GapList gaps={mockGaps} />);
      expect(screen.getByText('Blocking')).toBeInTheDocument();
      expect(screen.getByText('Major')).toBeInTheDocument();
      expect(screen.getByText('Minor')).toBeInTheDocument();
    });

    it('renders requirement ID for each gap', () => {
      render(<GapList gaps={mockGaps} />);
      expect(screen.getByText('REQ-001')).toBeInTheDocument();
      expect(screen.getByText('REQ-002')).toBeInTheDocument();
      expect(screen.getByText('REQ-003')).toBeInTheDocument();
    });

    it('renders gap description', () => {
      render(<GapList gaps={mockGaps} />);
      expect(screen.getByText('Missing authentication on endpoint')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('can filter by severity (show only blocking)', () => {
      render(<GapList gaps={mockGaps} filterSeverity="blocking" />);
      expect(screen.getByText('Missing authentication on endpoint')).toBeInTheDocument();
      expect(screen.queryByText('Performance regression in API')).not.toBeInTheDocument();
      expect(screen.queryByText('Minor UI alignment issue')).not.toBeInTheDocument();
    });

    it('can filter by severity (show only major)', () => {
      render(<GapList gaps={mockGaps} filterSeverity="major" />);
      expect(screen.queryByText('Missing authentication on endpoint')).not.toBeInTheDocument();
      expect(screen.getByText('Performance regression in API')).toBeInTheDocument();
      expect(screen.queryByText('Minor UI alignment issue')).not.toBeInTheDocument();
    });

    it('can filter by severity (show only minor)', () => {
      render(<GapList gaps={mockGaps} filterSeverity="minor" />);
      expect(screen.queryByText('Missing authentication on endpoint')).not.toBeInTheDocument();
      expect(screen.queryByText('Performance regression in API')).not.toBeInTheDocument();
      expect(screen.getByText('Minor UI alignment issue')).toBeInTheDocument();
    });

    it('shows all gaps when filterSeverity is "all"', () => {
      render(<GapList gaps={mockGaps} filterSeverity="all" />);
      expect(screen.getByText('Missing authentication on endpoint')).toBeInTheDocument();
      expect(screen.getByText('Performance regression in API')).toBeInTheDocument();
      expect(screen.getByText('Minor UI alignment issue')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows "No gaps found" when array is empty', () => {
      render(<GapList gaps={[]} />);
      expect(screen.getByText('No gaps found')).toBeInTheDocument();
    });

    it('shows "No gaps found" when all gaps filtered out', () => {
      const onlyMinor: Gap[] = [
        {
          id: 'gap-1',
          requirementId: 'REQ-001',
          description: 'Minor issue',
          severity: 'minor',
        },
      ];
      render(<GapList gaps={onlyMinor} filterSeverity="blocking" />);
      expect(screen.getByText('No gaps found')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts by severity (blocking first, then major, then minor)', () => {
      // Pass gaps in reverse order to verify sorting
      const unorderedGaps: Gap[] = [
        { id: 'gap-3', requirementId: 'REQ-003', description: 'Minor issue', severity: 'minor' },
        { id: 'gap-1', requirementId: 'REQ-001', description: 'Blocking issue', severity: 'blocking' },
        { id: 'gap-2', requirementId: 'REQ-002', description: 'Major issue', severity: 'major' },
      ];

      render(<GapList gaps={unorderedGaps} />);

      const list = screen.getByRole('list');
      const items = within(list).getAllByRole('listitem');

      // First item should be blocking
      expect(within(items[0]!).getByText('Blocking issue')).toBeInTheDocument();
      // Second item should be major
      expect(within(items[1]!).getByText('Major issue')).toBeInTheDocument();
      // Third item should be minor
      expect(within(items[2]!).getByText('Minor issue')).toBeInTheDocument();
    });
  });
});
