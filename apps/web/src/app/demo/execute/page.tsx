'use client';

import { useEffect, useMemo } from 'react';
import { ExecutionPanel } from '@/components/features/execute';
import { useExecutionStore, selectPlans } from '@/stores/executionStore';
import type { Wave } from '@/components/features/execute/WaveColumn';

/**
 * Build waves from the execution store plans.
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

// Demo page to visualize execute phase UI components
export default function ExecuteDemoPage() {
  const plans = useExecutionStore(selectPlans);
  // Get stable action references from the store
  const startExecution = useExecutionStore((state) => state.startExecution);
  const appendLog = useExecutionStore((state) => state.appendLog);
  const startTool = useExecutionStore((state) => state.startTool);
  const endTool = useExecutionStore((state) => state.endTool);
  const setTddPhase = useExecutionStore((state) => state.setTddPhase);
  const addCommit = useExecutionStore((state) => state.addCommit);
  const reset = useExecutionStore((state) => state.reset);

  // Build waves from plans
  const waves = useMemo(() => buildWavesFromPlans(plans), [plans]);

  // Populate demo data on mount
  useEffect(() => {
    // Start a demo execution
    startExecution('demo-agent-1', 'plan-01', 'Task 1: Setup infrastructure');

    // Add some log content
    const logTimer = setTimeout(() => {
      appendLog('plan-01', '$ pnpm install\n');
      appendLog('plan-01', 'Packages: +342\n');
      appendLog('plan-01', '++++++++++++++++++++++++++++++++\n');
      appendLog('plan-01', 'Done in 4.2s\n\n');
      appendLog('plan-01', '$ pnpm test\n');
      appendLog('plan-01', 'Running 42 tests...\n');
    }, 500);

    // Add a tool call
    const tool1StartTimer = setTimeout(() => {
      startTool('plan-01', {
        agentId: 'demo-agent-1',
        toolId: 'tool-1',
        toolName: 'Read',
        input: { file_path: 'src/components/Button.tsx' },
        sequence: 1,
      });
    }, 1000);

    const tool1EndTimer = setTimeout(() => {
      endTool('plan-01', {
        agentId: 'demo-agent-1',
        toolId: 'tool-1',
        success: true,
        output: `export function Button({ children }: { children: React.ReactNode }) {
  return <button className="btn">{children}</button>;
}`,
        duration: 45,
        sequence: 1,
      });
    }, 1500);

    // Add another tool call (Write)
    const tool2StartTimer = setTimeout(() => {
      startTool('plan-01', {
        agentId: 'demo-agent-1',
        toolId: 'tool-2',
        toolName: 'Write',
        input: { file_path: 'src/components/Card.tsx' },
        sequence: 2,
      });
    }, 2000);

    const tool2EndTimer = setTimeout(() => {
      endTool('plan-01', {
        agentId: 'demo-agent-1',
        toolId: 'tool-2',
        success: true,
        output: `export function Card({ title, children }: CardProps) {
  return (
    <div className="card">
      <h2>{title}</h2>
      {children}
    </div>
  );
}`,
        duration: 120,
        sequence: 2,
      });
    }, 2500);

    // Set TDD phase
    const tddTimer = setTimeout(() => {
      setTddPhase('green');
    }, 1000);

    // Add a commit
    const commitTimer = setTimeout(() => {
      addCommit({
        sha: 'a1b2c3d',
        message: 'feat(17-08): implement TddIndicator component',
        timestamp: new Date().toISOString(),
      });
    }, 3000);

    // Cleanup on unmount
    return () => {
      clearTimeout(logTimer);
      clearTimeout(tool1StartTimer);
      clearTimeout(tool1EndTimer);
      clearTimeout(tool2StartTimer);
      clearTimeout(tool2EndTimer);
      clearTimeout(tddTimer);
      clearTimeout(commitTimer);
      reset();
    };
  }, [startExecution, appendLog, startTool, endTool, setTddPhase, addCommit, reset]);

  return (
    <div className="h-screen bg-background">
      <ExecutionPanel waves={waves} projectPath="/demo" />
    </div>
  );
}
