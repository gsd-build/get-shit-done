'use client';

import { PlanCard, type Plan } from './PlanCard';

export interface Wave {
  id: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  plans: Plan[];
}

interface Props {
  wave: Wave;
  waveNumber: number;
}

const STATUS_COLORS = {
  running: 'border-blue-500',
  complete: 'border-green-500',
  error: 'border-red-500',
  pending: 'border-gray-300',
} as const;

export function WaveColumn({ wave, waveNumber }: Props) {
  const { status, plans } = wave;

  return (
    <li
      data-testid={`wave-column-${waveNumber}`}
      className={`flex flex-col gap-3 p-3 border-t-4 rounded-lg bg-card/50 ${STATUS_COLORS[status]}`}
      role="listitem"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Wave {waveNumber}</h3>
        <span className="text-xs text-muted-foreground capitalize">{status}</span>
      </div>
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </li>
  );
}
