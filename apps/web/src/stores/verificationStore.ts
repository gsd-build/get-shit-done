import { create } from 'zustand';
import type {
  TestResult,
  Gap,
  ManualTest,
  VerificationStatus,
} from '@/types/verification';

/**
 * Verification store state shape.
 *
 * Manages test results streaming, gaps, and manual test tracking
 * for the verification report UI.
 */
interface VerificationStore {
  // State
  status: VerificationStatus;
  runningTest: string | null;
  results: TestResult[];
  gaps: Gap[];
  manualTests: ManualTest[];
  overallPassed: boolean | null;
  summary: string | null;

  // Actions
  setRunning: () => void;
  setRunningTest: (testName: string) => void;
  addTestResult: (result: TestResult) => void;
  setComplete: (passed: boolean, summary: string) => void;
  setGaps: (gaps: Gap[]) => void;
  setManualTests: (tests: ManualTest[]) => void;
  updateManualTest: (testId: string, passed: boolean, note?: string) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as VerificationStatus,
  runningTest: null as string | null,
  results: [] as TestResult[],
  gaps: [] as Gap[],
  manualTests: [] as ManualTest[],
  overallPassed: null as boolean | null,
  summary: null as string | null,
};

/**
 * Zustand store for verification state management.
 *
 * Used by useVerification hook to manage test results streaming,
 * gap reporting, and manual test tracking.
 */
export const useVerificationStore = create<VerificationStore>((set) => ({
  ...initialState,

  /**
   * Start verification - sets status to running and clears previous results.
   */
  setRunning: () =>
    set({
      status: 'running',
      results: [],
      runningTest: null,
    }),

  /**
   * Update the currently running test name.
   */
  setRunningTest: (testName) => set({ runningTest: testName }),

  /**
   * Add a test result to the results array.
   */
  addTestResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
    })),

  /**
   * Mark verification as complete with overall status and summary.
   */
  setComplete: (passed, summary) =>
    set({
      status: 'complete',
      overallPassed: passed,
      summary,
      runningTest: null,
    }),

  /**
   * Replace the gaps array.
   */
  setGaps: (gaps) => set({ gaps }),

  /**
   * Set manual test items.
   */
  setManualTests: (tests) => set({ manualTests: tests }),

  /**
   * Update a specific manual test by ID.
   */
  updateManualTest: (testId, passed, note) =>
    set((state) => ({
      manualTests: state.manualTests.map((test) =>
        test.id === testId
          ? { ...test, passed, ...(note !== undefined && { note }) }
          : test
      ),
    })),

  /**
   * Reset to initial state.
   */
  reset: () => set(initialState),
}));

// Selectors for optimized re-renders
export const selectStatus = (state: VerificationStore) => state.status;
export const selectResults = (state: VerificationStore) => state.results;
export const selectGaps = (state: VerificationStore) => state.gaps;
export const selectManualTests = (state: VerificationStore) =>
  state.manualTests;
export const selectOverallPassed = (state: VerificationStore) =>
  state.overallPassed;
export const selectRunningTest = (state: VerificationStore) =>
  state.runningTest;
export const selectSummary = (state: VerificationStore) => state.summary;
