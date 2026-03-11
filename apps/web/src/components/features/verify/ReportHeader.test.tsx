import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportHeader } from './ReportHeader';
import type { VerificationStatus } from '@/types/verification';

describe('ReportHeader', () => {
  const defaultProps = {
    status: 'complete' as VerificationStatus,
    overallPassed: true,
    passedCount: 5,
    failedCount: 0,
  };

  it('renders "Verification Passed" when overallPassed=true', () => {
    render(<ReportHeader {...defaultProps} />);
    expect(screen.getByText('Verification Passed')).toBeInTheDocument();
  });

  it('renders "Verification Failed" when overallPassed=false', () => {
    render(
      <ReportHeader
        {...defaultProps}
        overallPassed={false}
        passedCount={3}
        failedCount={2}
      />
    );
    expect(screen.getByText('Verification Failed')).toBeInTheDocument();
  });

  it('renders "Verification Running" when status="running"', () => {
    render(
      <ReportHeader
        status="running"
        overallPassed={null}
        passedCount={2}
        failedCount={0}
        runningTest="Auth Login Test"
      />
    );
    expect(screen.getByText('Verification Running...')).toBeInTheDocument();
  });

  it('shows passed count (green) and failed count (red)', () => {
    render(
      <ReportHeader
        {...defaultProps}
        overallPassed={false}
        passedCount={8}
        failedCount={3}
      />
    );
    const passedElement = screen.getByText(/8 passed/i);
    const failedElement = screen.getByText(/3 failed/i);
    expect(passedElement).toBeInTheDocument();
    expect(failedElement).toBeInTheDocument();
    // Check for green/red color classes
    expect(passedElement.className).toMatch(/green|success/i);
    expect(failedElement.className).toMatch(/red|error/i);
  });

  it('shows progress indicator when status="running"', () => {
    render(
      <ReportHeader
        status="running"
        overallPassed={null}
        passedCount={1}
        failedCount={0}
      />
    );
    // Loader2 spinner should be present with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows current running test name when status="running"', () => {
    render(
      <ReportHeader
        status="running"
        overallPassed={null}
        passedCount={1}
        failedCount={0}
        runningTest="User Registration Test"
      />
    );
    expect(screen.getByText(/User Registration Test/)).toBeInTheDocument();
  });

  it('renders summary text when provided', () => {
    render(
      <ReportHeader
        {...defaultProps}
        summary="All 5 requirements verified successfully"
      />
    );
    expect(
      screen.getByText('All 5 requirements verified successfully')
    ).toBeInTheDocument();
  });

  it('shows CheckCircle icon when passed', () => {
    render(<ReportHeader {...defaultProps} />);
    // CheckCircle icon should have the appropriate class
    const icon = document.querySelector('[data-testid="check-circle"]');
    expect(icon).toBeTruthy();
  });

  it('shows XCircle icon when failed', () => {
    render(
      <ReportHeader {...defaultProps} overallPassed={false} failedCount={1} />
    );
    const icon = document.querySelector('[data-testid="x-circle"]');
    expect(icon).toBeTruthy();
  });
});
