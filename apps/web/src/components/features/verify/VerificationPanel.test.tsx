import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationPanel } from './VerificationPanel';
import { useVerificationStore } from '@/stores/verificationStore';
import type { TestResult } from '@/types/verification';

describe('VerificationPanel', () => {
  beforeEach(() => {
    // Reset store before each test
    useVerificationStore.getState().reset();
  });

  it('renders loading state when idle with no results', () => {
    render(<VerificationPanel />);
    expect(screen.getByTestId('verification-loading')).toBeInTheDocument();
  });

  it('renders ReportHeader when results exist', () => {
    const store = useVerificationStore.getState();

    // Set up store with some results
    store.setRunning();
    const testResult: TestResult = {
      requirementId: 'AUTH-01',
      testName: 'Login test',
      passed: true,
      duration: 100,
    };
    store.addTestResult(testResult);
    store.setComplete(true, 'All tests passed');

    render(<VerificationPanel />);
    expect(screen.getByText('Verification Passed')).toBeInTheDocument();
  });

  it('renders RequirementList when results exist', () => {
    const store = useVerificationStore.getState();

    store.setRunning();
    store.addTestResult({
      requirementId: 'AUTH-01',
      testName: 'Login test',
      passed: true,
      duration: 100,
    });
    store.addTestResult({
      requirementId: 'AUTH-02',
      testName: 'Session test',
      passed: false,
      message: 'Session expired too early',
      duration: 200,
    });
    store.setComplete(false, 'Some tests failed');

    render(<VerificationPanel />);

    // Should show requirement IDs
    expect(screen.getByText('AUTH-01')).toBeInTheDocument();
    expect(screen.getByText('AUTH-02')).toBeInTheDocument();
  });

  it('shows running state with running test name', () => {
    const store = useVerificationStore.getState();

    store.setRunning();
    store.setRunningTest('User Registration Test');
    store.addTestResult({
      requirementId: 'AUTH-01',
      testName: 'Setup test',
      passed: true,
      duration: 50,
    });

    render(<VerificationPanel />);

    expect(screen.getByText('Verification Running...')).toBeInTheDocument();
    expect(screen.getByText(/User Registration Test/)).toBeInTheDocument();
  });

  it('displays correct passed and failed counts', () => {
    const store = useVerificationStore.getState();

    store.setRunning();
    store.addTestResult({
      requirementId: 'AUTH-01',
      testName: 'Test 1',
      passed: true,
      duration: 100,
    });
    store.addTestResult({
      requirementId: 'AUTH-01',
      testName: 'Test 2',
      passed: true,
      duration: 100,
    });
    store.addTestResult({
      requirementId: 'AUTH-02',
      testName: 'Test 3',
      passed: false,
      duration: 100,
    });
    store.setComplete(false, 'Verification complete');

    render(<VerificationPanel />);

    // Use getAllByText since both header and summary may contain the counts
    const passedElements = screen.getAllByText(/2 passed/);
    const failedElements = screen.getAllByText(/1 failed/);
    expect(passedElements.length).toBeGreaterThan(0);
    expect(failedElements.length).toBeGreaterThan(0);
  });
});
