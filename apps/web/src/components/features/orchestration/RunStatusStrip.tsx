'use client';

import { useMemo } from 'react';
import { Play, Pause, RefreshCw } from 'lucide-react';
import type { OrchestrationRun } from '@/stores/orchestrationStore';

interface RunStatusStripProps {
  run: OrchestrationRun | null;
  onQuickAction?: () => void;
}

function statusClass(status: OrchestrationRun['status']): string {
  switch (status) {
    case 'active':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'paused':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'blocked':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'complete':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    default:
      return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-300';
  }
}

function quickActionLabel(status: OrchestrationRun['status']): string {
  if (status === 'paused') return 'Resume';
  if (status === 'active') return 'Pause';
  return 'Refresh';
}

function quickIcon(status: OrchestrationRun['status']) {
  if (status === 'paused') return <Play className="w-3 h-3" />;
  if (status === 'active') return <Pause className="w-3 h-3" />;
  return <RefreshCw className="w-3 h-3" />;
}

export function RunStatusStrip({ run, onQuickAction }: RunStatusStripProps) {
  const label = useMemo(() => (run ? quickActionLabel(run.status) : 'Refresh'), [run]);

  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">Run status</p>
        {run ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-medium truncate">{run.name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide ${statusClass(run.status)}`}>
              {run.status}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">No run selected</p>
        )}
      </div>

      <button
        type="button"
        onClick={onQuickAction}
        className="inline-flex items-center gap-1 min-h-9 px-2 rounded-md border border-border text-xs hover:bg-muted/40"
      >
        {run ? quickIcon(run.status) : <RefreshCw className="w-3 h-3" />}
        {label}
      </button>
    </div>
  );
}
