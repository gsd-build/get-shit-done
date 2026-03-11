import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from './useProjects';
import { useProjectStore } from '@/stores/projectStore';
import { useFilterStore } from '@/stores/filterStore';

// MSW handles the mock API calls via tests/setup.ts

describe('useProjects', () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
    useFilterStore.getState().reset();
  });

  it('fetches projects on mount', async () => {
    const { result } = renderHook(() => useProjects());

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.projects.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('exposes refetch function', async () => {
    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe('function');
  });

  it('returns filtered projects by search text', async () => {
    const { result, rerender } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const allCount = result.current.projects.length;
    expect(allCount).toBeGreaterThan(0);

    // Set filter to match only one project
    useFilterStore.getState().setSearchText('Dashboard');
    rerender();

    // Filtered results should be different from all
    expect(result.current.projects.length).toBeLessThanOrEqual(allCount);
    // At least one should match "Dashboard"
    expect(
      result.current.projects.some((p) =>
        p.name.toLowerCase().includes('dashboard')
      )
    ).toBe(true);
  });

  it('returns filtered projects by health status', async () => {
    const { result, rerender } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Toggle healthy filter
    useFilterStore.getState().toggleStatusFilter('healthy');
    rerender();

    // All returned projects should be healthy
    result.current.projects.forEach((p) => {
      expect(p.health.status).toBe('healthy');
    });
  });

  it('provides allProjects without filters', async () => {
    const { result, rerender } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const allCount = result.current.allProjects.length;

    // Apply a filter
    useFilterStore.getState().setSearchText('Dashboard');
    rerender();

    // allProjects should remain unchanged
    expect(result.current.allProjects.length).toBe(allCount);
    // filtered projects may be different
    expect(result.current.projects.length).toBeLessThanOrEqual(allCount);
  });

  it('handles API errors gracefully', async () => {
    // Mock fetch to simulate error
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useProjects());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.projects).toEqual([]);

    // Restore fetch
    global.fetch = originalFetch;
  });
});
