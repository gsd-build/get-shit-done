'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play } from 'lucide-react';
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
import type { Coverage } from '@/components/features/verify/CoverageHeatmap';
import { fetchCoverage, submitApproval, submitRejection } from '@/lib/api';
import { resolveSocketBase } from '@/lib/endpoints';

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

  // Handle manual test update
  const handleManualTestUpdate = useCallback(
    (testId: string, passed: boolean | null, note?: string) => {
      updateManualTest(testId, passed === true, note);
    },
    [updateManualTest]
  );

  // Handle approval - per CONTEXT.md
  const handleApprove = useCallback(async () => {
    try {
      await submitApproval(projectId);
      // Show success and navigate back to project
      router.push(`/projects/${projectId}`);
    } catch (err) {
      console.error('Approval failed:', err);
    }
  }, [projectId, router]);

  // Handle rejection - per CONTEXT.md auto-route to gap planning
  const handleReject = useCallback(
    async (selectedGapIds: string[]) => {
      try {
        const { planUrl } = await submitRejection(projectId, selectedGapIds);
        // Redirect to plan phase with gaps
        router.push(planUrl);
      } catch (err) {
        console.error('Rejection failed:', err);
      }
    },
    [projectId, router]
  );

  // Check if verification is running
  const isRunning = status === 'running';

  return (
    <main className="min-h-screen bg-background pb-24">
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
            <h1 className="text-3xl font-bold text-foreground">Verification</h1>
            <p className="text-muted-foreground mt-1">
              Project: {projectId}
              {isConnected && (
                <span className="ml-2 text-green-500 text-sm">Connected</span>
              )}
            </p>
          </div>

          {/* Run Verification button */}
          {!isRunning && status !== 'complete' && (
            <button
              type="button"
              onClick={startVerification}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Verification
            </button>
          )}
        </div>

        {/* Verification Panel (Report Header + Requirement List) */}
        <section className="mb-8">
          <VerificationPanel />
        </section>

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
      <ApprovalBar gaps={gaps} onApprove={handleApprove} onReject={handleReject} />
    </main>
  );
}
