import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionOptionsPanel } from './DecisionOptionsPanel';
import type { DiscussDecision } from '@/stores/discussStore';

const decisions: DiscussDecision[] = [
  {
    id: 'd-1',
    question: 'Which rendering strategy should we use?',
    options: [
      { id: 'o-1', label: 'Server rendering', recommended: true },
      { id: 'o-2', label: 'Client rendering' },
      { id: 'o-3', label: 'Static export' },
    ],
  },
];

describe('DecisionOptionsPanel', () => {
  it('renders recommended options first with label', () => {
    render(
      <DecisionOptionsPanel
        decisions={decisions}
        onChooseOption={vi.fn()}
        onAcceptAllDefaults={vi.fn()}
      />
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('1. Server rendering (Recommended)');
  });

  it('renders "Accept all defaults" action', () => {
    render(
      <DecisionOptionsPanel
        decisions={decisions}
        onChooseOption={vi.fn()}
        onAcceptAllDefaults={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Accept all defaults' })).toBeInTheDocument();
  });

  it('invokes handlers for option selection and accept-all', async () => {
    const onChooseOption = vi.fn();
    const onAcceptAllDefaults = vi.fn();

    render(
      <DecisionOptionsPanel
        decisions={decisions}
        onChooseOption={onChooseOption}
        onAcceptAllDefaults={onAcceptAllDefaults}
      />
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Server rendering/ }));
    await user.click(screen.getByRole('button', { name: 'Accept all defaults' }));

    expect(onChooseOption).toHaveBeenCalledWith('d-1', 'o-1');
    expect(onAcceptAllDefaults).toHaveBeenCalledTimes(1);
  });
});
