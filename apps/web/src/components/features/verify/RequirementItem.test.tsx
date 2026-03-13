import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequirementItem } from './RequirementItem';
import type { TestResult } from '@/types/verification';

describe('RequirementItem', () => {
  const passingTests: TestResult[] = [
    {
      requirementId: 'AUTH-01',
      testName: 'User can login with valid credentials',
      passed: true,
      duration: 150,
    },
    {
      requirementId: 'AUTH-01',
      testName: 'User sees error with invalid credentials',
      passed: true,
      duration: 120,
    },
  ];

  const mixedTests: TestResult[] = [
    {
      requirementId: 'AUTH-02',
      testName: 'Session persists across refresh',
      passed: true,
      duration: 200,
    },
    {
      requirementId: 'AUTH-02',
      testName: 'Session expires after timeout',
      passed: false,
      message: 'Expected session to expire after 15m, but was still active',
      duration: 350,
    },
  ];

  it('renders requirement ID and name', () => {
    render(
      <RequirementItem
        requirementId="AUTH-01"
        requirementName="User Authentication"
        tests={passingTests}
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    expect(screen.getByText('AUTH-01')).toBeInTheDocument();
    expect(screen.getByText('User Authentication')).toBeInTheDocument();
  });

  it('renders pass badge (green CheckCircle) when all tests passed', () => {
    render(
      <RequirementItem
        requirementId="AUTH-01"
        requirementName="User Authentication"
        tests={passingTests}
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    // Should have pass indicator
    const passIcon = document.querySelector('[data-testid="check-circle"]');
    expect(passIcon).toBeTruthy();
  });

  it('renders fail badge (red XCircle) when any test failed', () => {
    render(
      <RequirementItem
        requirementId="AUTH-02"
        requirementName="Session Management"
        tests={mixedTests}
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    const failIcon = document.querySelector('[data-testid="x-circle"]');
    expect(failIcon).toBeTruthy();
  });

  it('click expands to show test details', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <RequirementItem
        requirementId="AUTH-01"
        requirementName="User Authentication"
        tests={passingTests}
        isExpanded={false}
        onToggle={onToggle}
      />
    );

    const trigger = screen.getByRole('button', { name: /AUTH-01/i });
    await user.click(trigger);
    expect(onToggle).toHaveBeenCalled();
  });

  it('shows EvidenceTrail for failed tests when expanded', () => {
    render(
      <RequirementItem
        requirementId="AUTH-02"
        requirementName="Session Management"
        tests={mixedTests}
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    // Failed test message should be visible
    expect(
      screen.getByText(/Expected session to expire after 15m/)
    ).toBeInTheDocument();
  });

  it('shows test duration for each test', () => {
    render(
      <RequirementItem
        requirementId="AUTH-01"
        requirementName="User Authentication"
        tests={passingTests}
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    // Duration should be visible (150ms, 120ms)
    expect(screen.getByText(/150ms/)).toBeInTheDocument();
    expect(screen.getByText(/120ms/)).toBeInTheDocument();
  });

  it('shows test message/error when provided', () => {
    render(
      <RequirementItem
        requirementId="AUTH-02"
        requirementName="Session Management"
        tests={mixedTests}
        isExpanded={true}
        onToggle={() => {}}
      />
    );
    expect(
      screen.getByText(/Expected session to expire after 15m, but was still active/)
    ).toBeInTheDocument();
  });

  it('shows test count in header', () => {
    render(
      <RequirementItem
        requirementId="AUTH-01"
        requirementName="User Authentication"
        tests={passingTests}
        isExpanded={false}
        onToggle={() => {}}
      />
    );
    // Should show something like "2 tests" or "2/2 passed"
    expect(screen.getByText(/2/)).toBeInTheDocument();
  });
});
