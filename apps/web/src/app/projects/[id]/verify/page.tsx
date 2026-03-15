'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import { useSocket } from '@/hooks/useSocket';
import { useVerification } from '@/hooks/useVerification';
import {
  useVerificationStore,
  selectManualTests,
} from '@/stores/verificationStore';
import {
  VerificationPanel,
  GapList,
  CoverageHeatmap,
  ManualChecklist,
  ApprovalBar,
} from '@/components/features/verify';
import {
  OrchestrationControlBar,
  RunStatusStrip,
} from '@/components/features/orchestration';
import type { Coverage } from '@/components/features/verify/CoverageHeatmap';
import { fetchCoverage, submitApproval, submitRejection } from '@/lib/api';
import { resolveSocketBase } from '@/lib/endpoints';
import {
  useOrchestrationStore,
  selectSelectedOrchestrationRun,
} from '@/stores/orchestrationStore';
import { WorkflowHeader } from '@/components/features/projects/WorkflowHeader';
import { NewPlanModal } from '@/components/features/projects/NewPlanModal';

const SOCKET_URL = resolveSocketBase();

/**
 * Verify Phase Page - Report display, gaps, coverage, manual tests, and approval.
 *
 * Integrates all verification components:
 * - VerificationPanel for report header and requirement list
 * - GapList for identified gaps
 * - CoverageHeatmap for requirement coverage matrix
 * - ManualChecklist for human verification items
 * - ApprovalBar for approve/reject actions
 */
export default function VerifyPhasePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params['id'] as string;

  // Socket.IO connection for real-time updates
  const { socket, isConnected } = useSocket(SOCKET_URL);

  // Verification streaming via useVerification hook
  const {
    status,
    results,
    gaps,
    overallPassed,
    summary,
    startVerification,
  } = useVerification(socket, projectId);

  // Manual tests from store
  const manualTests = useVerificationStore(selectManualTests);
  const updateManualTest = useVerificationStore((s) => s.updateManualTest);

  // Coverage data state
  const [coverageData, setCoverageData] = useState<Coverage[]>([]);
  const [requirements, setRequirements] = useState<string[]>([]);
  const [phases, setPhases] = useState<string[]>([]);
  const [isLoadingCoverage, setIsLoadingCoverage] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const setRuns = useOrchestrationStore((state) => state.setRuns);
  const setSelectedRun = useOrchestrationStore((state) => state.setSelectedRun);
  const selectedRun = useOrchestrationStore(selectSelectedOrchestrationRun);
  const isRunning = status === 'running';
  const canRunVerification = !isRunning;
  const canApprove = !isRunning && status === 'complete' && results.length > 0;

  // Fetch coverage data on mount
  useEffect(() => {
    async function loadCoverage() {
      setIsLoadingCoverage(true);
      const response = await fetchCoverage(projectId);
      if (response.success && response.data) {
        setCoverageData(response.data);

        // Extract unique requirements and phases from coverage data
        const reqs = [...new Set(response.data.map((c) => c.requirementId))];
        const phs = [...new Set(response.data.map((c) => c.phaseId))];
        setRequirements(reqs);
        setPhases(phs);
      }
      setIsLoadingCoverage(false);
    }
    loadCoverage();
  }, [projectId]);

  useEffect(() => {
    const runId = `${projectId}:verify`;
    setRuns([
      {
        id: runId,
        phaseId: 'verify',
        name: 'Verify Orchestration',
        status: isRunning ? 'active' : overallPassed ? 'complete' : 'paused',
        updatedAt: new Date().toISOString(),
        isEditingLocked: isRunning,
      },
    ]);
    setSelectedRun(runId);
  }, [projectId, isRunning, overallPassed, setRuns, setSelectedRun]);

  // Handle manual test update
  const handleManualTestUpdate = useCallback(
    (testId: string, passed: boolean | null, note?: string) => {
      updateManualTest(testId, passed === true, note);
    },
    [updateManualTest]
  );

  // Handle approval - per CONTEXT.md
  const handleApprove = useCallback(async () => {
    setActionError(null);
    try {
      await submitApproval(projectId);
      // Show success and navigate back to project
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Approval failed. Please try again.'
      );
    }
  }, [projectId, router]);

  // Handle rejection - per CONTEXT.md auto-route to gap planning
  const handleReject = useCallback(
    async (selectedGapIds: string[]) => {
      setActionError(null);
      try {
        const { planUrl } = await submitRejection(projectId, selectedGapIds);
        // Redirect to plan phase with gaps
        router.push(planUrl);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Rejection failed. Please try again.'
        );
      }
    },
    [projectId, router]
  );

  return (
    <main className="min-h-screen bg-background pb-24">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <WorkflowHeader
          projectId={projectId}
          title="Verification"
          subtitle={`Project: ${projectId}${isConnected ? ' · Connected' : ''}`}
          onNewPlan={() => setShowNewPlan(true)}
        />

        {canRunVerification && (
          <div className="mb-8">
            <button
              type="button"
              onClick={startVerification}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <Play className="w-4 h-4" />
              {status === 'complete' ? 'Run Verification Again' : 'Run Verification'}
            </button>
          </div>
        )}

        <div className="mb-6 space-y-3">
          <OrchestrationControlBar projectId={projectId} phaseId="verify" />
          <RunStatusStrip run={selectedRun} />
        </div>

        {/* Verification Panel (Report Header + Requirement List) */}
        <section className="mb-8">
          <VerificationPanel />
        </section>

        {actionError && (
          <div className="mb-6 rounded-md border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {actionError}
          </div>
        )}

        {/* Tabbed sections for Gaps, Coverage, Manual Tests */}
        <Tabs.Root defaultValue="gaps" className="bg-card border border-border rounded-lg">
          <Tabs.List className="flex border-b border-border">
            <Tabs.Trigger
              value="gaps"
              className="px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              Gaps ({gaps.length})
            </Tabs.Trigger>
            <Tabs.Trigger
              value="coverage"
              className="px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              Coverage
            </Tabs.Trigger>
            <Tabs.Trigger
              value="manual"
              className="px-4 py-3 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-b-2 data-[state=active]:border-blue-600"
            >
              Manual Tests ({manualTests.length})
            </Tabs.Trigger>
          </Tabs.List>

          {/* Gaps Tab */}
          <Tabs.Content value="gaps" className="p-4">
            <GapList gaps={gaps} />
          </Tabs.Content>

          {/* Coverage Tab */}
          <Tabs.Content value="coverage" className="p-4">
            {isLoadingCoverage ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-muted rounded w-1/4" />
                <div className="h-64 bg-muted rounded" />
              </div>
            ) : (
              <CoverageHeatmap
                requirements={requirements}
                phases={phases}
                coverageData={coverageData}
              />
            )}
          </Tabs.Content>

          {/* Manual Tests Tab */}
          <Tabs.Content value="manual" className="p-4">
            <ManualChecklist
              tests={manualTests}
              onTestUpdate={handleManualTestUpdate}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* Approval Bar - fixed at bottom */}
      <ApprovalBar
        gaps={gaps}
        onApprove={handleApprove}
        onReject={handleReject}
        disabled={!canApprove}
      />
      <NewPlanModal
        projectId={projectId}
        open={showNewPlan}
        onOpenChange={setShowNewPlan}
      />
    </main>
  );
}
