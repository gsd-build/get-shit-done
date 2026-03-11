/**
 * useAgentControl hook tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../../tests/mocks/server.js';
import { useAgentControl } from './useAgentControl';

// API base matches the hook's default
const API_BASE = 'http://localhost:3001';

// Track requests for verification
let lastRequest: { method: string; url: string; body?: unknown } | null = null;

// Mock the execution store
const mockSetPaused = vi.fn();
const mockReset = vi.fn();
vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: (selector: (state: unknown) => unknown) => {
    const state = {
      setPaused: mockSetPaused,
      reset: mockReset,
    };
    return selector(state);
  },
}));

describe('useAgentControl', () => {
  const agentId = 'agent-123';

  beforeEach(() => {
    vi.clearAllMocks();
    lastRequest = null;

    // Set up default handlers for this test suite
    server.use(
      // PATCH /api/agents/:id - pause/resume
      http.patch(`${API_BASE}/api/agents/:id`, async ({ request, params }) => {
        const body = await request.json();
        lastRequest = { method: 'PATCH', url: `/api/agents/${params['id']}`, body };
        return HttpResponse.json({ success: true });
      }),

      // DELETE /api/agents/:id - abort
      http.delete(`${API_BASE}/api/agents/:id`, ({ request, params }) => {
        const url = new URL(request.url);
        const rollback = url.searchParams.get('rollback');
        lastRequest = {
          method: 'DELETE',
          url: rollback ? `/api/agents/${params['id']}?rollback=true` : `/api/agents/${params['id']}`,
        };
        return HttpResponse.json({ success: true });
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('pause', () => {
    it('makes PATCH request with paused status', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.pause();
      });

      expect(lastRequest).toEqual({
        method: 'PATCH',
        url: `/api/agents/${agentId}`,
        body: { status: 'paused' },
      });
    });

    it('updates store on successful pause', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.pause();
      });

      expect(mockSetPaused).toHaveBeenCalledWith(true);
    });

    it('sets error when no agentId provided', async () => {
      const { result } = renderHook(() => useAgentControl(null));

      await act(async () => {
        await result.current.pause();
      });

      expect(result.current.error).toBe('No agent ID provided');
      expect(lastRequest).toBeNull();
    });

    it('handles error response', async () => {
      server.use(
        http.patch(`${API_BASE}/api/agents/:id`, () => {
          return HttpResponse.json({ message: 'Server error' }, { status: 500 });
        })
      );

      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        try {
          await result.current.pause();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Server error');
    });
  });

  describe('resume', () => {
    it('makes PATCH request with running status', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.resume();
      });

      expect(lastRequest).toEqual({
        method: 'PATCH',
        url: `/api/agents/${agentId}`,
        body: { status: 'running' },
      });
    });

    it('updates store on successful resume', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.resume();
      });

      expect(mockSetPaused).toHaveBeenCalledWith(false);
    });

    it('sets error when no agentId provided', async () => {
      const { result } = renderHook(() => useAgentControl(null));

      await act(async () => {
        await result.current.resume();
      });

      expect(result.current.error).toBe('No agent ID provided');
      expect(lastRequest).toBeNull();
    });
  });

  describe('abort', () => {
    it('makes DELETE request', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.abort();
      });

      expect(lastRequest).toEqual({
        method: 'DELETE',
        url: `/api/agents/${agentId}`,
      });
    });

    it('makes DELETE request with rollback query param when rollback is true', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.abort(true);
      });

      expect(lastRequest).toEqual({
        method: 'DELETE',
        url: `/api/agents/${agentId}?rollback=true`,
      });
    });

    it('resets store on successful abort', async () => {
      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        await result.current.abort();
      });

      expect(mockReset).toHaveBeenCalled();
    });

    it('sets error when no agentId provided', async () => {
      const { result } = renderHook(() => useAgentControl(null));

      await act(async () => {
        await result.current.abort();
      });

      expect(result.current.error).toBe('No agent ID provided');
      expect(lastRequest).toBeNull();
    });

    it('handles error response', async () => {
      server.use(
        http.delete(`${API_BASE}/api/agents/:id`, () => {
          return HttpResponse.json({ message: 'Abort failed' }, { status: 500 });
        })
      );

      const { result } = renderHook(() => useAgentControl(agentId));

      await act(async () => {
        try {
          await result.current.abort();
        } catch {
          // Expected to throw
        }
      });

      expect(result.current.error).toBe('Abort failed');
    });
  });

  describe('loading state', () => {
    it('sets isLoading during pause request', async () => {
      server.use(
        http.patch(`${API_BASE}/api/agents/:id`, async () => {
          await delay(50);
          return HttpResponse.json({ success: true });
        })
      );

      const { result } = renderHook(() => useAgentControl(agentId));

      let pausePromise: Promise<void>;
      act(() => {
        pausePromise = result.current.pause();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await act(async () => {
        await pausePromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
