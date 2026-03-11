/**
 * ExecutionPanel component
 *
 * Main container that integrates all execute phase components:
 * - ExecutionControls (fixed header)
 * - TddIndicator (in header area)
 * - PipelineView (main content)
 * - DiffPanel (right sidebar)
 * - CheckpointModal (portal)
 * - ErrorRecovery (conditional)
 *
 * Per CONTEXT.md:
 * - "Fixed header bar for pause/resume/abort controls - always visible at top"
 * - "Right sidebar for diff panel"
 */

'use client';

import { useCallback } from 'react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import {
  useExecutionStore,
  selectTddPhase,
  selectStatus,
  selectPendingCheckpoint,
  selectPlans,
  selectAgentId,
} from '@/stores/executionStore';
import type { AgentErrorEvent } from '@gsd/events';
import type { RetryContext } from '@/hooks/useErrorRecovery';
import { ExecutionControls } from './ExecutionControls';
import { TddIndicator } from './TddIndicator';
import { PipelineView } from './PipelineView';
import type { Wave } from './WaveColumn';
import { DiffPanel } from './DiffPanel';
import { CheckpointModal } from './CheckpointModal';
import { ErrorRecovery } from './ErrorRecovery';

export interface ExecutionPanelProps {
  /** Waves data for the pipeline view */
  waves: Wave[];
  /** Error event when execution fails */
  error?: AgentErrorEvent;
  /** Project path for error recovery context */
  projectPath?: string;
  /** Callback to handle checkpoint responses */
  onCheckpointResponse?: (checkpointId: string, response: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Main execution panel container with resizable layout.
 *
 * Layout structure:
 * - Fixed header: ExecutionControls + TddIndicator
 * - Resizable main area:
 *   - Left panel (70%): PipelineView
 *   - Right panel (30%): DiffPanel
 * - Portal: CheckpointModal
 * - Conditional: ErrorRecovery
 */
export function ExecutionPanel({
  waves,
  error,
  projectPath = '',
  onCheckpointResponse,
  className = '',
}: ExecutionPanelProps) {
  // Get state from store using selectors
  const tddPhase = useExecutionStore(selectTddPhase);
  const status = useExecutionStore(selectStatus);
  const pendingCheckpoint = useExecutionStore(selectPendingCheckpoint);
  const plans = useExecutionStore(selectPlans);
  const agentId = useExecutionStore(selectAgentId);
  const setCheckpoint = useExecutionStore((state) => state.setCheckpoint);

  // Handle checkpoint response
  const handleCheckpointResponse = useCallback(
    (response: string) => {
      if (pendingCheckpoint) {
        // Call external handler if provided (for Socket.IO communication)
        onCheckpointResponse?.(pendingCheckpoint.checkpointId, response);
        // Clear the checkpoint from store
        setCheckpoint(null);
      }
    },
    [pendingCheckpoint, onCheckpointResponse, setCheckpoint]
  );

  // Build execution context for error recovery
  let executionContext: RetryContext | null = null;

  // Find the current plan for context
  const plansArray = Array.from(plans.entries());
  const currentPlan = plansArray.find(([, p]) => p.status === 'running' || p.status === 'error');
  if (currentPlan) {
    executionContext = {
      planId: currentPlan[1].planId,
      taskName: currentPlan[1].taskName,
      projectPath,
    };
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Fixed header */}
      <div
        data-testid="execution-panel-header"
        className="border-b bg-card flex items-center justify-between"
      >
        <ExecutionControls />
        <div className="px-4 py-2">
          <TddIndicator phase={tddPhase} />
        </div>
      </div>

      {/* Resizable main area */}
      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize={70} minSize={50}>
          <div data-testid="pipeline-panel" className="h-full overflow-auto">
            <PipelineView waves={waves} />
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />
        <Panel defaultSize={30} minSize={20}>
          <div data-testid="diff-panel-container" className="h-full overflow-auto">
            <DiffPanel />
          </div>
        </Panel>
      </PanelGroup>

      {/* Checkpoint modal (portal) */}
      <CheckpointModal
        checkpoint={pendingCheckpoint}
        onRespond={handleCheckpointResponse}
      />

      {/* Error state */}
      {status === 'error' && error && executionContext && (
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 border-t">
          <ErrorRecovery error={error} context={executionContext} />
        </div>
      )}
    </div>
  );
}

export default ExecutionPanel;
