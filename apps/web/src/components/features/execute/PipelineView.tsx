'use client';

import { WaveColumn, type Wave } from './WaveColumn';

interface Props {
  waves: Wave[];
}

export function PipelineView({ waves }: Props) {
  if (waves.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No waves to display</p>
      </div>
    );
  }

  return (
    <ul
      className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto p-4"
      role="list"
      aria-label="Execution waves"
    >
      {waves.map((wave, index) => (
        <WaveColumn key={wave.id} wave={wave} waveNumber={index + 1} />
      ))}
    </ul>
  );
}
