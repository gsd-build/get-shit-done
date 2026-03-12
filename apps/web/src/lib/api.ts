import type { Project, ApiEnvelope, ApiMeta } from '@/types';

// Use local proxy to add authentication to API calls
const API_BASE = '/api/proxy';

export interface ProjectsResponse extends ApiEnvelope<Project[]> {
  meta: ApiMeta & {
    total: number;
    hasNextPage: boolean;
  };
}

/**
 * Fetch all projects from the API.
 *
 * @param cursor - Optional cursor for pagination
 * @returns Projects response with envelope structure
 */
export async function fetchProjects(cursor?: string): Promise<ProjectsResponse> {
  let url = `${API_BASE}/projects`;
  if (cursor) {
    url += `?cursor=${encodeURIComponent(cursor)}`;
  }

  try {
    const response = await fetch(url, { credentials: 'include' });

    if (!response.ok) {
      return {
        success: false,
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
          total: 0,
          hasNextPage: false,
        },
        error: { code: 'FETCH_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();

    // API returns { data: { items: [...], pagination: {...} }, meta: {...} }
    // Transform to expected shape: { success: true, data: [...], meta: {...} }
    const items = json.data?.items ?? json.data ?? [];
    const pagination = json.data?.pagination ?? {};

    return {
      success: true,
      data: items,
      meta: {
        timestamp: json.meta?.timestamp ?? new Date().toISOString(),
        requestId: json.meta?.requestId ?? '',
        total: pagination.total ?? items.length,
        hasNextPage: pagination.hasNextPage ?? false,
      },
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      meta: {
        timestamp: new Date().toISOString(),
        requestId: '',
        total: 0,
        hasNextPage: false,
      },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
