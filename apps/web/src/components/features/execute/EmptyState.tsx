/**
 * EmptyState component
 *
 * Provides clear "next action" guidance for idle/empty execute states.
 * Shows different content based on connection status and available phases.
 */

'use client';

import { Play, Loader2, FileCode, FolderOpen, AlertCircle } from 'lucide-react';

interface Phase {
  number: number;
  name: string;
  status: string;
  plans: number;
  completedPlans: number;
}

export interface EmptyStateProps {
  /** Whether socket is connected */
  isConnected: boolean;
  /** Available phases for execution */
  phases: Phase[];
  /** Currently selected phase number */
  selectedPhase: number | null;
  /** Whether execution is starting */
  isStarting: boolean;
  /** Error message from start attempt */
  startError: string | null;
  /** Callback when phase selection changes */
  onPhaseSelect: (phaseNumber: number) => void;
  /** Callback to start execution */
  onStartExecution: () => void;
}

/**
 * Empty state with clear next-action guidance.
 *
 * States handled:
 * 1. Disconnected - Shows connection required message
 * 2. Connected, no phases - Shows how to create phases
 * 3. Connected, has phases - Shows phase selector and start button
 */
export function EmptyState({
  isConnected,
  phases,
  selectedPhase,
  isStarting,
  startError,
  onPhaseSelect,
  onStartExecution,
}: EmptyStateProps) {
  // Disconnected state
  if (!isConnected) {
    return (
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-yellow-500" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Connection Required
        </h2>
        <p className="text-muted-foreground mb-4">
          Connect to the backend server to start executing phases. Use the connection
          controls in the header to retry or diagnose the issue.
        </p>
        <div className="text-sm text-zinc-500 bg-zinc-800/50 rounded-lg p-4 text-left">
          <p className="font-medium mb-2">Next steps:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>Click &quot;Retry&quot; to attempt reconnection</li>
            <li>Click &quot;Check Backend&quot; to verify server status</li>
            <li>View diagnostics for connection details</li>
          </ol>
        </div>
      </div>
    );
  }

  // No phases available
  if (phases.length === 0) {
    return (
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-500/10 flex items-center justify-center">
          <FolderOpen className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          No Phases Found
        </h2>
        <p className="text-muted-foreground mb-4">
          This project doesn&apos;t have any executable phases yet. Create plan files
          to enable execution.
        </p>
        <div className="text-sm text-zinc-500 bg-zinc-800/50 rounded-lg p-4 text-left">
          <p className="font-medium mb-2">How to create phases:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>
              Create a phase directory:{' '}
              <code className="text-xs bg-zinc-700 px-1 rounded">
                .planning/phases/01-feature-name/
              </code>
            </li>
            <li>
              Add a plan file:{' '}
              <code className="text-xs bg-zinc-700 px-1 rounded">01-01-PLAN.md</code>
            </li>
            <li>Refresh this page to see your phases</li>
          </ol>
        </div>
      </div>
    );
  }

  // Has phases - show selector and start
  const executablePhases = phases.filter((p) => p.plans > 0);
  const readyPhases = executablePhases.filter((p) => p.status !== 'completed');
  const completedPhases = executablePhases.filter((p) => p.status === 'completed');

  if (executablePhases.length === 0) {
    return (
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-500/10 flex items-center justify-center">
          <FileCode className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          No Executable Plans Yet
        </h2>
        <p className="text-muted-foreground mb-4">
          Phases exist, but none contain runnable plan files. Add plan files to a phase
          before starting execution.
        </p>
        <div className="text-sm text-zinc-500 bg-zinc-800/50 rounded-lg p-4 text-left">
          <p className="font-medium mb-2">Next steps:</p>
          <ol className="list-decimal ml-4 space-y-1">
            <li>
              Add plan files such as{' '}
              <code className="text-xs bg-zinc-700 px-1 rounded">17-01-PLAN.md</code>
            </li>
            <li>Refresh the execute page</li>
            <li>Start execution once at least one phase shows plans</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center max-w-lg">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/10 flex items-center justify-center">
        <FileCode className="w-8 h-8 text-blue-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Ready to Execute
      </h2>
      <p className="text-muted-foreground mb-6">
        Select a phase and start execution to see real-time progress with streaming
        logs, tool calls, and checkpoints.
      </p>

      {/* Phase selector */}
      <div className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <select
            value={selectedPhase ?? ''}
            onChange={(e) => onPhaseSelect(Number(e.target.value))}
            className="px-4 py-2.5 border border-zinc-700 rounded-lg bg-zinc-800 text-foreground min-w-[280px] focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isStarting}
          >
            <option value="" disabled>
              Select a phase to execute...
            </option>
            {readyPhases.length > 0 && (
              <optgroup label="Ready to Execute">
                {readyPhases.map((phase) => (
                  <option key={phase.number} value={phase.number}>
                    Phase {phase.number}: {phase.name} ({phase.completedPlans}/
                    {phase.plans} plans)
                  </option>
                ))}
              </optgroup>
            )}
            {completedPhases.length > 0 && (
              <optgroup label="Completed (re-run)">
                {completedPhases.map((phase) => (
                  <option key={phase.number} value={phase.number}>
                    Phase {phase.number}: {phase.name} (completed)
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <button
            type="button"
            onClick={onStartExecution}
            disabled={!selectedPhase || isStarting}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStarting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Start Execution</span>
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {startError && (
          <div className="flex items-center justify-center gap-2 text-sm text-red-400 bg-red-500/10 px-4 py-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span>{startError}</span>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 mt-4">
          <span>{phases.length} total phases</span>
          <span>{readyPhases.length} ready</span>
          <span>{completedPhases.length} completed</span>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;
