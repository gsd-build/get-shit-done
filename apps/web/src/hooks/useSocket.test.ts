import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSocket } from './useSocket';

// Mock @gsd/events
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
};

vi.mock('@gsd/events', () => ({
  createSocketClient: vi.fn(() => mockSocket),
}));

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  it('returns socket instance and connection status', () => {
    const { result } = renderHook(() => useSocket('http://localhost:4000'));
    expect(result.current.socket).toBeDefined();
    expect(typeof result.current.isConnected).toBe('boolean');
  });

  it('registers connect and disconnect handlers', () => {
    renderHook(() => useSocket('http://localhost:4000'));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useSocket('http://localhost:4000'));
    unmount();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('removes listeners on unmount', () => {
    const { unmount } = renderHook(() => useSocket('http://localhost:4000'));
    unmount();
    expect(mockSocket.off).toHaveBeenCalledWith(
      'connect',
      expect.any(Function)
    );
    expect(mockSocket.off).toHaveBeenCalledWith(
      'disconnect',
      expect.any(Function)
    );
  });

  it('reports connected when socket is already connected', () => {
    mockSocket.connected = true;
    const { result } = renderHook(() => useSocket('http://localhost:4000'));
    expect(result.current.isConnected).toBe(true);
  });
});
