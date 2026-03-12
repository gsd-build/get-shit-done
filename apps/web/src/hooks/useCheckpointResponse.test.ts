import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCheckpointResponse } from './useCheckpointResponse';
import { useExecutionStore } from '@/stores/executionStore';

// Mock @gsd/events
vi.mock('@gsd/events', () => ({
  EVENTS: {
    CHECKPOINT_RESPONSE: 'checkpoint:response',
  },
}));

// Mock socket
const createMockSocket = () => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
});

describe('useCheckpointResponse', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    // Reset execution store
    useExecutionStore.getState().reset();
    // Set a pending checkpoint for testing
    // (omit optional properties per exactOptionalPropertyTypes)
    useExecutionStore.getState().setCheckpoint({
      checkpointId: 'cp-123',
      type: 'human-verify',
      prompt: 'Verify the deployment',
      timeoutMs: 60000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('emits checkpoint:response event with correct payload', () => {
    const { result } = renderHook(() => useCheckpointResponse(mockSocket as never));

    act(() => {
      result.current.respondToCheckpoint('cp-123', 'Looks good');
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('checkpoint:response', {
      checkpointId: 'cp-123',
      response: 'Looks good',
    });
  });

  it('clears pendingCheckpoint from store after response', () => {
    const { result } = renderHook(() => useCheckpointResponse(mockSocket as never));

    // Verify checkpoint is set
    expect(useExecutionStore.getState().pendingCheckpoint).not.toBeNull();

    act(() => {
      result.current.respondToCheckpoint('cp-123', 'Approved');
    });

    // Verify checkpoint is cleared
    expect(useExecutionStore.getState().pendingCheckpoint).toBeNull();
  });

  it('does not emit when socket is null', () => {
    const { result } = renderHook(() => useCheckpointResponse(null));

    act(() => {
      result.current.respondToCheckpoint('cp-123', 'Looks good');
    });

    // Since socket is null, emit should not be called
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('returns stable respondToCheckpoint function', () => {
    const { result, rerender } = renderHook(() => useCheckpointResponse(mockSocket as never));
    const firstFn = result.current.respondToCheckpoint;

    rerender();
    const secondFn = result.current.respondToCheckpoint;

    // Function reference should be stable due to useCallback
    expect(firstFn).toBe(secondFn);
  });
});
