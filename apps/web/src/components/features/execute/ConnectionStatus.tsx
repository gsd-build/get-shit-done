/**
 * ConnectionStatus component
 *
 * Displays connection state with recovery CTAs when disconnected.
 * Provides clear actions: retry, check backend, view diagnostics.
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Server,
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';

export interface ConnectionStatusProps {
  /** Whether socket is connected */
  isConnected: boolean;
  /** Socket URL for diagnostics */
  socketUrl: string;
  /** Health endpoint URL */
  healthSummaryUrl: string;
  /** Callback to retry connection */
  onRetryConnection: () => void;
}

interface HealthStatus {
  status: 'idle' | 'checking' | 'healthy' | 'unhealthy';
  message?: string;
  details?: {
    server?: string;
    socket?: number;
    uptime?: number;
  };
}

/**
 * Connection status indicator with recovery actions.
 *
 * When connected: Shows green indicator
 * When disconnected: Shows red indicator with CTAs:
 *   - Retry Connection
 *   - Check Backend Status
 *   - View Diagnostics (expandable)
 */
export function ConnectionStatus({
  isConnected,
  socketUrl,
  healthSummaryUrl,
  onRetryConnection,
}: ConnectionStatusProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: 'idle' });
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Retry connection with loading state
  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      onRetryConnection();
      // Give it a moment to reconnect
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } finally {
      setIsRetrying(false);
    }
  }, [onRetryConnection]);

  // Check backend health
  const handleCheckBackend = useCallback(async () => {
    setHealthStatus({ status: 'checking' });
    try {
      const response = await fetch(healthSummaryUrl);
      if (response.ok) {
        const json = await response.json();
        setHealthStatus({
          status: 'healthy',
          message: 'Backend is running',
          details: {
            server: json.data?.server?.version,
            socket: json.data?.socket?.connectedClients,
            uptime: Math.floor((json.data?.socket?.uptime || 0) / 3600),
          },
        });
      } else {
        setHealthStatus({
          status: 'unhealthy',
          message: `Backend returned ${response.status}`,
        });
      }
    } catch (error) {
      setHealthStatus({
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Failed to reach backend',
      });
    }
  }, [healthSummaryUrl]);

  // Connected state - compact indicator
  if (isConnected) {
    return (
      <div
        data-testid="connection-status"
        data-connected="true"
        className="flex items-center gap-1.5 text-xs text-green-500"
      >
        <Wifi className="w-3.5 h-3.5" />
        <span>Connected</span>
      </div>
    );
  }

  // Disconnected state - expanded with CTAs
  return (
    <div
      data-testid="connection-status"
      data-connected="false"
      className="flex flex-col gap-2"
    >
      {/* Status indicator */}
      <div className="flex items-center gap-1.5 text-xs text-red-500">
        <WifiOff className="w-3.5 h-3.5" />
        <span>Disconnected</span>
      </div>

      {/* Recovery CTAs */}
      <div className="flex items-center gap-2">
        {/* Retry Connection */}
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 rounded transition-colors"
        >
          {isRetrying ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
        </button>

        {/* Check Backend */}
        <button
          type="button"
          onClick={handleCheckBackend}
          disabled={healthStatus.status === 'checking'}
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-zinc-400 bg-zinc-500/10 hover:bg-zinc-500/20 disabled:opacity-50 rounded transition-colors"
        >
          {healthStatus.status === 'checking' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : healthStatus.status === 'healthy' ? (
            <CheckCircle className="w-3 h-3 text-green-500" />
          ) : healthStatus.status === 'unhealthy' ? (
            <XCircle className="w-3 h-3 text-red-500" />
          ) : (
            <Server className="w-3 h-3" />
          )}
          <span>Check Backend</span>
        </button>

        {/* Diagnostics Toggle */}
        <button
          type="button"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          <Terminal className="w-3 h-3" />
          {showDiagnostics ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Health status message */}
      {healthStatus.status !== 'idle' && healthStatus.status !== 'checking' && (
        <div
          className={`text-xs px-2 py-1 rounded ${
            healthStatus.status === 'healthy'
              ? 'bg-green-500/10 text-green-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {healthStatus.message}
          {healthStatus.details && (
            <span className="ml-2 text-zinc-500">
              v{healthStatus.details.server} | {healthStatus.details.socket} clients |{' '}
              {healthStatus.details.uptime}h uptime
            </span>
          )}
        </div>
      )}

      {/* Diagnostics panel */}
      {showDiagnostics && (
        <div className="mt-1 p-2 text-xs bg-zinc-800/50 rounded border border-zinc-700">
          <div className="font-mono space-y-1 text-zinc-400">
            <div>
              <span className="text-zinc-500">Socket URL:</span> {socketUrl}
            </div>
            <div>
              <span className="text-zinc-500">Health URL:</span> {healthSummaryUrl}
            </div>
            <div>
              <span className="text-zinc-500">Status:</span>{' '}
              <span className="text-red-400">Disconnected</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-700 text-zinc-500">
            <p>Troubleshooting:</p>
            <ul className="mt-1 ml-3 list-disc space-y-0.5">
              <li>Check if the backend server is running</li>
              <li>Verify network connectivity</li>
              <li>Check browser console for errors</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
