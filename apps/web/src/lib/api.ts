import type { Project, ApiEnvelope, ApiMeta } from '@/types';
import type {
  Plan,
  PlanTask,
  ParallelismAssessment,
  ParallelismWorkflowNode,
} from '@/types/plan';
import type { Coverage } from '@/components/features/verify/CoverageHeatmap';

// Use local proxy to add authentication to API calls
const API_BASE = '/api/proxy';

function proxyUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export interface ProjectsResponse extends ApiEnvelope<Project[]> {
  meta: ApiMeta & {
    total: number;
    hasNextPage: boolean;
  };
}

export type OrchestrationAction =
  | 'start'
  | 'pause'
  | 'resume'
  | 'abort'
  | 'retryFailedStep'
  | 'rerunFromCheckpoint'
  | 'stopNow'
  | 'cancelAndStartNew';

export interface LifecycleActionRequest {
  action: OrchestrationAction;
  runId: string;
}

export interface RevalidationSummary {
  runId: string;
  passed: boolean;
  failures: string[];
  changedTasks: string[];
  recovery?: {
    retry: { action: 'retryFailedStep'; label: string };
    fixPlan: { action: 'openFixPlan'; label: string };
  };
}

export interface ProjectsOrchestrationSummary {
  pausedRuns: number;
  pausedRunNames: string[];
  hasPausedRuns: boolean;
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

export async function fetchParallelismAssessment(
  projectId: string,
  phaseId: string
): Promise<ApiEnvelope<ParallelismAssessment | null>> {
  const url = proxyUrl(`/projects/${projectId}/phases/${phaseId}/parallelism`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString(), requestId: '' },
        error: { code: 'FETCH_ERROR', message: `HTTP ${response.status}` },
      };
    }
    const json = (await response.json()) as Partial<ApiEnvelope<ParallelismAssessment>>;
    return {
      success: !json.error,
      data: (json.data ?? null) as ParallelismAssessment | null,
      meta: json.meta ?? { timestamp: new Date().toISOString(), requestId: '' },
      ...(json.error ? { error: json.error } : {}),
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: '' },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

export async function fetchParallelismWorkflow(
  projectId: string
): Promise<ApiEnvelope<ParallelismWorkflowNode[]>> {
  const url = proxyUrl(`/projects/${projectId}/phases/workflow`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        success: false,
        data: [],
        meta: { timestamp: new Date().toISOString(), requestId: '' },
        error: { code: 'FETCH_ERROR', message: `HTTP ${response.status}` },
      };
    }
    const json = (await response.json()) as Partial<ApiEnvelope<ParallelismWorkflowNode[]>>;
    return {
      success: !json.error,
      data: (json.data ?? []) as ParallelismWorkflowNode[],
      meta: json.meta ?? { timestamp: new Date().toISOString(), requestId: '' },
      ...(json.error ? { error: json.error } : {}),
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      meta: { timestamp: new Date().toISOString(), requestId: '' },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

export async function postAgentLifecycleAction(
  _projectId: string,
  payload: LifecycleActionRequest
): Promise<ApiEnvelope<{ accepted: boolean } | null>> {
  const url = proxyUrl('/agents/actions');
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString(), requestId: '' },
        error: { code: 'ACTION_ERROR', message: `HTTP ${response.status}` },
      };
    }
    return (await response.json()) as ApiEnvelope<{ accepted: boolean }>;
  } catch (err) {
    return {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: '' },
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

export async function postRunRevalidation(
  _projectId: string,
  runId: string
): Promise<ApiEnvelope<RevalidationSummary | null>> {
  const url = proxyUrl(`/agents/${runId}/revalidate`);
  try {
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString(), requestId: '' },
        error: { code: 'REVALIDATION_ERROR', message: `HTTP ${response.status}` },
      };
    }
    return (await response.json()) as ApiEnvelope<RevalidationSummary>;
  } catch (err) {
    return {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString(), requestId: '' },
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
  const url = proxyUrl(`/projects/${phaseId}/plan`);

  try {
    const response = await fetch(url);

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

    // Proxy responses are shaped as { data, meta, error } without a top-level success field.
    // Normalize to ApiEnvelope so callers can consistently branch on `success`.
    const hasError = Boolean(json?.error);
    return {
      success: !hasError,
      data: (json?.data ?? null) as Plan | null,
      meta: {
        timestamp: json?.meta?.timestamp ?? new Date().toISOString(),
        requestId: json?.meta?.requestId ?? '',
      },
      ...(hasError ? { error: json.error } : {}),
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
  const url = proxyUrl(`/projects/${phaseId}/plan/tasks/${taskId}`);

  try {
    const response = await fetch(url, {
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
 * Create a new plan task from UI input.
 */
export async function createPlan(
  projectId: string,
  payload: { title: string; category: string; intent?: string }
): Promise<ApiEnvelope<{ created: boolean; task: PlanTask } | null>> {
  const url = proxyUrl(`/projects/${projectId}/plan`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        success: false,
        data: null,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: '',
        },
        error: { code: 'CREATE_ERROR', message: `HTTP ${response.status}` },
      };
    }

    const json = await response.json();
    return json as ApiEnvelope<{ created: boolean; task: PlanTask }>;
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
  const url = proxyUrl(`/projects/${phaseId}/research`);
  await fetch(url, { method: 'POST' });
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
  const url = proxyUrl(`/projects/${phaseId}/verify`);
  await fetch(url, { method: 'POST' });
}

/**
 * Submit approval for a phase.
 *
 * @param phaseId - The phase ID to approve
 */
export async function submitApproval(phaseId: string): Promise<void> {
  const url = proxyUrl(`/projects/${phaseId}/approve`);
  const response = await fetch(url, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Approval failed: HTTP ${response.status}`);
  }
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
  const url = proxyUrl(`/projects/${phaseId}/reject`);

  const response = await fetch(url, {
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
  const url = proxyUrl(`/projects/${phaseId}/coverage`);

  try {
    const response = await fetch(url);

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
