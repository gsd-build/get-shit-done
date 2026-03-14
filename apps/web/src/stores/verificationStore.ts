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
  hasStaleResults: boolean;

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
  hasStaleResults: false,
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
    set((state) => ({
      status: 'running',
      runningTest: null,
      hasStaleResults: state.results.length > 0,
    })),

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
      hasStaleResults: false,
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

// Basic selectors for optimized re-renders
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
export const selectHasStaleResults = (state: VerificationStore) => state.hasStaleResults;

// Derived selectors for computed values
/**
 * Count of test results that passed.
 */
export const selectPassedCount = (state: VerificationStore) =>
  state.results.filter((r) => r.passed).length;

/**
 * Count of test results that failed.
 */
export const selectFailedCount = (state: VerificationStore) =>
  state.results.filter((r) => !r.passed).length;

/**
 * Filter gaps to only blocking severity.
 */
export const selectBlockingGaps = (state: VerificationStore) =>
  state.gaps.filter((g) => g.severity === 'blocking');

/**
 * Returns true if any blocking gaps exist.
 */
export const selectHasBlockingGaps = (state: VerificationStore) =>
  state.gaps.some((g) => g.severity === 'blocking');

/**
 * Returns true if all manual tests have been completed (passed !== null).
 */
export const selectManualTestsComplete = (state: VerificationStore) =>
  state.manualTests.length > 0 &&
  state.manualTests.every((t) => t.passed !== null);

/**
 * Returns true if all automated tests passed AND all manual tests passed.
 */
export const selectAllRequirementsPassed = (state: VerificationStore) => {
  // All automated tests must pass
  const allAutomatedPassed =
    state.results.length > 0 && state.results.every((r) => r.passed);

  // All manual tests must pass (if any exist)
  const allManualPassed =
    state.manualTests.length === 0 ||
    state.manualTests.every((t) => t.passed === true);

  return allAutomatedPassed && allManualPassed;
};
