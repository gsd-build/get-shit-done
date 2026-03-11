import type { Project, ApiEnvelope, ApiMeta } from '@/types';
import type { Plan, PlanTask } from '@/types/plan';
import type { Coverage } from '@/components/features/verify/CoverageHeatmap';

const API_BASE =
  process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:4000';

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

    const json = await response.json();
    return json as ProjectsResponse;
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

// ------------------------------------------------------------------
// Plan Phase API Functions
// ------------------------------------------------------------------

/**
 * Fetch plan data for a phase.
 *
 * @param phaseId - The phase ID
 * @returns Plan data with tasks
 */
export async function fetchPlan(phaseId: string): Promise<ApiEnvelope<Plan | null>> {
  const url = new URL(`/api/phases/${phaseId}/plan`, API_BASE);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: { code: 'FETCH_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();
    return json as ApiEnvelope<Plan>;
  } catch (err) {
    return {
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: '',
      },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

/**
 * Update a plan task.
 *
 * @param phaseId - The phase ID
 * @param taskId - The task ID to update
 * @param updates - Partial updates to apply
 * @returns Updated task
 */
export async function updatePlanTask(
  phaseId: string,
  taskId: string,
  updates: Partial<PlanTask>
): Promise<ApiEnvelope<PlanTask | null>> {
  const url = new URL(`/api/phases/${phaseId}/plan/tasks/${taskId}`, API_BASE);

  try {
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: { code: 'UPDATE_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();
    return json as ApiEnvelope<PlanTask>;
  } catch (err) {
    return {
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: '',
      },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

/**
 * Start research for a phase.
 *
 * @param phaseId - The phase ID to start research for
 */
export async function startResearch(phaseId: string): Promise<void> {
  const url = new URL(`/api/phases/${phaseId}/research`, API_BASE);

  await fetch(url.toString(), { method: 'POST' });
}

// ------------------------------------------------------------------
// Verify Phase API Functions
// ------------------------------------------------------------------

/**
 * Start verification for a phase.
 *
 * @param phaseId - The phase ID to verify
 */
export async function startVerification(phaseId: string): Promise<void> {
  const url = new URL(`/api/phases/${phaseId}/verify`, API_BASE);

  await fetch(url.toString(), { method: 'POST' });
}

/**
 * Submit approval for a phase.
 *
 * @param phaseId - The phase ID to approve
 */
export async function submitApproval(phaseId: string): Promise<void> {
  const url = new URL(`/api/phases/${phaseId}/approve`, API_BASE);

  await fetch(url.toString(), { method: 'POST' });
}

/**
 * Submit rejection with selected gaps for a phase.
 * Returns the plan URL for gap addressing.
 *
 * @param phaseId - The phase ID to reject
 * @param gapIds - Array of gap IDs to address
 * @returns Object with planUrl for gap addressing
 */
export async function submitRejection(
  phaseId: string,
  gapIds: string[]
): Promise<{ planUrl: string }> {
  const url = new URL(`/api/phases/${phaseId}/reject`, API_BASE);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gapIds }),
  });

  if (!response.ok) {
    throw new Error(`Rejection failed: HTTP ${response.status}`);
  }

  const json = await response.json();
  return json.data as { planUrl: string };
}

/**
 * Fetch coverage data for a phase.
 *
 * @param phaseId - The phase ID
 * @returns Coverage data array
 */
export async function fetchCoverage(
  phaseId: string
): Promise<ApiEnvelope<Coverage[]>> {
  const url = new URL(`/api/phases/${phaseId}/coverage`, API_BASE);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      return {
        success: false,
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: { code: 'FETCH_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();
    return json as ApiEnvelope<Coverage[]>;
  } catch (err) {
    return {
      success: false,
      data: [],
      meta: {
        timestamp: new Date().toISOString(),
        requestId: '',
      },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}
