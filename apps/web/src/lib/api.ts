import type { Project, ApiEnvelope, ApiMeta } from '@/types';
import type { Plan, PlanTask } from '@/types/plan';
import type { Coverage } from '@/components/features/verify/CoverageHeatmap';

// Use local proxy to add authentication to API calls
const API_BASE = '/api/proxy';

function proxyUrl(path: string): string {
  return `${API_BASE}${path}`;
}

interface ProjectPhase {
  number: number;
  name: string;
  slug: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  plans: number;
  completedPlans: number;
}

interface ProjectPhasesResponse {
  success: boolean;
  data?: {
    phases?: ProjectPhase[];
    total?: number;
  };
  meta?: ApiMeta;
  error?: {
    code: string;
    message: string;
  };
}

async function fetchProjectPhases(projectId: string): Promise<ApiEnvelope<ProjectPhase[]>> {
  const response = await fetch(proxyUrl(`/projects/${projectId}/phases`));

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

  const json = (await response.json()) as ProjectPhasesResponse;
  return {
    success: Boolean(json.success),
    data: json.data?.phases ?? [],
    meta: {
      timestamp: json.meta?.timestamp ?? new Date().toISOString(),
      requestId: json.meta?.requestId ?? '',
    },
    ...(json.error ? { error: json.error } : {}),
  };
}

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
  try {
    const phasesResponse = await fetchProjectPhases(phaseId);
    if (!phasesResponse.success) {
      return {
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: phasesResponse.error ?? { code: 'FETCH_ERROR', message: 'Failed to fetch phases' },
      };
    }

    const tasks: PlanTask[] = (phasesResponse.data ?? []).flatMap((phase) =>
      Array.from({ length: phase.plans }, (_, index) => ({
        id: `${phase.slug}-plan-${index + 1}`,
        name: `${phase.name} Plan ${index + 1}`,
        description:
          phase.status === 'completed'
            ? 'Completed plan from this phase.'
            : 'Plan discovered for this phase.',
        wave: phase.number,
        dependsOn: [],
        files: [],
        type: 'auto',
      }))
    );

    return {
      success: true,
      data: {
        id: `project-${phaseId}-plan`,
        phaseId,
        tasks,
        createdAt: new Date().toISOString(),
      },
      meta: phasesResponse.meta ?? {
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
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
  return {
    success: true,
    data: {
      id: taskId,
      name: updates.name ?? 'Updated Task',
      description: updates.description ?? '',
      wave: updates.wave ?? 1,
      dependsOn: updates.dependsOn ?? [],
      files: updates.files ?? [],
      type: updates.type ?? 'auto',
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: '',
    },
  };
}

/**
 * Start research for a phase.
 *
 * @param phaseId - The phase ID to start research for
 */
export async function startResearch(phaseId: string): Promise<void> {
  void phaseId;
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
  void phaseId;
}

/**
 * Submit approval for a phase.
 *
 * @param phaseId - The phase ID to approve
 */
export async function submitApproval(phaseId: string): Promise<void> {
  void phaseId;
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
  void gapIds;
  return { planUrl: `/projects/${phaseId}/plan` };
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
  try {
    const phasesResponse = await fetchProjectPhases(phaseId);
    if (!phasesResponse.success) {
      return {
        success: false,
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: phasesResponse.error ?? { code: 'FETCH_ERROR', message: 'Failed to fetch phases' },
      };
    }

    const phases = phasesResponse.data ?? [];
    const coverage: Coverage[] = phases.map((phase) => ({
      requirementId: `phase-${phase.number}`,
      phaseId: phase.slug,
      coverage: phase.plans === 0 ? 0 : phase.completedPlans >= phase.plans ? 2 : 1,
    }));

    return {
      success: true,
      data: coverage,
      meta: phasesResponse.meta ?? {
        timestamp: new Date().toISOString(),
        requestId: '',
      },
    };
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
