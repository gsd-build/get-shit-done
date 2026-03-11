import type { Project, ApiEnvelope, ApiMeta } from '@/types';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

export interface ProjectsResponse extends ApiEnvelope<Project[]> {
  meta: ApiMeta & {
    total: number;
    hasNextPage: boolean;
  };
}

/** Raw API response structure from backend */
interface RawProjectsResponse {
  data: {
    items: Project[];
    pagination: {
      nextCursor: string | null;
      hasNextPage: boolean;
      total: number;
    };
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Fetch all projects from the API.
 *
 * @param cursor - Optional cursor for pagination
 * @returns Projects response with envelope structure
 */
export async function fetchProjects(cursor?: string): Promise<ProjectsResponse> {
  const url = new URL('/api/projects', API_BASE);
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  try {
    const response = await fetch(url.toString());

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

    const json: RawProjectsResponse = await response.json();

    // Transform backend response to frontend expected structure
    if (json.error) {
      return {
        success: false,
        data: [],
        meta: {
          timestamp: json.meta.timestamp,
          requestId: json.meta.requestId,
          total: 0,
          hasNextPage: false,
        },
        error: json.error,
      };
    }

    return {
      success: true,
      data: json.data.items,
      meta: {
        timestamp: json.meta.timestamp,
        requestId: json.meta.requestId,
        total: json.data.pagination.total,
        hasNextPage: json.data.pagination.hasNextPage,
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
