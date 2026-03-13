'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { useResearchStream } from '@/hooks/useResearchStream';
import { usePlanStore, selectAgents, selectPlan } from '@/stores/planStore';
import { ResearchSwimlanes, PlanKanban } from '@/components/features/plan';
import { fetchPlan, updatePlanTask, startResearch } from '@/lib/api';
import { resolveSocketBase } from '@/lib/endpoints';
import type { ResearchAgent, Plan, PlanTask } from '@/types/plan';

const SOCKET_URL = resolveSocketBase();

/**
 * Plan Phase Page - Research swimlanes and Kanban preview.
 *
 * Shows research agent progress via streaming and plan tasks in Kanban view.
 * Allows inline editing of task titles/descriptions.
 */
export default function PlanPhasePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;

  // Socket.IO connection for real-time updates
  const { socket, isConnected } = useSocket(SOCKET_URL);

  // Research agent streaming via useResearchStream hook
  const { agents, isLoading: isResearchLoading } = useResearchStream(
    socket,
    projectId
  );

  // Plan state from Zustand store
  const plan = usePlanStore(selectPlan);
  const storeAgents = usePlanStore(selectAgents);

  // Local state for plan data (fetched from API)
  const [planData, setPlanData] = useState<Plan | null>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const [isStartingResearch, setIsStartingResearch] = useState(false);

  // Fetch plan data on mount
  useEffect(() => {
    async function loadPlan() {
      setIsLoadingPlan(true);
      const response = await fetchPlan(projectId);
      if (response.success && response.data) {
        setPlanData(response.data);
      }
      setIsLoadingPlan(false);
    }
    loadPlan();
  }, [projectId]);

  // Convert agents Map to array for component
  const agentsArray: ResearchAgent[] = Array.from(storeAgents.values());

  // Check if any agents are running
  const hasRunningAgents = agentsArray.some((a) => a.status === 'running');

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
    const response = await updatePlanTask(projectId, taskId, {
      name: updates.title,
      description: updates.description,
    });

    // Update local state if successful
    if (response.success && response.data && planData) {
      setPlanData({
        ...planData,
        tasks: planData.tasks.map((task) =>
          task.id === taskId
            ? { ...task, name: updates.title, description: updates.description }
            : task
        ),
      });
    }
  };

  return (
    <main className="min-h-screen bg-background pb-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back navigation */}
        <Link
          href={`/projects/${projectId}`}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planning Phase</h1>
            <p className="text-muted-foreground mt-1">
              Project: {projectId}
              {isConnected && (
                <span className="ml-2 text-green-500 text-sm">Connected</span>
              )}
            </p>
          </div>

          {/* Start Research button */}
          {!hasRunningAgents && (
            <button
              type="button"
              onClick={handleStartResearch}
              disabled={isStartingResearch}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              {isStartingResearch ? 'Starting...' : 'Start Research'}
            </button>
          )}
        </div>

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
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                No plan tasks available yet. Complete research to generate a plan.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
