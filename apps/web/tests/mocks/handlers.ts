import { http, HttpResponse } from 'msw';

// Mock project data matching the Project type from apps/server
const mockProjects = [
  {
    id: 'project-1',
    name: 'GSD Dashboard',
    path: '/path/to/project',
    status: 'active' as const,
    health: { status: 'healthy' as const, issues: [] },
    progress: {
      completedPhases: 8,
      totalPhases: 12,
      completedPlans: 24,
      totalPlans: 36,
      percentage: 67,
    },
    currentPhase: 'Phase 15',
    lastActivity: '2026-03-11T10:00:00Z',
  },
  {
    id: 'project-2',
    name: 'Another Project',
    path: '/path/to/another',
    status: 'paused' as const,
    health: { status: 'degraded' as const, issues: ['Missing STATE.md'] },
    progress: {
      completedPhases: 3,
      totalPhases: 8,
      completedPlans: 5,
      totalPlans: 16,
      percentage: 31,
    },
    currentPhase: 'Phase 4',
    lastActivity: '2026-03-10T15:30:00Z',
  },
];

const API_BASE = 'http://localhost:4000';
const API_PROXY_BASE = '/api/proxy';

export const handlers = [
  // GET /api/projects - List all projects
  http.get(`${API_BASE}/api/projects`, () => {
    return HttpResponse.json({
      success: true,
      data: mockProjects,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id',
        total: mockProjects.length,
        hasNextPage: false,
      },
    });
  }),
  // GET /api/proxy/projects - List all projects (frontend proxy route)
  http.get(`${API_PROXY_BASE}/projects`, () => {
    return HttpResponse.json({
      data: {
        items: mockProjects,
        pagination: {
          nextCursor: null,
          hasNextPage: false,
          total: mockProjects.length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id',
      },
    });
  }),

  // GET /api/projects/:id - Get single project
  http.get(`${API_BASE}/api/projects/:id`, ({ params }) => {
    const id = params['id'];
    const project = mockProjects.find((p) => p.id === id);
    if (!project) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Project ${id} not found`,
          },
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      success: true,
      data: project,
    });
  }),
  // GET /api/proxy/projects/:id - Get single project (frontend proxy route)
  http.get(`${API_PROXY_BASE}/projects/:id`, ({ params }) => {
    const id = params['id'];
    const project = mockProjects.find((p) => p.id === id);
    if (!project) {
      return HttpResponse.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Project ${id} not found`,
          },
          meta: {
            timestamp: new Date().toISOString(),
            requestId: 'mock-request-id',
          },
        },
        { status: 404 }
      );
    }
    return HttpResponse.json({
      data: project,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-request-id',
      },
    });
  }),

  // POST /api/phases/:id/verify - Start verification
  http.post(`${API_BASE}/api/phases/:id/verify`, () => {
    return HttpResponse.json({
      success: true,
      data: { started: true },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-verify-request-id',
      },
    });
  }),
  // POST /api/proxy/projects/:id/verify - Start verification (frontend proxy route)
  http.post(`${API_PROXY_BASE}/projects/:id/verify`, () => {
    return HttpResponse.json({
      data: { started: true },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'mock-verify-request-id',
      },
    });
  }),
];
