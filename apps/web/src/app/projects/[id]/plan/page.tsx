'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Play } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useResearchStream } from '@/hooks/useResearchStream';
import {
  usePlanStore,
  selectAgents,
  selectIsEditLocked,
} from '@/stores/planStore';
import {
  ResearchSwimlanes,
  PlanKanban,
  ParallelismWorkflowGraph,
} from '@/components/features/plan';
import {
  updatePlanTask,
  startResearch,
  fetchParallelismWorkflow,
} from '@/lib/api';
import { resolveSocketBase } from '@/lib/endpoints';
import type { ResearchAgent, PlanTask, ParallelismWorkflowNode } from '@/types/plan';
import {
  OrchestrationControlBar,
  RunStatusStrip,
} from '@/components/features/orchestration';
import {
  useOrchestrationStore,
  selectSelectedOrchestrationRun,
} from '@/stores/orchestrationStore';
import { WorkflowHeader } from '@/components/features/projects/WorkflowHeader';
import { NewPlanModal } from '@/components/features/projects/NewPlanModal';
import { usePlanData } from '@/hooks/usePlanData';

const SOCKET_URL = resolveSocketBase();

/**
 * Plan Phase Page - Research swimlanes and Kanban preview.
 *
 * Shows research agent progress via streaming and plan tasks in Kanban view.
 * Allows inline editing of task titles/descriptions.
 */
export default function PlanPhasePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params['id'] as string;

  // Socket.IO connection for real-time updates
  const { socket, isConnected } = useSocket(SOCKET_URL);

  // Research agent streaming via useResearchStream hook
  const { agents, isLoading: isResearchLoading } = useResearchStream(
    socket,
    projectId
  );

  // Plan state from Zustand store
  const storeAgents = usePlanStore(selectAgents);
  const isEditLocked = usePlanStore(selectIsEditLocked);

  const {
    planData,
    isLoading: isLoadingPlan,
    planError,
    loadPlan,
    patchTask,
  } = usePlanData(projectId);

  const [isStartingResearch, setIsStartingResearch] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [workflow, setWorkflow] = useState<ParallelismWorkflowNode[]>([]);
  const setRuns = useOrchestrationStore((state) => state.setRuns);
  const setSelectedRun = useOrchestrationStore((state) => state.setSelectedRun);
  const setWorkflowStore = useOrchestrationStore((state) => state.setWorkflow);
  const selectedRun = useOrchestrationStore(selectSelectedOrchestrationRun);
  const agentsArray: ResearchAgent[] = Array.from(storeAgents.values());
  const hasRunningAgents = agentsArray.some((a) => a.status === 'running');
  const selectedGapIds = (searchParams.get('gaps') || '')
    .split(',')
    .map((gap) => gap.trim())
    .filter(Boolean);

  useEffect(() => {
    async function loadWorkflow() {
      const response = await fetchParallelismWorkflow(projectId);
      if (response.success) {
        setWorkflow(response.data);
        setWorkflowStore(response.data);
      }
    }
    loadWorkflow();
  }, [projectId, setWorkflowStore]);

  useEffect(() => {
    const runId = `${projectId}:plan`;
    setRuns([
      {
        id: runId,
        phaseId: 'plan',
        name: 'Plan Orchestration',
        status: hasRunningAgents ? 'active' : 'paused',
        updatedAt: new Date().toISOString(),
        isEditingLocked: hasRunningAgents,
      },
    ]);
    setSelectedRun(runId);
  }, [projectId, hasRunningAgents, setRuns, setSelectedRun]);

  // Handle starting research
  const handleStartResearch = async () => {
    setIsStartingResearch(true);
    try {
      await startResearch(projectId);
    } finally {
      setIsStartingResearch(false);
    }
  };

  // Handle task edit via API
  const handleTaskEdit = async (
    taskId: string,
    updates: { title: string; description: string }
  ) => {
    if (isEditLocked) {
      return;
    }

    const response = await updatePlanTask(projectId, taskId, {
      name: updates.title,
      description: updates.description,
    });

    // Update local state if successful
    if (response.success && response.data) {
      patchTask(taskId, (task) => ({
        ...task,
        name: updates.title,
        description: updates.description,
      }));
    }
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <WorkflowHeader
          projectId={projectId}
          title="Planning Phase"
          subtitle={`Project: ${projectId}${isConnected ? ' · Connected' : ''}`}
          onNewPlan={() => setShowNewPlan(true)}
        />

        {/* Start Research button */}
        {!hasRunningAgents && (
          <div className="mb-8">
            <button
              type="button"
              onClick={handleStartResearch}
              disabled={isStartingResearch}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isStartingResearch ? 'Starting...' : 'Start Research'}
            </button>
          </div>
        )}

        {selectedGapIds.length > 0 && (
          <section
            className="mb-8 border border-blue-300 bg-blue-50 rounded-lg p-4"
            data-testid="fix-plans-panel"
          >
            <h2 className="text-sm font-semibold text-blue-900 mb-2">
              Fix Plans from selected gaps
            </h2>
            <p className="text-sm text-blue-800 mb-3">
              Create follow-up plans for the selected verification gaps.
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedGapIds.map((gapId) => (
                <span
                  key={gapId}
                  className="px-2 py-1 text-xs bg-white border border-blue-300 rounded-full"
                >
                  {gapId}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="mb-6 space-y-3">
          <OrchestrationControlBar projectId={projectId} phaseId="plan" />
          <RunStatusStrip run={selectedRun} />
        </div>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Workflow Parallelism
          </h2>
          <ParallelismWorkflowGraph nodes={workflow} />
        </section>

        {/* Research Progress Section */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Research Progress
          </h2>
          <div className="bg-card border border-border rounded-lg">
            {agentsArray.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No research agents running. Click &quot;Start Research&quot; to begin.
              </div>
            ) : (
              <ResearchSwimlanes agents={agentsArray} />
            )}
          </div>
        </section>

        {/* Plan Preview Section */}
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Plan Preview
          </h2>
          <div className="bg-card border border-border rounded-lg">
            {isLoadingPlan ? (
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-8 bg-muted rounded w-1/4" />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="h-32 bg-muted rounded" />
                    <div className="h-32 bg-muted rounded" />
                    <div className="h-32 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ) : planData && planData.tasks.length > 0 ? (
              <PlanKanban tasks={planData.tasks} onTaskEdit={handleTaskEdit} />
            ) : planError ? (
              <div className="p-8 text-center text-red-600">{planError}</div>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No plan tasks available yet. Complete research to generate a plan.
              </div>
            )}
          </div>
        </section>

        <NewPlanModal
          projectId={projectId}
          open={showNewPlan}
          onOpenChange={setShowNewPlan}
          onCreated={loadPlan}
        />
      </div>
    </main>
  );
}
