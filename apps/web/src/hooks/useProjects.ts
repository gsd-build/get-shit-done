'use client';

import { useEffect, useCallback, useMemo } from 'react';
import {
  useProjectStore,
  selectProjects,
  selectIsLoading,
  selectError,
} from '@/stores/projectStore';
import {
  useFilterStore,
  selectSearchText,
  selectStatusFilters,
} from '@/stores/filterStore';
import { fetchProjects } from '@/lib/api';
import type { HealthStatus } from '@/types';

/**
 * React hook for project data fetching and filtering.
 *
 * Manages loading projects from the API, storing them in the projectStore,
 * and applying filters from the filterStore. Provides both filtered and
 * unfiltered project lists.
 *
 * @returns Object with projects, loading state, error, and refetch function
 */
export function useProjects() {
  const projects = useProjectStore(selectProjects);
  const isLoading = useProjectStore(selectIsLoading);
  const error = useProjectStore(selectError);
  const setProjects = useProjectStore((s) => s.setProjects);
  const setLoading = useProjectStore((s) => s.setLoading);
  const setError = useProjectStore((s) => s.setError);

  const searchText = useFilterStore(selectSearchText);
  const statusFilters = useFilterStore(selectStatusFilters);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchProjects();
      if (response.success) {
        setProjects(response.data);
      } else {
        setError(response.error?.message || 'Failed to load projects');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [setProjects, setLoading, setError]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Filter projects based on search text and status filters
  const filteredProjects = useMemo(() => {
    let result = projects;

    // Filter by search text (case-insensitive)
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(lower));
    }

    // Filter by status (if any filter is active)
    const activeStatuses = (
      Object.entries(statusFilters) as [HealthStatus, boolean][]
    )
      .filter(([, active]) => active)
      .map(([status]) => status);

    if (activeStatuses.length > 0) {
      result = result.filter((p) => activeStatuses.includes(p.health.status));
    }

    return result;
  }, [projects, searchText, statusFilters]);

  return {
    projects: filteredProjects,
    allProjects: projects,
    isLoading,
    error,
    refetch: loadProjects,
  };
}
