'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createSocketClient, type TypedSocket } from '@gsd/events';

/**
 * React hook for Socket.IO connection management.
 *
 * Creates a typed socket connection using @gsd/events and manages
 * connection state automatically. Cleans up on unmount.
 *
 * @param url - Socket.IO server URL
 * @returns Object with socket instance, connection status, and reconnect function
 */
export function useSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    const socket = createSocketClient({ url, autoConnect: true });
    socketRef.current = socket;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Check if already connected
    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, [url]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  return { socket: socketRef.current, isConnected, reconnect };
}
