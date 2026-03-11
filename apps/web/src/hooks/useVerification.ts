'use client';

import { useEffect, useCallback } from 'react';
import type { TypedSocket } from '@gsd/events';
import {
  useVerificationStore,
  selectStatus,
  selectResults,
  selectGaps,
  selectManualTests,
  selectOverallPassed,
  selectSummary,
} from '@/stores/verificationStore';
import type { TestResult, Gap } from '@/types/verification';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

/**
 * Verification event payloads from Socket.IO server.
 */
interface TestStartEvent {
  testName: string;
  requirementId: string;
}

interface TestResultEvent extends TestResult {}

interface CompleteEvent {
  passed: boolean;
  summary: string;
  gaps: Gap[];
}

/**
 * React hook for verification process management.
 *
 * Subscribes to Socket.IO events for real-time test result streaming
 * and manages verification state through the verificationStore.
 *
 * @param socket - TypedSocket instance or null if not connected
 * @param phaseId - The phase ID to verify
 * @returns Object with verification state and startVerification function
 */
export function useVerification(socket: TypedSocket | null, phaseId: string) {
  const status = useVerificationStore(selectStatus);
  const results = useVerificationStore(selectResults);
  const gaps = useVerificationStore(selectGaps);
  const manualTests = useVerificationStore(selectManualTests);
  const overallPassed = useVerificationStore(selectOverallPassed);
  const summary = useVerificationStore(selectSummary);

  const setRunning = useVerificationStore((s) => s.setRunning);
  const setRunningTest = useVerificationStore((s) => s.setRunningTest);
  const addTestResult = useVerificationStore((s) => s.addTestResult);
  const setComplete = useVerificationStore((s) => s.setComplete);
  const setGaps = useVerificationStore((s) => s.setGaps);

  // Subscribe to verification events on mount
  useEffect(() => {
    if (!socket) return;

    // Subscribe to verification channel
    socket.emit('verification:subscribe' as never, phaseId as never);

    // Event handlers
    const handleTestStart = (data: TestStartEvent) => {
      setRunningTest(data.testName);
    };

    const handleTestResult = (data: TestResultEvent) => {
      addTestResult(data);
    };

    const handleComplete = (data: CompleteEvent) => {
      setComplete(data.passed, data.summary);
      setGaps(data.gaps);
    };

    // Register listeners
    socket.on('verification:test_start' as never, handleTestStart as never);
    socket.on('verification:test_result' as never, handleTestResult as never);
    socket.on('verification:complete' as never, handleComplete as never);

    // Cleanup on unmount
    return () => {
      socket.emit('verification:unsubscribe' as never, phaseId as never);
      socket.off('verification:test_start' as never, handleTestStart as never);
      socket.off('verification:test_result' as never, handleTestResult as never);
      socket.off('verification:complete' as never, handleComplete as never);
    };
  }, [
    socket,
    phaseId,
    setRunningTest,
    addTestResult,
    setComplete,
    setGaps,
  ]);

  /**
   * Start verification for the current phase.
   */
  const startVerification = useCallback(async () => {
    setRunning();

    try {
      await fetch(`${API_BASE}/api/phases/${phaseId}/verify`, {
        method: 'POST',
      });
    } catch (err) {
      // Error handling could be expanded here
      console.error('Failed to start verification:', err);
    }
  }, [phaseId, setRunning]);

  return {
    status,
    results,
    gaps,
    manualTests,
    overallPassed,
    summary,
    startVerification,
  };
}
