import { describe, it, expect, beforeEach } from 'vitest';
import { useVerificationStore } from './verificationStore';

describe('verificationStore', () => {
  beforeEach(() => {
    useVerificationStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with status idle', () => {
      const { status } = useVerificationStore.getState();
      expect(status).toBe('idle');
    });

    it('starts with empty results array', () => {
      const { results } = useVerificationStore.getState();
      expect(results).toEqual([]);
    });

    it('starts with empty gaps array', () => {
      const { gaps } = useVerificationStore.getState();
      expect(gaps).toEqual([]);
    });

    it('starts with empty manualTests array', () => {
      const { manualTests } = useVerificationStore.getState();
      expect(manualTests).toEqual([]);
    });
  });

  describe('setRunning', () => {
    it('changes status to running', () => {
      useVerificationStore.getState().setRunning();
      expect(useVerificationStore.getState().status).toBe('running');
    });

    it('clears results when called', () => {
      // Add some results first
      useVerificationStore.getState().addTestResult({
        requirementId: 'REQ-1',
        testName: 'test1',
        passed: true,
        duration: 100,
      });
      expect(useVerificationStore.getState().results.length).toBe(1);

      // Now setRunning should clear
      useVerificationStore.getState().setRunning();
      expect(useVerificationStore.getState().results).toEqual([]);
    });

    it('sets runningTest to null', () => {
      useVerificationStore.getState().setRunningTest('some-test');
      useVerificationStore.getState().setRunning();
      expect(useVerificationStore.getState().runningTest).toBeNull();
    });
  });

  describe('setRunningTest', () => {
    it('updates current test name', () => {
      useVerificationStore.getState().setRunningTest('Test Authentication');
      expect(useVerificationStore.getState().runningTest).toBe(
        'Test Authentication'
      );
    });
  });

  describe('addTestResult', () => {
    it('appends result to results array', () => {
      useVerificationStore.getState().addTestResult({
        requirementId: 'REQ-1',
        testName: 'test1',
        passed: true,
        duration: 100,
      });
      useVerificationStore.getState().addTestResult({
        requirementId: 'REQ-2',
        testName: 'test2',
        passed: false,
        message: 'Failed assertion',
        duration: 200,
      });

      const { results } = useVerificationStore.getState();
      expect(results).toHaveLength(2);
      expect(results[0]?.testName).toBe('test1');
      expect(results[1]?.testName).toBe('test2');
      expect(results[1]?.passed).toBe(false);
    });
  });

  describe('setComplete', () => {
    it('sets status to complete', () => {
      useVerificationStore.getState().setComplete(true, 'All tests passed');
      expect(useVerificationStore.getState().status).toBe('complete');
    });

    it('sets overallPassed value', () => {
      useVerificationStore.getState().setComplete(false, 'Some tests failed');
      expect(useVerificationStore.getState().overallPassed).toBe(false);
    });

    it('sets summary value', () => {
      useVerificationStore.getState().setComplete(true, 'All 5 tests passed');
      expect(useVerificationStore.getState().summary).toBe('All 5 tests passed');
    });

    it('sets runningTest to null', () => {
      useVerificationStore.getState().setRunningTest('current-test');
      useVerificationStore.getState().setComplete(true, 'Done');
      expect(useVerificationStore.getState().runningTest).toBeNull();
    });
  });

  describe('setGaps', () => {
    it('replaces gaps array', () => {
      const gaps = [
        {
          id: 'gap-1',
          requirementId: 'REQ-1',
          description: 'Missing validation',
          severity: 'blocking' as const,
        },
        {
          id: 'gap-2',
          requirementId: 'REQ-2',
          description: 'No error handling',
          severity: 'major' as const,
        },
      ];
      useVerificationStore.getState().setGaps(gaps);
      expect(useVerificationStore.getState().gaps).toEqual(gaps);
    });
  });

  describe('setManualTests', () => {
    it('sets manual test items', () => {
      const manualTests = [
        { id: 'mt-1', description: 'Check UI renders', passed: null },
        { id: 'mt-2', description: 'Verify colors', passed: null },
      ];
      useVerificationStore.getState().setManualTests(manualTests);
      expect(useVerificationStore.getState().manualTests).toEqual(manualTests);
    });
  });

  describe('updateManualTest', () => {
    it('updates a specific test passed status', () => {
      const manualTests = [
        { id: 'mt-1', description: 'Check UI renders', passed: null },
        { id: 'mt-2', description: 'Verify colors', passed: null },
      ];
      useVerificationStore.getState().setManualTests(manualTests);
      useVerificationStore.getState().updateManualTest('mt-1', true);

      const updated = useVerificationStore.getState().manualTests;
      expect(updated[0]?.passed).toBe(true);
      expect(updated[1]?.passed).toBeNull();
    });

    it('updates a specific test note', () => {
      const manualTests = [
        { id: 'mt-1', description: 'Check UI renders', passed: null },
      ];
      useVerificationStore.getState().setManualTests(manualTests);
      useVerificationStore
        .getState()
        .updateManualTest('mt-1', true, 'Looks good');

      const updated = useVerificationStore.getState().manualTests;
      expect(updated[0]?.note).toBe('Looks good');
    });
  });

  describe('reset', () => {
    it('returns to initial state', () => {
      // Modify all state
      useVerificationStore.getState().setRunning();
      useVerificationStore.getState().setRunningTest('test');
      useVerificationStore.getState().addTestResult({
        requirementId: 'REQ-1',
        testName: 'test1',
        passed: true,
        duration: 100,
      });
      useVerificationStore.getState().setGaps([
        {
          id: 'gap-1',
          requirementId: 'REQ-1',
          description: 'Gap',
          severity: 'minor',
        },
      ]);
      useVerificationStore.getState().setManualTests([
        { id: 'mt-1', description: 'Test', passed: true },
      ]);

      // Reset
      useVerificationStore.getState().reset();

      const state = useVerificationStore.getState();
      expect(state.status).toBe('idle');
      expect(state.runningTest).toBeNull();
      expect(state.results).toEqual([]);
      expect(state.gaps).toEqual([]);
      expect(state.manualTests).toEqual([]);
      expect(state.overallPassed).toBeNull();
      expect(state.summary).toBeNull();
    });
  });
});
