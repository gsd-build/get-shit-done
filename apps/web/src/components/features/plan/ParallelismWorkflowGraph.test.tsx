import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParallelismWorkflowGraph } from './ParallelismWorkflowGraph';
import type { ParallelismWorkflowNode } from '@/types/plan';

const nodes: ParallelismWorkflowNode[] = [
  {
    id: '18.1-01',
    label: 'Control foundation',
    wave: 1,
    status: 'complete',
    dependsOn: [],
  },
  {
    id: '18.1-02',
    label: 'Graph integration',
    wave: 2,
    status: 'blocked',
    dependsOn: ['18.1-01'],
    blockerDetails: [
      {
        id: 'b-1',
        reason: 'Upstream run still active',
        dependsOn: ['18.1-01'],
        resolutionHint: 'Pause or wait for upstream completion',
      },
    ],
  },
];

describe('ParallelismWorkflowGraph', () => {
  it('renders nodes grouped by wave', () => {
    render(<ParallelismWorkflowGraph nodes={nodes} />);

    expect(screen.getByText('Wave 1')).toBeInTheDocument();
    expect(screen.getByText('Wave 2')).toBeInTheDocument();
    expect(screen.getByText('Control foundation')).toBeInTheDocument();
    expect(screen.getByText('Graph integration')).toBeInTheDocument();
  });

  it('toggles blocker details for blocked nodes', async () => {
    const user = userEvent.setup();
    render(<ParallelismWorkflowGraph nodes={nodes} />);

    await user.click(screen.getByRole('button', { name: /show blocker details/i }));
    expect(screen.getByText(/Upstream run still active/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide blocker details/i }));
    expect(screen.queryByText(/Upstream run still active/)).not.toBeInTheDocument();
  });
});
