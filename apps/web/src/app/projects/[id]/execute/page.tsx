/**
 * Execute Phase Page
 *
 * Full-screen execution view for running GSD plans.
 * Uses Socket.IO for real-time agent event streaming.
 *
 * Route: /projects/[id]/execute
 */

'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import { EVENTS } from '@gsd/events';
import { ExecutionPanel } from '@/components/features/execute';
import type { Wave } from '@/components/features/execute/WaveColumn';
import { useSocket } from '@/hooks/useSocket';
import { useAgentSubscription } from '@/hooks/useAgentSubscription';
import { useCheckpointResponse } from '@/hooks/useCheckpointResponse';
import { useExecutionStore, selectPlans, selectStatus } from '@/stores/executionStore';

// Socket.IO server URL - configurable via env
const SOCKET_URL = process.env['NEXT_PUBLIC_SOCKET_URL'] || 'http://localhost:3001';

/**
 * Build waves from the execution store plans.
 *
 * For now, all plans are in a single wave since we don't have wave metadata
 * from the backend yet. Future: plans would include wave assignments.
 */
function buildWavesFromPlans(
  plans: Map<string, { planId: string; taskName: string; status: string; logs: string }>
): Wave[] {
  if (plans.size === 0) {
    return [];
  }

  // Convert plans map to array of Plan objects for PipelineView
  const planArray = Array.from(plans.values()).map((plan) => ({
    id: plan.planId,
    name: plan.taskName,
    status: plan.status as 'pending' | 'running' | 'complete' | 'error',
    logs: plan.logs,
  }));

  // Determine wave status based on plan statuses
  const hasError = planArray.some((p) => p.status === 'error');
  const allComplete = planArray.every((p) => p.status === 'complete');
  const hasRunning = planArray.some((p) => p.status === 'running');

  let waveStatus: 'pending' | 'running' | 'complete' | 'error' = 'pending';
  if (hasError) {
    waveStatus = 'error';
  } else if (allComplete) {
    waveStatus = 'complete';
  } else if (hasRunning) {
    waveStatus = 'running';
  }

  return [
    {
      id: 'wave-1',
      status: waveStatus,
      plans: planArray,
    },
  ];
}

export default function ExecutePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const projectId = params['id'] as string;
  const agentIdFromUrl = searchParams.get('agentId');

  // Track the active agent ID
  const [activeAgentId, setActiveAgentId] = useState<string | null>(agentIdFromUrl);

  // Connect to Socket.IO server
  const { socket, isConnected } = useSocket(SOCKET_URL);

  // Subscribe to agent events
  useAgentSubscription(socket, activeAgentId);

  // Get checkpoint response handler
  const { respondToCheckpoint } = useCheckpointResponse(socket);

  // Get execution state from store
  const plans = useExecutionStore(selectPlans);
  const status = useExecutionStore(selectStatus);
  const store = useExecutionStore();

  // Build waves from plans
  const waves = useMemo(() => buildWavesFromPlans(plans), [plans]);

  // Handle checkpoint responses by emitting to socket
  const handleCheckpointResponse = useCallback(
    (checkpointId: string, response: string) => {
      respondToCheckpoint(checkpointId, response);
    },
    [respondToCheckpoint]
  );

  // Listen for agent:started events to capture the agent ID
  useEffect(() => {
    if (!socket) return;

    const handleAgentStarted = (event: { agentId: string }) => {
      // Only set if we don't have one yet
      if (!activeAgentId) {
        setActiveAgentId(event.agentId);
      }
    };

    socket.on(EVENTS.AGENT_START, handleAgentStarted);

    return () => {
      socket.off(EVENTS.AGENT_START, handleAgentStarted);
    };
  }, [socket, activeAgentId]);

  // Reset store when leaving the page
  useEffect(() => {
    return () => {
      store.reset();
    };
  }, [store]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top navigation bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b bg-card/50">
        <button
          type="button"
          onClick={() => router.push(`/projects/${projectId}`)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Project</span>
        </button>

        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div
            data-testid="connection-status"
            data-connected={isConnected}
            className={`flex items-center gap-1.5 text-xs ${
              isConnected ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Disconnected</span>
              </>
            )}
          </div>

          {/* Execution status badge */}
          {status !== 'idle' && (
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                status === 'running'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  : status === 'paused'
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : status === 'error'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : status === 'complete'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
        </div>
      </header>

      {/* Main execution panel */}
      <main className="flex-1 overflow-hidden">
        <ExecutionPanel
          waves={waves}
          projectPath={`/projects/${projectId}`}
          onCheckpointResponse={handleCheckpointResponse}
          className="h-full"
        />
      </main>

      {/* Empty state when no execution is running */}
      {status === 'idle' && waves.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center pointer-events-auto">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Execution Running
            </h2>
            <p className="text-muted-foreground mb-4">
              Start a plan execution to see real-time progress here.
            </p>
            {!isConnected && (
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                Socket.IO server is not connected. Make sure the backend is running.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
