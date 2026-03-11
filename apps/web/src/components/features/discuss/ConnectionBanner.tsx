'use client';

import { memo, useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

interface ConnectionBannerProps {
  /** Whether socket is connected */
  isConnected: boolean;
}

/**
 * Connection status banner shown when disconnected.
 *
 * - Non-blocking, shows "Reconnecting..." with auto-retry status
 * - Dismisses automatically on reconnect
 * - Shows at top of chat interface
 */
export const ConnectionBanner = memo(function ConnectionBanner({
  isConnected,
}: ConnectionBannerProps) {
  const [showConnected, setShowConnected] = useState(false);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  useEffect(() => {
    if (!isConnected) {
      setWasDisconnected(true);
      setShowConnected(false);
    } else if (wasDisconnected) {
      // Show "Connected" briefly after reconnection
      setShowConnected(true);
      const timer = setTimeout(() => {
        setShowConnected(false);
        setWasDisconnected(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, wasDisconnected]);

  // Don't show anything if always connected
  if (isConnected && !showConnected) {
    return null;
  }

  return (
    <div
      className={clsx(
        'flex items-center justify-center gap-2 px-4 py-2 text-sm',
        isConnected
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
          : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      )}
      role="status"
      aria-live="polite"
    >
      {isConnected ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Reconnecting...</span>
          <span className="animate-pulse">|</span>
        </>
      )}
    </div>
  );
});
