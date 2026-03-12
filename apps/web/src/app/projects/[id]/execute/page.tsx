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
import { ArrowLeft } from 'lucide-react';
import { EVENTS } from '@gsd/events';
import { ExecutionPanel } from '@/components/features/execute';
import { ConnectionStatus } from '@/components/features/execute/ConnectionStatus';
import { EmptyState } from '@/components/features/execute/EmptyState';
import type { Wave } from '@/components/features/execute/WaveColumn';
import { useSocket } from '@/hooks/useSocket';
import { useAgentSubscription } from '@/hooks/useAgentSubscription';
import { useCheckpointResponse } from '@/hooks/useCheckpointResponse';
import { API_PROXY_BASE, HEALTH_SUMMARY_URL, SOCKET_BASE } from '@/lib/endpoints';
import { useExecutionStore, selectPlans, selectStatus } from '@/stores/executionStore';

const SOCKET_URL = SOCKET_BASE;
const API_URL = API_PROXY_BASE;

interface Phase {
  number: number;
  name: string;
  status: string;
  plans: number;
  completedPlans: number;
}

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

  // Track phases and execution state
  const [phases, setPhases] = useState<Phase[]>([]);
  const [selectedPhase, setSelectedPhase] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Connect to Socket.IO server
  const { socket, isConnected, reconnect } = useSocket(SOCKET_URL);

  // Subscribe to agent events
  useAgentSubscription(socket, activeAgentId);

  // Get checkpoint response handler
  const { respondToCheckpoint } = useCheckpointResponse(socket);

  // Get execution state from store
  const plans = useExecutionStore(selectPlans);
  const status = useExecutionStore(selectStatus);
  const reset = useExecutionStore((s) => s.reset);

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
      reset();
    };
  }, [reset]);

  // Fetch phases for the project
  useEffect(() => {
    const fetchPhases = async () => {
      try {
        const response = await fetch(`${API_URL}/projects/${projectId}/phases`);
        if (!response.ok) return;
        const json = await response.json();
        const phaseList = json.data?.phases ?? [];
        setPhases(phaseList);
        // Auto-select first phase that's not completed
        const readyPhase = phaseList.find((p: Phase) => p.status !== 'completed');
        if (readyPhase) {
          setSelectedPhase(readyPhase.number);
        }
      } catch {
        // Ignore errors - phases are optional
      }
    };
    fetchPhases();
  }, [projectId]);

  // Start execution for selected phase
  const handleStartExecution = async () => {
    if (!selectedPhase || isStarting) return;

    setIsStarting(true);
    setStartError(null);

    try {
      const response = await fetch(`${API_URL}/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseNumber: selectedPhase }),
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error?.message || 'Failed to start execution');
      }

      // Subscribe to first agent's events
      const agents = json.data?.agents ?? [];
      if (agents.length > 0 && agents[0].agentId) {
        setActiveAgentId(agents[0].agentId);
      }
    } catch (err) {
      setStartError((err as Error).message);
    } finally {
      setIsStarting(false);
    }
  };

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
          {/* Connection status with recovery CTAs */}
          <ConnectionStatus
            isConnected={isConnected}
            socketUrl={SOCKET_URL}
            healthSummaryUrl={HEALTH_SUMMARY_URL}
            onRetryConnection={reconnect}
          />

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
          <div className="pointer-events-auto">
            <EmptyState
              isConnected={isConnected}
              phases={phases}
              selectedPhase={selectedPhase}
              isStarting={isStarting}
              startError={startError}
              onPhaseSelect={setSelectedPhase}
              onStartExecution={handleStartExecution}
            />
          </div>
        </div>
      )}
    </div>
  );
}
