// Stub implementation - will be replaced in GREEN phase
import { create } from 'zustand';
import type {
  TestResult,
  Gap,
  ManualTest,
  VerificationStatus,
} from '@/types/verification';

interface VerificationStore {
  status: VerificationStatus;
  runningTest: string | null;
  results: TestResult[];
  gaps: Gap[];
  manualTests: ManualTest[];
  overallPassed: boolean | null;
  summary: string | null;
  setRunning: () => void;
  setRunningTest: (testName: string) => void;
  addTestResult: (result: TestResult) => void;
  setComplete: (passed: boolean, summary: string) => void;
  setGaps: (gaps: Gap[]) => void;
  setManualTests: (tests: ManualTest[]) => void;
  updateManualTest: (testId: string, passed: boolean, note?: string) => void;
  reset: () => void;
}

// Stub implementation that throws - will be properly implemented in GREEN phase
export const useVerificationStore = create<VerificationStore>(() => ({
  status: 'idle',
  runningTest: null,
  results: [],
  gaps: [],
  manualTests: [],
  overallPassed: null,
  summary: null,
  setRunning: () => {
    throw new Error('Not implemented');
  },
  setRunningTest: () => {
    throw new Error('Not implemented');
  },
  addTestResult: () => {
    throw new Error('Not implemented');
  },
  setComplete: () => {
    throw new Error('Not implemented');
  },
  setGaps: () => {
    throw new Error('Not implemented');
  },
  setManualTests: () => {
    throw new Error('Not implemented');
  },
  updateManualTest: () => {
    throw new Error('Not implemented');
  },
  reset: () => {
    throw new Error('Not implemented');
  },
}));
