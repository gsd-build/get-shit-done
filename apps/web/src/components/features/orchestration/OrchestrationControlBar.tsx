'use client';

import { useMemo } from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useOrchestrationControl } from '@/hooks/useOrchestrationControl';
import {
  useOrchestrationStore,
  selectSelectedOrchestrationRun,
} from '@/stores/orchestrationStore';
import { ControlActionConfirmDialog } from './ControlActionConfirmDialog';
import { RevalidationSummaryPanel } from './RevalidationSummaryPanel';

interface OrchestrationControlBarProps {
  projectId: string;
  phaseId: string;
}

export function OrchestrationControlBar({ projectId, phaseId }: OrchestrationControlBarProps) {
  const selectedRun = useOrchestrationStore(selectSelectedOrchestrationRun);
  const {
    pendingAction,
    isLoading,
    error,
    revalidation,
    requestAction,
    confirmAction,
    cancelAction,
    assessParallelism,
    revalidateBeforeResume,
  } = useOrchestrationControl(projectId);

  const runName = selectedRun?.name ?? 'current run';

  const actionButtons = useMemo(
    () => [
      { id: 'start', label: 'Start', icon: Play },
      { id: 'pause', label: 'Pause', icon: Pause },
      { id: 'resume', label: 'Resume', icon: Play },
      { id: 'abort', label: 'Abort', icon: Square },
      { id: 'retryFailedStep', label: 'Retry', icon: RotateCcw },
    ] as const,
    []
  );

  return (
    <section className="rounded-lg border border-border bg-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Orchestration Controls</h2>
          <p className="text-xs text-muted-foreground">
            Shared run controls across discuss, plan, execute, and verify.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => assessParallelism(phaseId)}
            className="min-h-10 px-3 rounded-md border border-border text-xs hover:bg-muted/40"
          >
            Refresh Parallelism
          </button>
          {actionButtons.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={async () => {
                if (!selectedRun) return;
                if (id === 'resume') {
                  const passed = await revalidateBeforeResume(selectedRun.id);
                  if (!passed) return;
                }
                requestAction(id, selectedRun.id);
              }}
              disabled={!selectedRun || isLoading}
              className="inline-flex items-center gap-1 min-h-10 px-3 rounded-md border border-border text-xs disabled:opacity-50 hover:bg-muted/40"
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 text-red-700 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <RevalidationSummaryPanel summary={revalidation} />

      {pendingAction?.requiresConfirmation && (
        <ControlActionConfirmDialog
          open={true}
          action={pendingAction.action}
          runName={runName}
          details={[
            'Dependency checks are enforced by the server before lifecycle changes.',
            'Paused edit locks and recovery states are preserved across pages.',
          ]}
          isSubmitting={isLoading}
          onCancel={cancelAction}
          onConfirm={confirmAction}
        />
      )}
    </section>
  );
}
