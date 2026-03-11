'use client';

import { useState, useEffect, useCallback } from 'react';
import { LogStream } from './LogStream';
import { ChevronDown, ChevronRight } from 'lucide-react';

export interface Plan {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  logs: string;
}

interface Props {
  plan: Plan;
}

const STATUS_COLORS = {
  running: 'bg-blue-500',
  complete: 'bg-green-500',
  error: 'bg-red-500',
  pending: 'bg-gray-400',
} as const;

function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatCompletedTime(ms: number): string {
  const seconds = ms / 1000;
  return `completed in ${seconds.toFixed(1)}s`;
}

export function PlanCard({ plan }: Props) {
  const { id, name, status, startTime, endTime, logs } = plan;

  // Auto-expand when running, auto-collapse when complete
  const [isExpanded, setIsExpanded] = useState(status === 'running');
  const [elapsed, setElapsed] = useState(0);

  // Update expansion state when status changes
  useEffect(() => {
    if (status === 'running') {
      setIsExpanded(true);
    } else if (status === 'complete') {
      setIsExpanded(false);
    }
  }, [status]);

  // Live timer for running plans
  useEffect(() => {
    if (status !== 'running' || !startTime) {
      return;
    }

    // Initial calculation
    setElapsed(Date.now() - startTime);

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [status, startTime]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const getElapsedDisplay = () => {
    if (status === 'complete' && startTime && endTime) {
      return formatCompletedTime(endTime - startTime);
    }
    if (status === 'running' && startTime) {
      return formatElapsedTime(elapsed);
    }
    return null;
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="p-3 flex items-center gap-3">
        <button
          onClick={toggleExpand}
          className="flex items-center gap-2 flex-1 text-left"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span
            data-testid="status-indicator"
            className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`}
          />
          <span className="font-medium flex-1">{name}</span>
        </button>
        {getElapsedDisplay() && (
          <span
            data-testid="elapsed-time"
            className="text-sm text-muted-foreground"
          >
            {getElapsedDisplay()}
          </span>
        )}
      </div>

      {isExpanded && (
        <div data-testid="log-stream" className="border-t h-48">
          <LogStream logs={logs} isStreaming={status === 'running'} />
        </div>
      )}
    </div>
  );
}
