import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVerification } from './useVerification';
import { useVerificationStore } from '@/stores/verificationStore';
import type { TypedSocket } from '@gsd/events';

// Mock Socket.IO
const createMockSocket = (): TypedSocket => {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};

  return {
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!listeners[event]) {
        listeners[event] = [];
      }
      listeners[event]!.push(callback);
      return createMockSocket();
    }),
    off: vi.fn((event: string, callback?: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        if (callback) {
          listeners[event] = listeners[event]!.filter((cb) => cb !== callback);
        } else {
          delete listeners[event];
        }
      }
      return createMockSocket();
    }),
    emit: vi.fn(),
    connected: true,
    // Helper to simulate events
    __emit: (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((cb) => cb(...args));
    },
  } as unknown as TypedSocket & { __emit: (event: string, ...args: unknown[]) => void };
};

describe('useVerification', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useVerificationStore.getState().reset();
    mockSocket = createMockSocket();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockRestore();
  });

  describe('subscription', () => {
    it('subscribes to verification events on mount', () => {
      renderHook(() => useVerification(mockSocket, 'phase-1'));

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'verification:subscribe',
        'phase-1'
      );
    });

    it('unsubscribes on unmount', () => {
      const { unmount } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );

      unmount();

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'verification:unsubscribe',
        'phase-1'
      );
    });
  });

  describe('startVerification', () => {
    it('calls POST /api/phases/:id/verify', async () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );

      await act(async () => {
        await result.current.startVerification();
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/phases/phase-1/verify'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('calls setRunning on start', async () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );

      await act(async () => {
        await result.current.startVerification();
      });

      expect(result.current.status).toBe('running');
    });
  });

  describe('event handling', () => {
    it('updates store when verification:test_start received', async () => {
      renderHook(() => useVerification(mockSocket, 'phase-1'));

      await act(async () => {
        (mockSocket as unknown as { __emit: (event: string, ...args: unknown[]) => void }).__emit('verification:test_start', {
          testName: 'Auth test',
          requirementId: 'AUTH-01',
        });
      });

      expect(useVerificationStore.getState().runningTest).toBe('Auth test');
    });

    it('updates store when verification:test_result received', async () => {
      renderHook(() => useVerification(mockSocket, 'phase-1'));

      await act(async () => {
        (mockSocket as unknown as { __emit: (event: string, ...args: unknown[]) => void }).__emit('verification:test_result', {
          requirementId: 'AUTH-01',
          testName: 'Auth test',
          passed: true,
          duration: 150,
        });
      });

      const { results } = useVerificationStore.getState();
      expect(results).toHaveLength(1);
      expect(results[0]?.passed).toBe(true);
    });

    it('updates store when verification:complete received', async () => {
      renderHook(() => useVerification(mockSocket, 'phase-1'));

      await act(async () => {
        (mockSocket as unknown as { __emit: (event: string, ...args: unknown[]) => void }).__emit('verification:complete', {
          passed: true,
          summary: 'All tests passed',
          gaps: [
            {
              id: 'gap-1',
              requirementId: 'REQ-1',
              description: 'Minor issue',
              severity: 'minor',
            },
          ],
        });
      });

      const state = useVerificationStore.getState();
      expect(state.status).toBe('complete');
      expect(state.overallPassed).toBe(true);
      expect(state.gaps).toHaveLength(1);
    });
  });

  describe('return values', () => {
    it('returns status from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.status).toBe('idle');
    });

    it('returns results from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.results).toEqual([]);
    });

    it('returns gaps from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.gaps).toEqual([]);
    });

    it('returns manualTests from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.manualTests).toEqual([]);
    });

    it('returns overallPassed from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.overallPassed).toBeNull();
    });

    it('returns summary from store', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(result.current.summary).toBeNull();
    });

    it('returns startVerification function', () => {
      const { result } = renderHook(() =>
        useVerification(mockSocket, 'phase-1')
      );
      expect(typeof result.current.startVerification).toBe('function');
    });
  });

  describe('null socket handling', () => {
    it('handles null socket gracefully', () => {
      expect(() => {
        renderHook(() => useVerification(null, 'phase-1'));
      }).not.toThrow();
    });
  });
});
