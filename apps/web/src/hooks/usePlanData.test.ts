import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePlanData } from './usePlanData';
import type { Plan } from '@/types/plan';

vi.mock('@/lib/api', () => ({
  fetchPlan: vi.fn(),
}));

import { fetchPlan } from '@/lib/api';

const mockFetchPlan = vi.mocked(fetchPlan);

const populatedPlan: Plan = {
  id: 'plan-1',
  phaseId: 'todo-app',
  createdAt: new Date().toISOString(),
  tasks: [
    {
      id: 'task-1',
      name: 'Implement dashboard',
      description: 'Render plan tasks from server',
      wave: 1,
      dependsOn: [],
      files: [],
      type: 'auto',
    },
  ],
};

describe('usePlanData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates from authoritative server payload when tasks are present', async () => {
    mockFetchPlan.mockResolvedValueOnce({
      success: true,
      data: populatedPlan,
      meta: { timestamp: new Date().toISOString(), requestId: 'req-1' },
    });

    const { result } = renderHook(() => usePlanData('todo-app'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.planError).toBeNull();
    expect(result.current.planData?.tasks).toHaveLength(1);
    expect(result.current.planData?.tasks[0]?.name).toBe('Implement dashboard');
  });

  it('classifies 404 responses as phase unavailable', async () => {
    mockFetchPlan.mockResolvedValueOnce({
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: 'req-2' },
      error: { code: 'FETCH_ERROR', message: 'HTTP 404' },
    });

    const { result } = renderHook(() => usePlanData('todo'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.planData).toBeNull();
    expect(result.current.planError).toBe('Plan phase is unavailable for this project.');
  });

  it('applies local task patches without discarding loaded server data', async () => {
    mockFetchPlan.mockResolvedValueOnce({
      success: true,
      data: populatedPlan,
      meta: { timestamp: new Date().toISOString(), requestId: 'req-3' },
    });

    const { result } = renderHook(() => usePlanData('todo-app'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      result.current.patchTask('task-1', (task) => ({
        ...task,
        name: 'Updated dashboard task',
      }));
    });

    await waitFor(() => {
      expect(result.current.planData?.tasks[0]?.name).toBe('Updated dashboard task');
    });
    expect(result.current.planData?.tasks).toHaveLength(1);
  });
});
