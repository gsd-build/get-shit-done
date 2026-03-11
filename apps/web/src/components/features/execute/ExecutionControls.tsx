/**
 * ExecutionControls component
 *
 * Fixed header control bar for pause/resume/abort controls.
 * Per CONTEXT.md: "Fixed header bar for pause/resume/abort controls - always visible at top of execution panel"
 */

'use client';

import { useState, useMemo } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { useExecutionStore } from '@/stores/executionStore';
import { useAgentControl } from '@/hooks/useAgentControl';
import { AbortConfirmDialog } from './AbortConfirmDialog';

/**
 * Fixed position header bar with execution controls.
 *
 * Features:
 * - Pause button visible when running
 * - Resume button visible when paused
 * - Abort button always visible (opens confirmation dialog)
 * - Shows current plan name and status badge
 */
export function ExecutionControls() {
  const [isAbortDialogOpen, setIsAbortDialogOpen] = useState(false);

  // Select state from store
  const agentId = useExecutionStore((state) => state.agentId);
  const status = useExecutionStore((state) => state.status);
  const plans = useExecutionStore((state) => state.plans);
  const commits = useExecutionStore((state) => state.commits);

  // Get control functions
  const { pause, resume, abort, isLoading } = useAgentControl(agentId);

  // Find the active plan
  const activePlan = useMemo(() => {
    const planEntries = Array.from(plans.entries());
    const running = planEntries.find(([, plan]) => plan.status === 'running');
    if (running) return running[1];
    // If no running plan, return the last plan
    if (planEntries.length > 0) {
      const lastEntry = planEntries[planEntries.length - 1];
      return lastEntry ? lastEntry[1] : null;
    }
    return null;
  }, [plans]);

  // Get files modified from tool calls
  const filesModified = useMemo(() => {
    const files = new Set<string>();
    plans.forEach((plan) => {
      plan.toolCalls.forEach((tool) => {
        // Extract file paths from Write, Edit, Read tool inputs
        if (tool.toolName === 'Write' || tool.toolName === 'Edit' || tool.toolName === 'Read') {
          const input = tool.input as { file_path?: string };
          if (input.file_path) {
            files.add(input.file_path);
          }
        }
      });
    });
    return Array.from(files);
  }, [plans]);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;

  const handlePause = async () => {
    try {
      await pause();
    } catch (error) {
      console.error('Failed to pause execution:', error);
    }
  };

  const handleResume = async () => {
    try {
      await resume();
    } catch (error) {
      console.error('Failed to resume execution:', error);
    }
  };

  const handleAbortConfirm = async (rollback: boolean) => {
    try {
      await abort(rollback);
      setIsAbortDialogOpen(false);
    } catch (error) {
      console.error('Failed to abort execution:', error);
    }
  };

  // Status badge styling
  const statusBadgeClass = {
    idle: 'bg-zinc-700 text-zinc-300',
    running: 'bg-green-600 text-white',
    paused: 'bg-amber-600 text-white',
    complete: 'bg-blue-600 text-white',
    error: 'bg-red-600 text-white',
  }[status];

  return (
    <>
      <div
        role="toolbar"
        aria-label="Execution controls"
        className="sticky top-0 z-50 flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800"
      >
        {/* Left: Plan info and status */}
        <div className="flex items-center gap-3">
          {activePlan && (
            <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px]">
              {activePlan.taskName}
            </span>
          )}
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${statusBadgeClass}`}
          >
            {status}
          </span>
        </div>

        {/* Right: Control buttons */}
        <div className="flex items-center gap-2">
          {/* Pause/Resume button */}
          {isRunning && (
            <button
              type="button"
              onClick={handlePause}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              aria-label="Pause execution"
            >
              <Pause className="w-4 h-4" />
              Pause
            </button>
          )}

          {isPaused && (
            <button
              type="button"
              onClick={handleResume}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
              aria-label="Resume execution"
            >
              <Play className="w-4 h-4" />
              Resume
            </button>
          )}

          {/* Abort button */}
          <button
            type="button"
            onClick={() => setIsAbortDialogOpen(true)}
            disabled={!isActive || isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            aria-label="Abort execution"
          >
            <X className="w-4 h-4" />
            Abort
          </button>
        </div>
      </div>

      {/* Abort confirmation dialog */}
      <AbortConfirmDialog
        open={isAbortDialogOpen}
        onClose={() => setIsAbortDialogOpen(false)}
        onConfirm={handleAbortConfirm}
        filesModified={filesModified}
        commitCount={commits.length}
      />
    </>
  );
}
